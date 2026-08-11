import type { ChartBill, PricedUsage, ResponseUsage } from "astral-interpreter/web";
import { CalculationService, type CalculationOptions } from "../calculate/service.js";
import type { Config } from "../config.js";
import type { InterpretationSemanticProvider } from "astral-interpreter/web";
import { type LegacyGenerationCheckpoint } from "./migration.js";
import { type OpenAISchemaRuntimeOptions } from "astral-interpreter/web";
import type { InterpretationCheckpoint, InterpretationRun, RunHooks, SchemaClientFactory } from "astral-interpreter/web";
import { type BirthInput } from "../types/base.js";
import type { AstralChart } from "../types/chart.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";
export declare const generationRecoverySchema: "astral-generation-recovery/1.1.0";
export interface GeneratedChart {
    calculation: AstralCalculation;
    interpretation: InterpretationRun;
    chart: AstralChart;
    file: AstralFile;
    /** Present for the built-in OpenAI runtime; optional for compatible custom generators. */
    bill?: ChartBill;
}
export interface ChartGenerationCheckpoint {
    schema: typeof generationRecoverySchema;
    version: string;
    calculationFingerprint: string;
    calculation: AstralCalculation;
    interpretation: InterpretationCheckpoint;
    billing?: ChartBill;
}
export type ResumableChartGenerationCheckpoint = ChartGenerationCheckpoint | LegacyGenerationCheckpoint;
export interface GenerationHooks extends Omit<RunHooks, "onCheckpoint"> {
    /** Fires when the authoritative deterministic calculation exists and before interpretation starts or resumes. */
    onCalculation?: (calculation: AstralCalculation) => void | Promise<void>;
    onCheckpoint?: (checkpoint: ChartGenerationCheckpoint) => void | Promise<void>;
    onUsage?: (event: PricedUsage) => void;
    onBill?: (bill: ChartBill) => void;
}
export type ChartSchemaFactory = (calculation: AstralCalculation, onUsage: (event: ResponseUsage) => void) => SchemaClientFactory;
export interface GenerationRuntime {
    calculation: Pick<CalculationService, "calculate">;
    schemaFactory: ChartSchemaFactory;
    config: Config;
    version: string;
    /**
     * Optional while the reviewed semantic corpus is under construction.
     * When supplied, every substantive interpretation call is corpus-backed and
     * the provider must fail closed for missing or invalid unit semantics.
     */
    semanticProvider?: InterpretationSemanticProvider | null;
    now(): string;
}
export declare class ChartGenerationService {
    #private;
    constructor(runtime: GenerationRuntime);
    generate(birth: BirthInput, options?: CalculationOptions, hooks?: GenerationHooks): Promise<GeneratedChart>;
    resume(checkpoint: ResumableChartGenerationCheckpoint, hooks?: GenerationHooks): Promise<GeneratedChart>;
}
export declare const createChartGenerationService: (calculation: Pick<CalculationService, "calculate">, config: Config, version?: string, openai?: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata" | "onUsage">>, semanticProvider?: InterpretationSemanticProvider | null) => ChartGenerationService;
export declare const loadChartGenerationService: (config: Config, version?: string, openai?: Partial<Omit<OpenAISchemaRuntimeOptions, "apiKey" | "instructions" | "metadata" | "onUsage">>, semanticProvider?: InterpretationSemanticProvider | null) => Promise<ChartGenerationService>;
//# sourceMappingURL=service.d.ts.map