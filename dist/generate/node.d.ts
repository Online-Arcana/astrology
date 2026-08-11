import type { InterpretationSemanticProvider, OpenAISchemaRuntimeOptions } from "astral-interpreter/web";
import type { Config } from "../config.js";
import { type ChartGenerationService } from "./service.js";
export declare const loadChartGenerationService: (config: Config, version?: string, openai?: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata" | "onUsage">>, semanticProvider?: InterpretationSemanticProvider | null) => Promise<ChartGenerationService>;
//# sourceMappingURL=node.d.ts.map