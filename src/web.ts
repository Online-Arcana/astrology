import {
  webPlaces,
  webPorts,
  type PlaceCatalogue,
} from "astral-core/web";
import {
  productionSemanticProvider,
  type InterpretationSemanticProvider,
  type OpenAISchemaRuntimeOptions,
} from "astral-interpreter/web";
import { CalculationService } from "./calculate/service.js";
import type { Config } from "./config.js";
import {
  createChartGenerationService,
  type ChartGenerationService,
} from "./generate/service.js";

export { webPlaces, webPorts } from "astral-core/web";
export type { PlaceCatalogue } from "astral-core/web";
export {
  productionSemanticProvider,
  type InterpretationSemanticProvider,
  type OpenAISchemaRuntimeOptions,
} from "astral-interpreter/web";
export { readConfig, type Config, type Env } from "./config.js";
export { preferredGenderOf, type BirthInput } from "./types/base.js";
export type {
  AstralCrc,
  AstralAuthority,
  AstralFile,
  AstralValidation,
  TrustedAuthority,
  EncodedPublicKey,
  EncodedSignature,
  KeyId,
  SignedDigest,
} from "./types/file.js";
export type {
  LegacyAstralCalculation,
  LegacyAstralChart,
  LegacyAstralFile,
  ReadableAstralFile,
} from "./types/legacy.js";
export type { ProgressEvent, ProgressStage } from "./types/progress.js";
export {
  CalculationService,
  CalculationUnavailableError,
  type CalculationOptions,
  type CalculationPorts,
} from "./calculate/service.js";
export { canonicalise } from "./file/canonical.js";
export * from "./file/codec.js";
export * from "./file/crc32c.js";
export * from "./file/integrity.js";
export * from "./file/authority.js";
export * from "./file/invariants.js";
export * from "./file/document.js";
export * from "./file/validate.js";
export {
  ChartGenerationService,
  createChartGenerationService,
  generationRecoverySchema,
  type ChartGenerationCheckpoint,
  type ChartSchemaFactory,
  type GeneratedChart,
  type GenerationHooks,
  type GenerationRuntime,
  type ResumableChartGenerationCheckpoint,
} from "./generate/service.js";

export const webPlaceCatalogue = (places: URL): PlaceCatalogue => webPlaces(places);

export const loadWebChartGenerationService = async (
  config: Config,
  places: URL,
  version = "0.20.0",
  openai: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata" | "onUsage">> = {},
  semanticProvider: InterpretationSemanticProvider | null = productionSemanticProvider,
): Promise<ChartGenerationService> => {
  const calculation = new CalculationService(await webPorts(places, version));
  return createChartGenerationService(
    calculation,
    config,
    version,
    openai,
    semanticProvider,
  );
};
