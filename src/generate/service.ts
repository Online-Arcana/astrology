import {
  CalculationService,
  loadCalculationPorts,
  type CalculationOptions,
} from "../calculate/service.js";
import { assembleChart } from "../chart/assemble.js";
import type { Config } from "../config.js";
import { assembleAstralFile } from "../file/document.js";
import { createOpenAISchemaClientFactory, type OpenAISchemaRuntimeOptions } from "../llm/openaiSchema.js";
import {
  nlpAuditProfile,
  promptCatalogue,
  runInterpretationPlan,
  structuredOutputCatalogue,
} from "../llm/orchestrate/plan.js";
import { buildSnapshot, snapshotText } from "../llm/orchestrate/snapshot.js";
import type {
  InterpretationCheckpoint,
  InterpretationRecovery,
  InterpretationRun,
  RunHooks,
  SchemaClientFactory,
} from "../llm/orchestrate/types.js";
import type { BirthInput } from "../types/base.js";
import type { AstralChart } from "../types/chart.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";

export const generationRecoverySchema = "astral-generation-recovery/1.1.0" as const;

export interface GeneratedChart {
  calculation: AstralCalculation;
  interpretation: InterpretationRun;
  chart: AstralChart;
  file: AstralFile;
}

export interface ChartGenerationCheckpoint {
  schema: typeof generationRecoverySchema;
  version: string;
  calculationFingerprint: string;
  calculation: AstralCalculation;
  interpretation: InterpretationCheckpoint;
}

export interface GenerationHooks extends Omit<RunHooks, "onCheckpoint"> {
  onCheckpoint?: (checkpoint: ChartGenerationCheckpoint) => void | Promise<void>;
}

export type ChartSchemaFactory = (calculation: AstralCalculation) => SchemaClientFactory;

export interface GenerationRuntime {
  calculation: Pick<CalculationService, "calculate">;
  schemaFactory: ChartSchemaFactory;
  config: Config;
  version: string;
  now(): string;
}

const optionsFromConfig = (config: Config): CalculationOptions => ({
  primaryZodiac: config.chart.primaryZodiac,
  ayanamsha: config.chart.ayanamsha,
  interpretationMode: config.chart.interpretationMode,
});

const authority = (config: Config, generatedAt: string) => {
  const signing = config.signing;
  if (!signing.enabled || signing.privateKey === null || signing.publicKey === null) return null;
  return {
    issuer: signing.issuer,
    keys: {
      privatePkcs8: signing.privateKey,
      publicRaw: signing.publicKey,
    },
    generatedAt,
  };
};

const baseDeveloperInstruction = [
  "Interpret only the requested astrology field.",
  "Never calculate placements, scores, ranks or availability.",
  "Never output reasoning, planning, preambles, disclaimers or process narration.",
  "Never combine multiple interpretation fields.",
  "Return only the requested strict JSON schema.",
].join("\n");

const languageInstruction = (calculation: AstralCalculation): string => {
  const ayanamsha = calculation.settings.siderealAyanamsha;
  return [
    `Write all interpretation text in ${calculation.subject.language}.`,
    "The subject is an adult.",
    "Astrology may be interpreted as symbolism, tendencies and patterns only.",
    "Do not add medical, legal, financial, safeguarding or crisis advice.",
    `Use only the selected ${calculation.system.zodiac} zodiac system.`,
    ayanamsha === null
      ? "Do not mention, compare or import sidereal placements or ayanamshas."
      : `Use only the ${ayanamsha} ayanamsha and never import another ayanamsha or tropical placement.`,
  ].join("\n");
};

const interpretationOrder = (calculation: AstralCalculation): string[] => [
  ...calculation.interpretationPlan.units.map(({ id }) => id),
  ...(calculation.subject.providedName === null ? ["generated-name"] : []),
];

const authoritativeInterpretation = async (
  calculation: AstralCalculation,
  interpretation: InterpretationCheckpoint,
): Promise<InterpretationCheckpoint> => {
  const saved = interpretation.snapshot;
  if (saved === null || saved === undefined) return interpretation;

  const rebuilt = await buildSnapshot(
    { "astral-calculation": calculation },
    interpretation.units,
    interpretationOrder(calculation),
    saved.revision,
  );
  if (rebuilt.sha256 !== saved.sha256) {
    throw new Error("Generation recovery local snapshot does not match its accepted interpretation units");
  }
  if (saved.localSnapshot !== undefined) {
    let local: unknown;
    try {
      local = JSON.parse(saved.localSnapshot);
    } catch {
      throw new Error("Generation recovery local snapshot is not valid JSON");
    }
    if (
      typeof local !== "object"
      || local === null
      || (local as { sha256?: unknown }).sha256 !== saved.sha256
    ) {
      throw new Error("Generation recovery local snapshot identity is invalid");
    }
  }

  return {
    ...interpretation,
    snapshot: {
      ...saved,
      remoteFileId: null,
      acceptedOrder: [...rebuilt.acceptedOrder],
      localSnapshot: snapshotText(rebuilt),
    },
  };
};

const recoveryFor = async (
  version: string,
  calculation: AstralCalculation,
  interpretation: InterpretationCheckpoint,
): Promise<ChartGenerationCheckpoint> => ({
  schema: generationRecoverySchema,
  version,
  calculationFingerprint: calculation.provenance.calculationFingerprint,
  calculation,
  interpretation: await authoritativeInterpretation(calculation, interpretation),
});

const assertRecoveryBasis = (checkpoint: ChartGenerationCheckpoint, config: Config): void => {
  const settings = checkpoint.calculation.settings;
  if (settings.primaryZodiac !== config.chart.primaryZodiac || settings.interpretationMode !== config.chart.interpretationMode) {
    throw new Error("Generation recovery zodiac does not match the runtime chart configuration; create or resume the matching chart instead");
  }
  const expectedAyanamsha = settings.primaryZodiac === "sidereal" ? config.chart.ayanamsha : null;
  if (settings.siderealAyanamsha !== expectedAyanamsha) {
    throw new Error("Generation recovery ayanamsha does not match the runtime chart configuration; create or resume the matching chart instead");
  }
};

export class ChartGenerationService {
  readonly #runtime: GenerationRuntime;

  constructor(runtime: GenerationRuntime) {
    this.#runtime = runtime;
  }

  async generate(
    birth: BirthInput,
    options: CalculationOptions = optionsFromConfig(this.#runtime.config),
    hooks: GenerationHooks = {},
  ): Promise<GeneratedChart> {
    const calculation = await this.#runtime.calculation.calculate(birth, options);
    return this.#complete(calculation, hooks, null);
  }

  async resume(
    checkpoint: ChartGenerationCheckpoint,
    hooks: GenerationHooks = {},
  ): Promise<GeneratedChart> {
    if (checkpoint.schema !== generationRecoverySchema) {
      throw new Error("Generation recovery schema is unsupported");
    }
    if (checkpoint.version !== this.#runtime.version) {
      throw new Error(
        `Generation recovery version ${checkpoint.version} does not match runtime ${this.#runtime.version}`,
      );
    }
    if (checkpoint.calculation.provenance.calculationFingerprint !== checkpoint.calculationFingerprint) {
      throw new Error("Generation recovery calculation fingerprint does not match its calculation");
    }
    assertRecoveryBasis(checkpoint, this.#runtime.config);
    const recovery = await authoritativeInterpretation(checkpoint.calculation, checkpoint.interpretation);
    return this.#complete(checkpoint.calculation, hooks, recovery);
  }

  async #complete(
    calculation: AstralCalculation,
    hooks: GenerationHooks,
    recovery: InterpretationRecovery | null,
  ): Promise<GeneratedChart> {
    const { onCheckpoint, ...runHooks } = hooks;
    const interpreted = await runInterpretationPlan(
      calculation,
      this.#runtime.config,
      this.#runtime.schemaFactory(calculation),
      {
        ...runHooks,
        ...(onCheckpoint === undefined
          ? {}
          : {
              onCheckpoint: async (checkpoint: InterpretationCheckpoint) =>
                onCheckpoint(await recoveryFor(this.#runtime.version, calculation, checkpoint)),
            }),
      },
      recovery,
    );
    const generatedAt = this.#runtime.now();
    const chart = assembleChart(calculation, interpreted.run, {
      generatedAt,
      bigModel: this.#runtime.config.openai.bigModel,
      smallModel: this.#runtime.config.openai.smallModel,
      structuredOutputSchema: structuredOutputCatalogue,
      promptCatalogue,
      astrologyCatalogue: calculation.provenance.astrologyProfile,
      nlpAuditProfile,
      ...(interpreted.generatedName === null ? {} : { generatedName: interpreted.generatedName }),
    });
    const file = await assembleAstralFile(calculation, chart, authority(this.#runtime.config, generatedAt));
    return { calculation, interpretation: interpreted.run, chart, file };
  }
}

export const loadChartGenerationService = async (
  config: Config,
  version = "0.19.0",
  openai: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata">> = {},
): Promise<ChartGenerationService> => {
  if (config.openai.apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is required for interpreted chart generation");
  }
  const ports = await loadCalculationPorts(version);
  const calculation = new CalculationService(ports);
  const schemaFactory: ChartSchemaFactory = (value) => createOpenAISchemaClientFactory({
    apiKey: config.openai.apiKey,
    instructions: `${baseDeveloperInstruction}\n\n${languageInstruction(value)}`,
    metadata: {
      service: "astral-charts",
      calculation_fingerprint: value.provenance.calculationFingerprint,
      astral_charts_version: version,
      zodiac: value.system.zodiac,
      ayanamsha: value.settings.siderealAyanamsha ?? "none",
    },
    ...openai,
  });
  return new ChartGenerationService({
    calculation,
    schemaFactory,
    config,
    version,
    now: () => new Date().toISOString(),
  });
};
