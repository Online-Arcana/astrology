import type { AstralChart, AstralCalculation, AstralCrc, AstralFile } from "../types/index.js";
export interface AstralCore {
    schema: "astral/1.1.0";
    "astral-calculation": AstralCalculation;
    "astral-chart": AstralChart;
}
export declare const core: (calculation: AstralCalculation, chart: AstralChart) => AstralCore;
export declare const crcFor: (value: AstralCore) => Promise<AstralCrc>;
export declare const assembleUnsigned: (calculation: AstralCalculation, chart: AstralChart) => Promise<AstralFile>;
export declare const integrityValid: (file: AstralFile) => Promise<boolean>;
//# sourceMappingURL=integrity.d.ts.map