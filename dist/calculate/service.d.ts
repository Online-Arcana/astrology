import { CalcError, type Ayanamsha, type CalcPorts, type Zodiac } from "astral-core/web";
import { type AstralCalculation } from "astral-interpreter/web";
import type { Config } from "../config.js";
import { type BirthInput } from "../types/base.js";
export interface CalculationOptions {
    primaryZodiac: Zodiac;
    ayanamsha: Ayanamsha;
    interpretationMode: Zodiac;
}
export type CalculationPorts = CalcPorts;
export declare class CalculationUnavailableError extends CalcError {
}
export declare class CalculationService {
    #private;
    constructor(ports: CalculationPorts);
    calculate(input: BirthInput, options: CalculationOptions): Promise<AstralCalculation>;
}
export declare const loadCalculationPorts: (version?: string) => Promise<CalculationPorts>;
export declare const loadCalculationService: (config: Config, version?: string) => Promise<{
    service: CalculationService;
    options: CalculationOptions;
}>;
//# sourceMappingURL=service.d.ts.map