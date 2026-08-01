import {
  CalculationService,
  calculationOptionsFromConfig,
  loadCalculationPorts,
  type CalculationOptions,
} from "../calculate/service.js";
import { assembleChart } from "../chart/assemble.js";
import type { Config } from "../config.js";
import { assembleAstralFile } from "../file/document.js";
import { generatedChartName } from "../name/generate.js";
import { createOpenAISchemaClientFactory, type OpenAISchemaRuntimeOptions } from "../llm/openaiSchema.js";
import {
  nlpAuditProfile,
  promptCatalogue,
  runInterpretationPlan,
  structuredOutputCatalogue,
} from "../llm/orchestrate/plan.js";
import { defaultDeveloperInstruction, InterpretationRunner } from "../llm/orchestrate/run.js";
import type { InterpretationRun, SchemaClientFactory } from "../llm/orchestrate/types.js";
import type { BirthInput } from "../types/base.js";
import type { AstralChart } from "../types/chart.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";

export interface GeneratedChart {
  calculation: AstralCalculation;
  interpretation: InterpretationRun;
  chart: AstralChart;
  file: AstralFile;
}

export interface GenerationRuntime {
  calculation: Pick<CalculationService, "calculate">;
  schemaFactory: SchemaClientFactory;
  config: Config;
  version: string;
  now(): string;
}

const authority = (config: Config, generatedAt: string) => {
  const signing = config.signing;
  if (signing.privateKey === null || signing.publicKey === null) return null;
  return {
    issuer: signing.issuer,
    keys: {
      privatePkcs8: signing.privateKey,
      publicRaw: signing.publicKey,
    },
    generatedAt,
  };
};

const languageInstruction = (calculation: AstralCalculation): string => [
  `Write all interpretation text in ${calculation.subject.language}.`,
  "The subject is an adult.",
  "Astrology may be interpreted as symbolism, tendencies and patterns only.",
  "Do not add medical, legal, financial, safeguarding or crisis advice.",
].join("\n");

export class ChartGenerationService {
  readonly #runtime: GenerationRuntime;

  constructor(runtime: GenerationRuntime) {
    this.#runtime = runtime;
  }

  async generate(
    birth: BirthInput,
    options: CalculationOptions = calculationOptionsFromConfig(this.#runtime.config),
  ): Promise<GeneratedChart> {
    const calculation = await this.#runtime.calculation.calculate(birth, options);
    const runner = new InterpretationRunner(this.#runtime.schemaFactory, {
      bigModel: this.#runtime.config.models.big,
      smallModel: this.#runtime.config.models.small,
      maxRetries: this.#runtime.config.runtime.maxRetries,
    });
    const interpretation = await runInterpretationPlan(runner, calculation, {
      metadata: {
        calculation_fingerprint: calculation.provenance.calculationFingerprint,
        astral_charts_version: this.#runtime.version,
        interpretation_mode: options.interpretationMode,
      },
      developerMessage: languageInstruction(calculation),
    });
    const generatedAt = this.#runtime.now();
    const chart = assembleChart(calculation, interpretation, {
      generatedAt,
      bigModel: this.#runtime.config.models.big,
      smallModel: this.#runtime.config.models.small,
      structuredOutputSchema: structuredOutputCatalogue,
      promptCatalogue,
      astrologyCatalogue: calculation.provenance.astrologyProfile,
      nlpAuditProfile,
      ...(calculation.subject.providedName === null
        ? { generatedName: generatedChartName(calculation.provenance.calculationFingerprint) }
        : {}),
    });
    const file = await assembleAstralFile(calculation, chart, authority(this.#runtime.config, generatedAt));
    return { calculation, interpretation, chart, file };
  }
}

export const loadChartGenerationService = async (
  config: Config,
  version = "0.13.0",
  openai: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions">> = {},
): Promise<ChartGenerationService> => {
  if (config.openaiApiKey === null) throw new Error("OPENAI_API_KEY is required for interpreted chart generation");
  const ports = await loadCalculationPorts(version);
  const calculation = new CalculationService(ports);
  const schemaFactory = createOpenAISchemaClientFactory({
    apiKey: config.openaiApiKey,
    instructions: defaultDeveloperInstruction,
    metadata: { service: "astral-charts" },
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
