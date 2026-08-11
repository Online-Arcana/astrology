import type { InterpretationSemanticProvider, OpenAISchemaRuntimeOptions } from "astral-interpreter/web";
import { CalculationService } from "../calculate/service.js";
import { loadCalculationPorts } from "../calculate/node.js";
import type { Config } from "../config.js";
import {
  createChartGenerationService,
  type ChartGenerationService,
} from "./service.js";

export const loadChartGenerationService = async (
  config: Config,
  version = "0.20.0",
  openai: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata" | "onUsage">> = {},
  semanticProvider: InterpretationSemanticProvider | null = null,
): Promise<ChartGenerationService> => {
  const ports = await loadCalculationPorts(version);
  return createChartGenerationService(
    new CalculationService(ports),
    config,
    version,
    openai,
    semanticProvider,
  );
};
