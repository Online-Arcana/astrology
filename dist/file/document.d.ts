import type { AstralChart } from "../types/chart.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";
import { type AuthorityKeys } from "./authority.js";
export interface FileAuthorityOptions {
    issuer: string;
    keys: AuthorityKeys;
    generatedAt: string;
}
export declare const assembleAstralFile: (calculation: AstralCalculation, chart: AstralChart, authority?: FileAuthorityOptions | null) => Promise<AstralFile>;
//# sourceMappingURL=document.d.ts.map