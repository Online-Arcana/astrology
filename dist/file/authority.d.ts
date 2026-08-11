import type { AstralFile } from "../types/file.js";
export interface AuthorityKeys {
    privatePkcs8: string;
    publicRaw: string;
}
export declare const sign: (file: AstralFile, issuer: string, keys: AuthorityKeys, generatedAt: string) => Promise<AstralFile>;
export declare const signatureValid: (file: AstralFile) => Promise<boolean>;
//# sourceMappingURL=authority.d.ts.map