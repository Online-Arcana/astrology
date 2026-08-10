import { signatureValid } from "../file/authority.js";
import { integrityValid } from "../file/integrity.js";
import type { AstralFile } from "../types/file.js";
import { isAstralFile } from "../file/validate.js";

export const TEST_ARTIFACT_SCHEMA = "astral-test-artifact/1.0.0" as const;
export const TEST_SIGNING_KEY_SCHEMA = "astral-test-signing-key/1.0.0" as const;
export const TEST_KEY_ISSUER_PREFIX = "astral-browser/TEST-ONLY/" as const;
export const TEST_PACKAGE_MAGIC = "ASTRTEST1" as const;
export const TEST_PACKAGE_PASSWORD = "ASTRAL-TEST-ONLY-PUBLIC-PASSWORD-NO-CONFIDENTIALITY" as const;

export type TestArtifactStatus =
  | "none"
  | "verified_test_key"
  | "verified_existing_key"
  | "invalid";

const text = new TextEncoder();
const packageMagic = text.encode(TEST_PACKAGE_MAGIC);
const innerMagic = text.encode("ASTRPKG");

const hasPrefix = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  if (bytes.byteLength < prefix.byteLength) return false;
  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
};

export const isTestPackageBytes = (bytes: Uint8Array): boolean => hasPrefix(bytes, packageMagic);

export const wrapTestPackage = (bytes: Uint8Array): Uint8Array => {
  if (!hasPrefix(bytes, innerMagic)) throw new Error("Test package payload is not an ASTRPKG container");
  const output = new Uint8Array(packageMagic.byteLength + bytes.byteLength);
  output.set(packageMagic, 0);
  output.set(bytes, packageMagic.byteLength);
  return output;
};

export const unwrapTestPackage = (bytes: Uint8Array): Uint8Array => {
  if (!isTestPackageBytes(bytes)) throw new Error("File is not an ASTRTEST1 test package");
  const inner = bytes.slice(packageMagic.byteLength);
  if (!hasPrefix(inner, innerMagic)) throw new Error("Test package does not contain an ASTRPKG payload");
  return inner;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const markerValid = (value: unknown): value is NonNullable<AstralFile["astral-chart"]["provenance"]["testArtifact"]> => {
  if (!record(value)) return false;
  return value["schema"] === TEST_ARTIFACT_SCHEMA
    && value["purpose"] === "chart-ui-testing"
    && value["warning"] === "TEST_ONLY_NOT_FOR_PRODUCTION"
    && value["interpretation"] === "lorem_ipsum_no_llm"
    && (value["signingMode"] === "test_key" || value["signingMode"] === "existing_key")
    && typeof value["signingKeyId"] === "string"
    && /^sha256:[0-9a-f]{64}$/u.test(value["signingKeyId"])
    && typeof value["nonce"] === "string"
    && value["nonce"].length >= 8;
};

export const testArtifactStatus = async (value: unknown): Promise<TestArtifactStatus> => {
  if (!isAstralFile(value)) return "none";
  const file = value;
  const marker = file["astral-chart"].provenance.testArtifact;
  const authority = file.authority;
  const testIssuer = authority?.issuer.startsWith(TEST_KEY_ISSUER_PREFIX) === true;

  if (marker === undefined && !testIssuer) return "none";
  if (!markerValid(marker) || authority === null) return "invalid";
  if (marker.signingKeyId !== authority.keyId) return "invalid";
  if (marker.signingMode === "test_key" && !testIssuer) return "invalid";
  if (marker.signingMode === "existing_key" && testIssuer) return "invalid";

  try {
    if (!await integrityValid(file)) return "invalid";
    if (!await signatureValid(file)) return "invalid";
  } catch {
    return "invalid";
  }

  return marker.signingMode === "test_key" ? "verified_test_key" : "verified_existing_key";
};

export const testArtifactMarker = (
  signingMode: "test_key" | "existing_key",
  signingKeyId: string,
  nonce: string,
): NonNullable<AstralFile["astral-chart"]["provenance"]["testArtifact"]> => ({
  schema: TEST_ARTIFACT_SCHEMA,
  purpose: "chart-ui-testing",
  warning: "TEST_ONLY_NOT_FOR_PRODUCTION",
  interpretation: "lorem_ipsum_no_llm",
  signingMode,
  signingKeyId,
  nonce,
});
