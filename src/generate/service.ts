import {
  CalculationService,
  calculationOptionsFromConfig,
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
import { defaultDeveloperInstruction } from "../llm/orchestrate/run.js";
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

export type ChartSchemaFactory = (calculation: AstralCalculation) => SchemaClientFactory;

export interface GenerationRuntime {
  calculation: Pick<CalculationService, "calculate">;
  schemaFactory: ChartSchemaFactory;
  config: Config;
  version: string;
  now(): string;
}

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
    const interpreted = await runInterpretationPlan(
      calculation,
      this.#runtime.config,
      this.#runtime.schemaFactory(calculation),
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
  version = "0.13.0",
  openai: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata">> = {},
): Promise<ChartGenerationService> => {
  if (config.openai.apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is required for interpreted chart generation");
  }
  const ports = await loadCalculationPorts(version);
  const calculation = new CalculationService(ports);
  const schemaFactory: ChartSchemaFactory = (value) => createOpenAISchemaClientFactory({
    apiKey: config.openai.apiKey,
    instructions: `${defaultDeveloperInstruction}\n\n${languageInstruction(value)}`,
    metadata: {
      service: "astral-charts",
      calculation_fingerprint: value.provenance.calculationFingerprint,
      astral_charts_version: version,
      interpretation_mode: value.settings.interpretationMode,
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
