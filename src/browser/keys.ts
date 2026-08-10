import { base64url, ownedBuffer, unbase64url } from "../file/codec.js";
import { digest } from "../file/hash.js";
import {
  TEST_KEY_ISSUER_PREFIX,
  TEST_SIGNING_KEY_SCHEMA,
} from "../testing/artifact.js";
import type { AuthorityKeys } from "../file/authority.js";
import type { KeyId } from "../types/file.js";
import { browserVault, type BrowserSecretSnapshot } from "./vault.js";

const defaultIssuer = "astral-browser/local";

export interface TestSigningKeyMarker {
  schema: typeof TEST_SIGNING_KEY_SCHEMA;
  purpose: "chart-ui-testing";
  warning: "TEST_ONLY_NOT_FOR_PRODUCTION";
}

export interface BrowserSigningKey extends AuthorityKeys {
  issuer: string;
  testOnly?: TestSigningKeyMarker;
}

let sessionOpenAiKey = "";
let sessionSigningKey: BrowserSigningKey | null = null;
let sessionPackagePasswords: Record<string, string> = {};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const required = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required`);
  return value.trim();
};

const testMarker = (value: unknown): TestSigningKeyMarker | undefined => {
  if (value === undefined) return undefined;
  if (!record(value)
    || value["schema"] !== TEST_SIGNING_KEY_SCHEMA
    || value["purpose"] !== "chart-ui-testing"
    || value["warning"] !== "TEST_ONLY_NOT_FOR_PRODUCTION") {
    throw new Error("Testing signing-key marker is malformed");
  }
  return {
    schema: TEST_SIGNING_KEY_SCHEMA,
    purpose: "chart-ui-testing",
    warning: "TEST_ONLY_NOT_FOR_PRODUCTION",
  };
};

const packagePasswords = (value: unknown): Record<string, string> => {
  if (!record(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, password]) =>
    /^sha256:[a-f0-9]{64}$/u.test(id)
    && typeof password === "string"
    && password.length > 0)) as Record<string, string>;
};

export const parseSigningKey = (text: string): BrowserSigningKey => {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new Error("Stored signing key is not a JSON key bundle", { cause });
  }
  if (!record(value)) throw new Error("Stored signing key must be a JSON object");
  const marker = testMarker(value["testOnly"]);
  return {
    issuer: required(value["issuer"], "Signing key issuer"),
    privatePkcs8: required(value["privatePkcs8"], "Signing privatePkcs8"),
    publicRaw: required(value["publicRaw"], "Signing publicRaw"),
    ...(marker === undefined ? {} : { testOnly: marker }),
  };
};

export const isTestSigningKey = (key: Pick<BrowserSigningKey, "issuer" | "testOnly">): boolean =>
  key.testOnly?.schema === TEST_SIGNING_KEY_SCHEMA
  && key.testOnly.purpose === "chart-ui-testing"
  && key.testOnly.warning === "TEST_ONLY_NOT_FOR_PRODUCTION"
  && key.issuer.startsWith(TEST_KEY_ISSUER_PREFIX);

const publicRawFromPrivate = async (privatePkcs8: string): Promise<string> => {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    ownedBuffer(unbase64url(privatePkcs8)),
    { name: "Ed25519" },
    true,
    ["sign"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  if (typeof jwk.x !== "string" || jwk.x.length === 0) {
    throw new Error("The Ed25519 private key did not expose its public component");
  }
  return `base64url:${jwk.x}`;
};

/** Accept a complete JSON bundle or a bare base64url PKCS8 private key. */
export const readSigningKey = async (text: string): Promise<BrowserSigningKey> => {
  const selected = text.trim();
  if (selected.length === 0) throw new Error("Signing key is required");
  if (selected.startsWith("{")) return parseSigningKey(selected);
  const privatePkcs8 = selected.startsWith("base64url:") ? selected : `base64url:${selected}`;
  return {
    issuer: defaultIssuer,
    privatePkcs8,
    publicRaw: await publicRawFromPrivate(privatePkcs8),
  };
};

export const signingKeyText = (key: BrowserSigningKey): string => JSON.stringify(key, null, 2);

export const signingKeyId = async (key: Pick<BrowserSigningKey, "publicRaw">): Promise<KeyId> =>
  `sha256:${await digest("SHA-256", unbase64url(key.publicRaw))}` as KeyId;

export const validateSigningKey = async (
  key: BrowserSigningKey,
  allowTestOnly = false,
): Promise<void> => {
  if (isTestSigningKey(key) && !allowTestOnly) {
    throw new Error("TEST-ONLY signing bundles are not valid production signing bundles and cannot be used for normal generation or re-signing");
  }
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    ownedBuffer(unbase64url(key.privatePkcs8)),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const publicKey = await crypto.subtle.importKey(
    "raw",
    ownedBuffer(unbase64url(key.publicRaw)),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const message = new TextEncoder().encode("astral-browser-key-check");
  const signature = await crypto.subtle.sign("Ed25519", privateKey, ownedBuffer(message));
  const valid = await crypto.subtle.verify("Ed25519", publicKey, signature, ownedBuffer(message));
  if (!valid) throw new Error("Signing private and public keys do not form a valid Ed25519 pair");
};

export const generateSigningKey = async (
  issuer = defaultIssuer,
): Promise<BrowserSigningKey> => {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    issuer,
    privatePkcs8: `base64url:${base64url(privatePkcs8)}`,
    publicRaw: `base64url:${base64url(publicRaw)}`,
  };
};

export const generateTestSigningKey = async (): Promise<BrowserSigningKey> => ({
  ...await generateSigningKey(`${TEST_KEY_ISSUER_PREFIX}${crypto.randomUUID()}`),
  testOnly: {
    schema: TEST_SIGNING_KEY_SCHEMA,
    purpose: "chart-ui-testing",
    warning: "TEST_ONLY_NOT_FOR_PRODUCTION",
  },
});

const snapshot = (): BrowserSecretSnapshot => ({
  openAiKey: sessionOpenAiKey,
  signingKeyText: sessionSigningKey === null ? null : signingKeyText(sessionSigningKey),
  packagePasswords: { ...sessionPackagePasswords },
});

const persist = (): void => {
  void browserVault.save(snapshot()).catch(() => {
    // The current page session remains usable if encrypted persistence fails.
    // Vault controls report unlock/create failures explicitly to the user.
  });
};

export const loadOpenAiKey = (): string => sessionOpenAiKey;

export const saveOpenAiKey = (value: string): void => {
  sessionOpenAiKey = value.trim();
  persist();
};

export const loadSigningKey = (): BrowserSigningKey | null => sessionSigningKey;

export const saveSigningKey = (key: BrowserSigningKey | null): void => {
  if (key !== null && isTestSigningKey(key)) {
    throw new Error("TEST-ONLY signing bundles are ephemeral and cannot be saved in the production credential vault");
  }
  sessionSigningKey = key;
  persist();
};

export const loadPackagePassword = (encryptedPackageSha256: string): string | null =>
  sessionPackagePasswords[encryptedPackageSha256] ?? null;

export const savePackagePassword = (encryptedPackageSha256: string, password: string): void => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(encryptedPackageSha256)) {
    throw new Error("Encrypted package SHA-256 is invalid");
  }
  if (password.length === 0) throw new Error("Package password is empty");
  sessionPackagePasswords = {
    ...sessionPackagePasswords,
    [encryptedPackageSha256]: password,
  };
  persist();
};

export const forgetPackagePassword = (encryptedPackageSha256: string): void => {
  if (!(encryptedPackageSha256 in sessionPackagePasswords)) return;
  const next = { ...sessionPackagePasswords };
  delete next[encryptedPackageSha256];
  sessionPackagePasswords = next;
  persist();
};

export const packagePasswordSnapshot = (): Readonly<Record<string, string>> => ({
  ...sessionPackagePasswords,
});

export const browserSecretSnapshot = (): BrowserSecretSnapshot => snapshot();

export const applyBrowserSecretSnapshot = (value: BrowserSecretSnapshot): void => {
  sessionOpenAiKey = value.openAiKey.trim();
  if (value.signingKeyText === null || value.signingKeyText.trim().length === 0) {
    sessionSigningKey = null;
  } else {
    const selected = parseSigningKey(value.signingKeyText);
    sessionSigningKey = isTestSigningKey(selected) ? null : selected;
  }
  sessionPackagePasswords = packagePasswords(value.packagePasswords);
};

export const clearBrowserSecretSession = (): void => {
  sessionOpenAiKey = "";
  sessionSigningKey = null;
  sessionPackagePasswords = {};
};
