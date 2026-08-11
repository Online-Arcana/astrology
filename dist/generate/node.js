import { CalculationService } from "../calculate/service.js";
import { loadCalculationPorts } from "../calculate/node.js";
import { createChartGenerationService, } from "./service.js";
export const loadChartGenerationService = async (config, version = "0.20.0", openai = {}, semanticProvider = null) => {
    const ports = await loadCalculationPorts(version);
    return createChartGenerationService(new CalculationService(ports), config, version, openai, semanticProvider);
};
//# sourceMappingURL=node.js.map