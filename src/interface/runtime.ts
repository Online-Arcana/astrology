import { BillStore } from "../billing/store.js";
import { loadCalculationService } from "../calculate/service.js";
import type { Config } from "../config.js";
import { loadChartGenerationService } from "../generate/service.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { ApiRuntime } from "./api.js";

export interface LoadedApiRuntime extends ApiRuntime {
  bills: BillStore;
  openAiAdminKey: string | null;
}

export const loadApiRuntime = async (
  config: Config,
  version = "0.19.0",
): Promise<LoadedApiRuntime> => {
  const [{ service, options }, places] = await Promise.all([
    loadCalculationService(config, version),
    loadCscCatalogue(),
  ]);
  const generator = config.openai.apiKey.trim().length === 0
    ? null
    : await loadChartGenerationService(config, version);
  return {
    service,
    generator,
    options,
    places,
    version,
    bills: new BillStore(config.billing.directory),
    openAiAdminKey: config.openai.adminKey,
  };
};
