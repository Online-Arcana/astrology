import { compatibilityDomains } from "../compat/catalogue.js";
import type {
  AstralAuthority,
  AstralFile,
  AstralValidation,
  TrustedAuthority,
} from "../types/file.js";
import { signatureValid } from "./authority.js";
import { canonicalise } from "./canonical.js";
import { integrityValid } from "./integrity.js";
import { compatibilityValid, generatedNamePattern, rootShapeValid } from "./invariants.js";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactArray = (value: unknown, expected: readonly string[]): boolean =>
  Array.isArray(value)
  && value.length === expected.length
  && value.every((item, index) => item === expected[index]);

const hex = (value: unknown, length: number): boolean =>
  typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`, "u").test(value);

const authorityShape = (value: unknown): value is AstralAuthority => {
  if (!record(value)) return false;
  return value["schema"] === "astral-authority/1.0.0"
    && value["algorithm"] === "Ed25519"
    && value["canonicalisation"] === "RFC8785"
    && value["encoding"] === "utf-8"
    && exactArray(value["scope"], ["schema", "astral-calculation", "astral-chart", "crc"])
    && typeof value["issuer"] === "string"
    && /^sha256:[0-9a-f]{64}$/u.test(String(value["keyId"]))
    && /^base64url:[A-Za-z0-9_-]+$/u.test(String(value["publicKey"]))
    && /^base64url:[A-Za-z0-9_-]+$/u.test(String(value["signature"]))
    && /^sha256:[0-9a-f]{64}$/u.test(String(value["signedSha256"]))
    && typeof value["generatedAt"] === "string";
};

const crcShape = (value: unknown): boolean => {
  if (!record(value)) return false;
  const byteLength = value["byteLength"];
  return value["schema"] === "astral-crc/1.0.0"
    && value["canonicalisation"] === "RFC8785"
    && value["encoding"] === "utf-8"
    && exactArray(value["scope"], ["schema", "astral-calculation", "astral-chart"])
    && typeof byteLength === "number"
    && Number.isSafeInteger(byteLength)
    && byteLength >= 0
    && hex(value["sha256"], 64)
    && hex(value["sha512"], 128)
    && hex(value["crc32c"], 8);
};

const compatibilityShape = (file: AstralFile): boolean => {
  for (const zodiac of ["tropical", "sidereal"] as const) {
    const matrix = file["astral-calculation"].compatibility[zodiac];
    if (matrix.zodiac !== zodiac) return false;
    for (const domain of compatibilityDomains) {
      const scores = matrix.domains[domain];
      if (scores.domain !== domain || !compatibilityValid(scores)) return false;
    }
  }
  return true;
};

const interpretationPlanShape = (file: AstralFile): boolean => {
  const plan = file["astral-calculation"].interpretationPlan;
  if (plan.schema !== "astral-interpretation-plan/1.0.0" || !Array.isArray(plan.units)) return false;
  const ids = plan.units.map(({ id }) => id);
  return ids.length > 0
    && ids.every((id) => typeof id === "string" && id.length > 0)
    && new Set(ids).size === ids.length
    && plan.units.every((unit) => Array.isArray(unit.allowedSourceRefs));
};

const chartShape = (file: AstralFile): boolean => {
  const chart = file["astral-chart"];
  if (chart.schema !== "astral-chart/1.0.0") return false;
  if (chart.tropical.zodiac !== "tropical" || chart.sidereal.zodiac !== "sidereal") return false;
  if (chart.compatibility.tropical.zodiac !== "tropical" || chart.compatibility.sidereal.zodiac !== "sidereal") return false;
  const name = chart.subject.name;
  if (name.source === "generated" && !generatedNamePattern.test(name.value)) return false;
  return name.value.length > 0 && Array.isArray(name.sourceRefs);
};

export const isAstralFile = (value: unknown): value is AstralFile => {
  if (!record(value)) return false;
  const file = value as unknown as AstralFile;
  try {
    return rootShapeValid(file)
      && file["astral-calculation"]?.schema === "astral-calculation/1.0.0"
      && chartShape(file)
      && crcShape(file.crc)
      && (file.authority === null || authorityShape(file.authority))
      && interpretationPlanShape(file)
      && compatibilityShape(file);
  } catch {
    return false;
  }
};

export const parseAstralFile = (value: unknown): AstralFile => {
  if (!isAstralFile(value)) throw new TypeError("Value is not a structurally valid astral/1.0.0 file");
  return value;
};

export const decodeAstralFile = (text: string): AstralFile => {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new TypeError("Astral file is not valid JSON", { cause });
  }
  return parseAstralFile(value);
};

export const encodeAstralFile = (file: AstralFile, pretty = false): string => {
  parseAstralFile(file);
  return pretty ? `${JSON.stringify(file, null, 2)}\n` : canonicalise(file);
};

const authorityStatus = async (
  file: AstralFile,
  trusted: readonly TrustedAuthority[],
): Promise<AstralValidation["authority"]> => {
  const authority = file.authority;
  if (authority === null) return "unsigned";
  let valid: boolean;
  try {
    valid = await signatureValid(file);
  } catch {
    return "invalid";
  }
  if (!valid) return "invalid";
  if (trusted.length === 0) return "valid_untrusted";
  const known = trusted.find(({ keyId }) => keyId === authority.keyId);
  if (!known) return "unknown_key";
  if (known.status === "revoked") return "revoked";
  if (known.issuer !== authority.issuer || known.publicKey !== authority.publicKey) return "unknown_key";
  return known.status === "active" ? "trusted" : "valid_untrusted";
};

export const validateAstralFile = async (
  value: unknown,
  trusted: readonly TrustedAuthority[] = [],
): Promise<AstralValidation> => {
  if (!isAstralFile(value)) {
    return { structure: "invalid", integrity: "invalid_crc", authority: "invalid" };
  }
  const file = value;
  let integrity: AstralValidation["integrity"];
  try {
    integrity = await integrityValid(file) ? "valid" : "modified";
  } catch {
    integrity = "invalid_crc";
  }
  return {
    structure: "valid",
    integrity,
    authority: await authorityStatus(file, trusted),
  };
};
