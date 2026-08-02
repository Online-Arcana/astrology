import type { BirthData, JsonRef, PlaceData, TimeData } from "./base.js";
import type {
  Ayanamsha,
  AstronomyData,
  CompatibilityMatrix,
  Zodiac,
  ZodiacCalculation,
} from "./astro.js";
import type { AstralChart } from "./chart.js";

export interface CalculationSettings {
  primaryZodiac: Zodiac;
  siderealAyanamsha: Ayanamsha | null;
  interpretationMode: Zodiac;
  primaryHouseSystem: "placidus";
  polarFallback: "porphyry";
  houseSystems: ["placidus", "whole_sign", "equal", "porphyry"];
}

export interface InterpretationUnit {
  id: string;
  zodiac: Zodiac;
  section: string;
  domain: string | null;
  allowedSourceRefs: JsonRef[];
}

export interface InterpretationPlan {
  schema: "astral-interpretation-plan/1.1.0";
  zodiac: Zodiac;
  units: InterpretationUnit[];
}

export interface CalculationProvenance {
  generatedAt: string;
  astralChartsVersion: string;
  astronomia: { repository: string; revision: string; version: string };
  places: { repository: string; revision: string; version: string };
  time: {
    repository: string;
    revision: string;
    version: string;
    timeZoneDatabaseVersion: string;
    calendar: "proleptic_gregorian";
    supportedRange: string;
  };
  astrologyProfile: string;
  aspectProfile: string;
  dignityProfile: string;
  compatibilityProfile: string;
  calculationFingerprint: string;
}

export interface CalculationWarning {
  code: string;
  message: string;
  sourceRefs: JsonRef[];
}

export interface AstralCalculation {
  schema: "astral-calculation/1.1.0";
  subject: {
    providedName: string | null;
    language: string;
    adult: true;
  };
  birth: BirthData;
  place: PlaceData;
  time: TimeData;
  settings: CalculationSettings;
  astronomy: AstronomyData;
  system: ZodiacCalculation;
  compatibility: CompatibilityMatrix & {
    method: "natal_to_sign_archetype";
    profile: "western_compatibility/1.0.0";
  };
  interpretationPlan: InterpretationPlan;
  provenance: CalculationProvenance;
  warnings: CalculationWarning[];
}

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
