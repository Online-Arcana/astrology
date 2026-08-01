import { loadCalculationService } from "../calculate/service.js";
import type { Config } from "../config.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { ApiRuntime } from "./api.js";

export const loadApiRuntime = async (
  config: Config,
  version = "0.11.0",
): Promise<ApiRuntime> => {
  const [{ service, options }, places] = await Promise.all([
    loadCalculationService(config, version),
    loadCscCatalogue(),
  ]);
  return { service, options, places, version };
};
