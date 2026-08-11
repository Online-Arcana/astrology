import type { AstralFile, AstralValidation, TrustedAuthority } from "../types/file.js";
import type { LegacyAstralFile, ReadableAstralFile } from "../types/legacy.js";
export declare const isAstralFile: (value: unknown) => value is AstralFile;
export declare const isLegacyAstralFile: (value: unknown) => value is LegacyAstralFile;
export declare const parseAstralFile: (value: unknown) => AstralFile;
export declare const parseReadableAstralFile: (value: unknown) => ReadableAstralFile;
export declare const decodeAstralFile: (text: string) => AstralFile;
export declare const decodeReadableAstralFile: (text: string) => ReadableAstralFile;
export declare const encodeAstralFile: (file: AstralFile, pretty?: boolean) => string;
export declare const validateAstralFile: (value: unknown, trusted?: readonly TrustedAuthority[]) => Promise<AstralValidation>;
//# sourceMappingURL=validate.d.ts.map