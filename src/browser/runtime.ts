import type { ChartBill } from "../billing/types.js";
import type { CalculationOptions } from "../calculate/service.js";
import { readConfig, type Config } from "../config.js";
import { sign } from "../file/authority.js";
import {
  loadChartGenerationService,
  type ChartGenerationCheckpoint,
  type GeneratedChart,
  type GenerationHooks,
  type ResumableChartGenerationCheckpoint,
} from "../generate/service.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { PlaceCatalogue } from "../place/model.js";
import type { BirthInput } from "../types/base.js";
import type { AstralFile } from "../types/file.js";
import type { BrowserSigningKey } from "./keys.js";

export const browserVersion = "0.20.0";

export interface BrowserGeneratedChart extends Omit<GeneratedChart, "file" | "bill"> {
  file: AstralFile;
  bill: ChartBill | null;
}

const configFor = (apiKey: string): Config => readConfig({
  OPENAI_API_KEY: apiKey,
  OPENAI_BIG_MODEL: "gpt-5.4-mini",
  OPENAI_SMALL_MODEL: "gpt-5.4-nano",
  OPENAI_REASONING: "low",
  OPENAI_MAX_OUTPUT_TOKENS: "12000",
  ASTRAL_PRIMARY_ZODIAC: "tropical",
  ASTRAL_INTERPRETATION_MODE: "tropical",
  ASTRAL_SIDEREAL_AYANAMSHA: "lahiri",
  ASTRAL_MAX_RETRIES: "3",
  ASTRAL_FOUNDATION_UNITS: "10",
  ASTRAL_LANE_COUNT: "4",
  ASTRAL_LANE_UNITS: "10",
  ASTRAL_LANE_CONTEXT_TOKENS: "60000",
  ASTRAL_SIGNING_ENABLED: "false",
  ASTRAL_BILL_DIR: "browser-only",
});

const signedGeneratedFile = async (
  generated: GeneratedChart,
  key: BrowserSigningKey | null,
): Promise<AstralFile> => {
  if (key === null) return generated.file;
  const generatedAt = generated.file["astral-chart"].provenance.generatedAt;
  return sign(generated.file, key.issuer, key, generatedAt);
};

export class BrowserRuntime {
  readonly #apiKey: string;
  readonly #config: Config;
  readonly #places: Promise<PlaceCatalogue>;

  constructor(apiKey: string) {
    const selected = apiKey.trim();
    if (selected.length === 0) throw new Error("Enter and save an OpenAI API key before generating a chart");
    this.#apiKey = selected;
    this.#config = configFor(selected);
    this.#places = loadCscCatalogue();
  }

  get options(): CalculationOptions {
    return {
      primaryZodiac: this.#config.chart.primaryZodiac,
      ayanamsha: this.#config.chart.ayanamsha,
      interpretationMode: this.#config.chart.interpretationMode,
    };
  }

  places(): Promise<PlaceCatalogue> {
    return this.#places;
  }

  async generate(
    birth: BirthInput,
    options: CalculationOptions,
    hooks: GenerationHooks,
    signingKey: BrowserSigningKey | null,
  ): Promise<BrowserGeneratedChart> {
    const service = await loadChartGenerationService(this.#config, browserVersion, {
      fetch: globalThis.fetch.bind(globalThis),
    });
    const generated = await service.generate(birth, options, hooks);
    return {
      ...generated,
      file: await signedGeneratedFile(generated, signingKey),
      bill: generated.bill ?? null,
    };
  }

  async resume(
    checkpoint: ResumableChartGenerationCheckpoint,
    hooks: GenerationHooks,
    signingKey: BrowserSigningKey | null,
  ): Promise<BrowserGeneratedChart> {
    const service = await loadChartGenerationService(this.#config, browserVersion, {
      fetch: globalThis.fetch.bind(globalThis),
    });
    const generated = await service.resume(checkpoint, hooks);
    return {
      ...generated,
      file: await signedGeneratedFile(generated, signingKey),
      bill: generated.bill ?? null,
    };
  }
}

export const isBrowserCheckpoint = (value: unknown): value is ChartGenerationCheckpoint => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const raw = value as { schema?: unknown; version?: unknown };
  return raw.schema === "astral-generation-recovery/1.1.0" && raw.version === browserVersion;
};
