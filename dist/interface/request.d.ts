import type { CalculationOptions } from "../calculate/service.js";
import type { BirthInput } from "../types/base.js";
export interface CalculationRequest {
    birth: BirthInput;
    options: CalculationOptions;
}
export declare const parseCalculationRequest: (value: unknown, defaults: CalculationOptions) => CalculationRequest;
//# sourceMappingURL=request.d.ts.map