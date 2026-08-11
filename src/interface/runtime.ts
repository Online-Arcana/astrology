import { loadCscCatalogue } from "astral-core";
import { BillStore, productionSemanticProvider } from "astral-interpreter";
import type { Config } from "../config.js";
import { loadCalculationService } from "../calculate/node.js";
import { loadChartGenerationService } from "../generate/node.js";
import type { ApiRuntime } from "./api.js";
export interface LoadedApiRuntime extends ApiRuntime {
  bills: BillStore;
  openAiAdminKey: string | null;
}
export const loadApiRuntime = async (config: Config, version = "0.20.0"): Promise<LoadedApiRuntime> => {
  const [{ service, options }, places] = await Promise.all([loadCalculationService(config, version), loadCscCatalogue()]);
  const generator = config.openai.apiKey.trim().length === 0
    ? null
    : await loadChartGenerationService(config, version, {}, productionSemanticProvider);
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
