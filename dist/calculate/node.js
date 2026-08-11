import { loadPorts } from "astral-core";
import { CalculationService, } from "./service.js";
const optionsFromConfig = (config) => ({
    primaryZodiac: config.chart.primaryZodiac,
    ayanamsha: config.chart.ayanamsha,
    interpretationMode: config.chart.interpretationMode,
});
export const loadCalculationPorts = async (version = "0.20.0") => loadPorts(version);
export const loadCalculationService = async (config, version = "0.20.0") => ({
    service: new CalculationService(await loadCalculationPorts(version)),
    options: optionsFromConfig(config),
});
//# sourceMappingURL=node.js.map