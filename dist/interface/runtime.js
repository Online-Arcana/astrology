import { loadCscCatalogue } from "astral-core";
import { BillStore, productionSemanticProvider } from "astral-interpreter";
import { loadCalculationService } from "../calculate/node.js";
import { loadChartGenerationService } from "../generate/node.js";
export const loadApiRuntime = async (config, version = "0.20.0") => {
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
//# sourceMappingURL=runtime.js.map