import type { AstralChart } from "../types/chart.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";
import { sign, type AuthorityKeys } from "./authority.js";
import { assembleUnsigned } from "./integrity.js";

export interface FileAuthorityOptions {
  issuer: string;
  keys: AuthorityKeys;
  generatedAt: string;
}

export const assembleAstralFile = async (
  calculation: AstralCalculation,
  chart: AstralChart,
  authority: FileAuthorityOptions | null = null,
): Promise<AstralFile> => {
  const unsigned = await assembleUnsigned(calculation, chart);
  return authority === null
    ? unsigned
    : sign(unsigned, authority.issuer, authority.keys, authority.generatedAt);
};
