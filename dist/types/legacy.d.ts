import type { AstralAuthority, AstralCrc, AstralFile } from "./file.js";
export interface LegacyAstralCalculation {
    schema: "astral-calculation/1.0.0";
    [key: string]: unknown;
}
export interface LegacyAstralChart {
    schema: "astral-chart/1.0.0";
    [key: string]: unknown;
}
export interface LegacyAstralFile {
    schema: "astral/1.0.0";
    "astral-calculation": LegacyAstralCalculation;
    "astral-chart": LegacyAstralChart;
    crc: AstralCrc;
    authority: AstralAuthority | null;
}
export type ReadableAstralFile = AstralFile | LegacyAstralFile;
//# sourceMappingURL=legacy.d.ts.map