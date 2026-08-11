import { webPlaces, webPorts, } from "astral-core/web";
import { productionSemanticProvider, } from "astral-interpreter/web";
import { CalculationService } from "./calculate/service.js";
import { createChartGenerationService, } from "./generate/service.js";
export * from "astral-core/web";
export * from "astral-interpreter/web";
export * from "astral-core/wheel";
export { webPlaces, webPorts } from "astral-core/web";
export { renderWheel, wheelData, renderPublicWheel, fromPublic } from "astral-core/wheel";
export { productionSemanticProvider, } from "astral-interpreter/web";
export { readConfig } from "./config.js";
export { preferredGenderOf } from "./types/base.js";
export { CalculationService, CalculationUnavailableError, } from "./calculate/service.js";
export { canonicalise } from "./file/canonical.js";
export { digest } from "./file/hash.js";
export * from "./file/codec.js";
export * from "./file/crc32c.js";
export * from "./file/integrity.js";
export * from "./file/authority.js";
export * from "./file/invariants.js";
export * from "./file/document.js";
export * from "./file/validate.js";
export { ChartGenerationService, createChartGenerationService, generationRecoverySchema, } from "./generate/service.js";
export const webPlaceCatalogue = (places) => webPlaces(places);
export const loadWebChartGenerationService = async (config, places, version = "0.20.0", openai = {}, semanticProvider = productionSemanticProvider) => {
    const calculation = new CalculationService(await webPorts(places, version));
    return createChartGenerationService(calculation, config, version, openai, semanticProvider);
};
//# sourceMappingURL=web.js.map