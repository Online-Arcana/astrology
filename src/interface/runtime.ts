import { loadCalculationService } from "../calculate/service.js";
import type { Config } from "../config.js";
import { loadChartGenerationService } from "../generate/service.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { ApiRuntime } from "./api.js";

export const loadApiRuntime = async (
  config: Config,
  version = "0.14.1",
): Promise<ApiRuntime> => {
  const [{ service, options }, places] = await Promise.all([
    loadCalculationService(config, version),
    loadCscCatalogue(),
  ]);
  const generator = config.openai.apiKey.trim().length === 0
    ? null
    : await loadChartGenerationService(config, version);
  return { service, generator, options, places, version };
};
