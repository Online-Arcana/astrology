import { open as openPackage, pack } from "astral-packager";
import { base64url } from "../src/file/codec.js";
import { sign, signatureValid } from "../src/file/authority.js";
import type { AstralFile } from "../src/types/file.js";
import {
  generateTestSigningKey,
  isTestSigningKey,
  saveSigningKey,
  validateSigningKey,
} from "../src/browser/keys.js";
import {
  TEST_PACKAGE_MAGIC,
  TEST_PACKAGE_PASSWORD,
  isTestPackageBytes,
  unwrapTestPackage,
  wrapTestPackage,
} from "../src/testing/artifact.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fakeFile = (): AstralFile => ({
  schema: "astral/1.1.0",
  "astral-calculation": { test: "calculation" },
  "astral-chart": { test: "chart" },
  crc: { test: "crc" },
  authority: null,
} as unknown as AstralFile);

const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
const privateKey = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const signed = await sign(fakeFile(), "security-test", {
  privatePkcs8: `base64url:${base64url(privateKey)}`,
  publicRaw: `base64url:${base64url(publicKey)}`,
}, "2026-08-10T16:00:00.000Z");
assert(await signatureValid(signed), "fresh signature must validate");
assert(signed.authority !== null, "signed file must contain authority");
const wrongKeyId = structuredClone(signed);
const authority = wrongKeyId.authority;
assert(authority !== null, "cloned signed file must retain authority");
wrongKeyId.authority = {
  ...authority,
  keyId: `sha256:${"0".repeat(64)}`,
};
assert(!await signatureValid(wrongKeyId), "authority keyId must match the embedded public key");

const testKey = await generateTestSigningKey();
assert(isTestSigningKey(testKey), "generated testing bundle must carry the exact TEST-ONLY marker and issuer");
let rejected = false;
try {
  await validateSigningKey(testKey);
} catch {
  rejected = true;
}
assert(rejected, "normal signing-key validation must reject TEST-ONLY bundles");
await validateSigningKey(testKey, true);
let persisted = false;
try {
  saveSigningKey(testKey);
  persisted = true;
} catch {
  // Expected: a test key must never enter the production credential vault.
}
assert(!persisted, "TEST-ONLY signing bundles must not be persisted");

const innerMagic = new TextEncoder().encode("ASTRPKGfixture");
const wrapped = wrapTestPackage(innerMagic);
assert(new TextDecoder().decode(wrapped.slice(0, TEST_PACKAGE_MAGIC.length)) === TEST_PACKAGE_MAGIC, "test wrapper must have distinct ASTRTEST1 magic");
assert(isTestPackageBytes(wrapped), "test wrapper must be recognisable");
const unwrapped = unwrapTestPackage(wrapped);
assert(new TextDecoder().decode(unwrapped) === "ASTRPKGfixture", "test wrapper must preserve the exact inner ASTRPKG bytes");

const protectedSource = JSON.stringify({ classification: "ordinary-password-protected-chart" });
const ordinaryPassword = "Ordinary-Real-Chart!Password-8427";
const ordinaryPackage = await pack(protectedSource, ordinaryPassword);
const forgedTestWrapper = wrapTestPackage(ordinaryPackage.bytes);
let publicPasswordOpenedOrdinary = false;
try {
  const opened = await openPackage(unwrapTestPackage(forgedTestWrapper), TEST_PACKAGE_PASSWORD);
  publicPasswordOpenedOrdinary = true;
  opened.id.drop();
} catch {
  // Expected: adding ASTRTEST1 outside a real package does not change its encryption key.
}
assert(!publicPasswordOpenedOrdinary, "ASTRTEST1 must not make an ordinary password-protected package decryptable with the public test password");

const intentionalTestPackage = await pack(protectedSource, TEST_PACKAGE_PASSWORD);
const openedTest = await openPackage(unwrapTestPackage(wrapTestPackage(intentionalTestPackage.bytes)), TEST_PACKAGE_PASSWORD);
try {
  assert(openedTest.source === protectedSource, "the public test password must open only a package intentionally encrypted for test transport");
} finally {
  openedTest.id.drop();
}

console.log("ok 1 - authority keyId is cryptographically bound to publicKey");
console.log("ok 2 - test signing key is unmistakably marked");
console.log("ok 3 - production validation rejects test signing keys");
console.log("ok 4 - explicit test validation accepts a cryptographically sound test key");
console.log("ok 5 - test signing keys cannot enter the credential vault");
console.log("ok 6 - test package wrapper is distinct and lossless");
console.log("ok 7 - wrapping an ordinary encrypted package cannot bypass its real password");
console.log("ok 8 - public test password opens only intentionally test-encrypted transport");
console.log("1..8");
