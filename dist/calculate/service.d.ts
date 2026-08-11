import { CalcError, type Ayanamsha, type CalcPorts, type Zodiac } from "astral-core/web";
import { type AstralCalculation } from "astral-interpreter/web";
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
//# sourceMappingURL=service.d.ts.map