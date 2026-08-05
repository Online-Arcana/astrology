import { digest } from "../file/hash.js";

const storageKey = "astral.package-fingerprints/1";
const fingerprintPattern = /^sha256:[a-f0-9]{64}$/u;

const readFingerprints = (): Set<string> => {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string =>
      typeof value === "string" && fingerprintPattern.test(value)));
  } catch {
    return new Set();
  }
};

const writeFingerprints = (values: Set<string>): void => {
  if (values.size === 0) {
    localStorage.removeItem(storageKey);
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify([...values].sort()));
};

/** SHA-256 identity of the exact encrypted package bytes selected by the user. */
export const encryptedPackageFingerprint = async (bytes: Uint8Array): Promise<string> =>
  `sha256:${await digest("SHA-256", bytes)}`;

export const packageFingerprintRemembered = (value: string): boolean =>
  fingerprintPattern.test(value) && readFingerprints().has(value);

export const rememberPackageFingerprint = (value: string): void => {
  if (!fingerprintPattern.test(value)) throw new Error("Encrypted package fingerprint is invalid");
  const values = readFingerprints();
  values.add(value);
  writeFingerprints(values);
};

export const forgetPackageFingerprint = (value: string): void => {
  const values = readFingerprints();
  if (!values.delete(value)) return;
  writeFingerprints(values);
};

export const clearPackageFingerprints = (): void => {
  localStorage.removeItem(storageKey);
};
