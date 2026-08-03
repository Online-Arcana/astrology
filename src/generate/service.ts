import { BillCollector } from "../billing/bill.js";
import type { ChartBill, PricedUsage, ResponseUsage } from "../billing/types.js";
import {
  CalculationService,
  loadCalculationPorts,
  type CalculationOptions,
} from "../calculate/service.js";
import { assembleChart } from "../chart/assemble.js";
import type { Config } from "../config.js";
import { assembleAstralFile } from "../file/document.js";
import {
  legacyBirthInput,
  legacyGenerationRecoverySchema,
  migrateLegacyInterpretation,
  type LegacyGenerationCheckpoint,
} from "./migration.js";
import { createOpenAISchemaClientFactory, type OpenAISchemaRuntimeOptions } from "../llm/openaiSchema.js";
import { diagnosticHooks } from "../llm/orchestrate/diagnostics.js";
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
  WaveCheckpoint,
} from "../llm/orchestrate/types.js";
import { preferredGenderOf, type BirthInput, type PreferredGender } from "../types/base.js";
import type { AstralChart } from "../types/chart.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";

export const generationRecoverySchema = "astral-generation-recovery/1.1.0" as const;

export interface GeneratedChart {
  calculation: AstralCalculation;
  interpretation: InterpretationRun;
  chart: AstralChart;
  file: AstralFile;
  /** Present for the built-in OpenAI runtime; optional for compatible custom generators. */
  bill?: ChartBill;
}

export interface ChartGenerationCheckpoint {
  schema: typeof generationRecoverySchema;
  version: string;
  calculationFingerprint: string;
  calculation: AstralCalculation;
  interpretation: InterpretationCheckpoint;
  billing?: ChartBill;
}

export type ResumableChartGenerationCheckpoint = ChartGenerationCheckpoint | LegacyGenerationCheckpoint;

export interface GenerationHooks extends Omit<RunHooks, "onCheckpoint"> {
  onCheckpoint?: (checkpoint: ChartGenerationCheckpoint) => void | Promise<void>;
  onUsage?: (event: PricedUsage) => void;
  onBill?: (bill: ChartBill) => void;
}

export type ChartSchemaFactory = (
  calculation: AstralCalculation,
  onUsage: (event: ResponseUsage) => void,
) => SchemaClientFactory;

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

const grammaticalGenderInstruction = (gender: PreferredGender): string => {
  const neutral = "Prefer natural gender-neutral wording whenever it preserves meaning, especially in English. Never infer anatomy, sex at birth, social roles, interests or relationship roles from preferred gender.";
  switch (gender) {
    case "male": return `${neutral} Where the target language genuinely requires gender agreement or a personal pronoun, use masculine forms and masculine pronouns.`;
    case "female": return `${neutral} Where the target language genuinely requires gender agreement or a personal pronoun, use feminine forms and feminine pronouns.`;
    case "non-binary": return `${neutral} Use neutral pronouns and neutral grammatical forms where established. Otherwise rewrite the sentence naturally to avoid gendered pronouns or morphology rather than forcing an awkward form.`;
  }
};

const languageInstruction = (calculation: AstralCalculation): string => {
  const ayanamsha = calculation.settings.siderealAyanamsha;
  return [
    `Write all interpretation text in ${calculation.subject.language}.`,
    "The subject is an adult.",
    grammaticalGenderInstruction(preferredGenderOf(calculation.subject)),
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

const expandedWave = (wave: WaveCheckpoint | null | undefined): WaveCheckpoint | null => {
  if (wave === null || wave === undefined) return null;
  const phase = wave.assembled
    ? "assembled"
    : wave.lanes.every(({ status }) => status === "complete" || status === "blocked")
      ? "barrier"
      : "running";
  return {
    ...wave,
    lanes: wave.lanes.map((lane) => ({
      ...lane,
      assignments: [...lane.assignments],
      completed: [...lane.completed],
      position: lane.completed.length,
    })),
    staged: { ...wave.staged },
    conflicts: [...wave.conflicts],
    phase,
    stagedOrder: Object.keys(wave.staged),
  };
};

const authoritativeInterpretation = async (
  calculation: AstralCalculation,
  interpretation: InterpretationCheckpoint,
): Promise<InterpretationCheckpoint> => {
  const wave = expandedWave(interpretation.wave);
  const saved = interpretation.snapshot;
  if (saved === null || saved === undefined) return { ...interpretation, wave };

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
    wave,
  };
};

const recoveryFor = async (
  version: string,
  calculation: AstralCalculation,
  interpretation: InterpretationCheckpoint,
  billing: ChartBill,
): Promise<ChartGenerationCheckpoint> => ({
  schema: generationRecoverySchema,
  version,
  calculationFingerprint: calculation.provenance.calculationFingerprint,
  calculation,
  interpretation: await authoritativeInterpretation(calculation, interpretation),
  billing,
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
    return this.#complete(calculation, hooks, null, null);
  }

  async resume(
    checkpoint: ResumableChartGenerationCheckpoint,
    hooks: GenerationHooks = {},
  ): Promise<GeneratedChart> {
    if (checkpoint.schema === legacyGenerationRecoverySchema) {
      const calculation = await this.#runtime.calculation.calculate(
        legacyBirthInput(checkpoint),
        optionsFromConfig(this.#runtime.config),
      );
      const recovery = migrateLegacyInterpretation(checkpoint, calculation);
      return this.#complete(calculation, hooks, recovery, null);
    }
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
    return this.#complete(checkpoint.calculation, hooks, recovery, checkpoint.billing ?? null);
  }

  async #complete(
    calculation: AstralCalculation,
    hooks: GenerationHooks,
    recovery: InterpretationRecovery | null,
    priorBill: ChartBill | null,
  ): Promise<GeneratedChart> {
    const collector = new BillCollector(
      calculation.provenance.calculationFingerprint,
      priorBill,
      () => this.#runtime.now(),
    );
    const report = (raw: ResponseUsage): void => {
      const event = collector.add(raw);
      hooks.onUsage?.(event);
      hooks.onBill?.(collector.snapshot());
    };
    const { onCheckpoint, onUsage: _onUsage, onBill: _onBill, ...runHooks } = hooks;
    const instrumented = diagnosticHooks({
      ...runHooks,
      ...(onCheckpoint === undefined
        ? {}
        : {
            onCheckpoint: async (checkpoint: InterpretationCheckpoint) =>
              onCheckpoint(await recoveryFor(
                this.#runtime.version,
                calculation,
                checkpoint,
                collector.snapshot(),
              )),
          }),
    }, () => this.#runtime.now());

    try {
      const interpreted = await runInterpretationPlan(
        calculation,
        this.#runtime.config,
        this.#runtime.schemaFactory(calculation, report),
        instrumented,
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
      const bill = collector.finish("completed", generatedAt);
      hooks.onBill?.(bill);
      return { calculation, interpretation: interpreted.run, chart, file, bill };
    } catch (cause: unknown) {
      hooks.onBill?.(collector.finish("failed", this.#runtime.now()));
      throw cause;
    }
  }
}

export const loadChartGenerationService = async (
  config: Config,
  version = "0.20.0",
  openai: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata" | "onUsage">> = {},
): Promise<ChartGenerationService> => {
  if (config.openai.apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is required for interpreted chart generation");
  }
  const ports = await loadCalculationPorts(version);
  const calculation = new CalculationService(ports);
  const schemaFactory: ChartSchemaFactory = (value, onUsage) => createOpenAISchemaClientFactory({
    apiKey: config.openai.apiKey,
    instructions: `${baseDeveloperInstruction}\n\n${languageInstruction(value)}`,
    metadata: {
      service: "astral-charts",
      calculation_fingerprint: value.provenance.calculationFingerprint,
      astral_charts_version: version,
      zodiac: value.system.zodiac,
      ayanamsha: value.settings.siderealAyanamsha ?? "none",
      preferred_gender: preferredGenderOf(value.subject),
    },
    ...(config.chart.laneContextTokens === undefined
      ? {}
      : { contextTokenBudget: config.chart.laneContextTokens }),
    onUsage,
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
