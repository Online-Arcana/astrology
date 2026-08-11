import type { AstralCalculation, AstralChart, InterpretationUnit } from "astral-interpreter/web";
export type { AstralCalculation, InterpretationUnit } from "astral-interpreter/web";

export interface AstralCrc {
  schema: "astral-crc/1.0.0";
  canonicalisation: "RFC8785";
  encoding: "utf-8";
  scope: ["schema", "astral-calculation", "astral-chart"];
  byteLength: number;
  sha256: string;
  sha512: string;
  crc32c: string;
}
export type EncodedPublicKey = `base64url:${string}`;
export type EncodedSignature = `base64url:${string}`;
export type KeyId = `sha256:${string}`;
export type SignedDigest = `sha256:${string}`;
export interface AstralAuthority {
  schema: "astral-authority/1.0.0";
  algorithm: "Ed25519";
  canonicalisation: "RFC8785";
  encoding: "utf-8";
  scope: ["schema", "astral-calculation", "astral-chart", "crc"];
  issuer: string;
  keyId: KeyId;
  publicKey: EncodedPublicKey;
  signature: EncodedSignature;
  signedSha256: SignedDigest;
  generatedAt: string;
}
export interface AstralFile {
  schema: "astral/1.1.0";
  "astral-calculation": AstralCalculation;
  "astral-chart": AstralChart;
  crc: AstralCrc;
  authority: AstralAuthority | null;
}
export interface TrustedAuthority {
  issuer: string;
  keyId: string;
  publicKey: string;
  status: "active" | "retired" | "revoked";
}
export interface AstralValidation {
  structure: "valid" | "invalid";
  integrity: "valid" | "modified" | "invalid_crc" | "unsupported";
  authority: "trusted" | "valid_untrusted" | "invalid" | "unsigned" | "unknown_key" | "revoked";
}
