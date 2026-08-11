import { open as openPackage } from "astral-packager";
import {
  TEST_PACKAGE_PASSWORD,
  isTestPackageBytes,
  testArtifactStatus,
  unwrapTestPackage,
} from "../testing/artifact.js";

export const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
export const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
export const nativeAnchorClick = HTMLAnchorElement.prototype.click;
export const testBlobUrls = new Map<string, Blob>();

const nativeBlobText = Blob.prototype.text;
const reconstructed = new WeakMap<Blob, string>();

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const report = (cause: unknown): void => {
  const message = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  const card = element<HTMLElement>("#errorCard");
  const output = element<HTMLElement>("#errorMessage");
  if (card === null || output === null) {
    console.error(message);
    return;
  }
  output.textContent = message;
  card.classList.remove("hidden");
  card.scrollIntoView({ behavior: "smooth", block: "start" });
};

Blob.prototype.text = function testPackageReconstructedText(): Promise<string> {
  const source = reconstructed.get(this);
  return source === undefined ? nativeBlobText.call(this) : Promise.resolve(source);
};

URL.createObjectURL = ((object: Blob | MediaSource): string => {
  const url = nativeCreateObjectURL(object);
  if (object instanceof Blob) testBlobUrls.set(url, object);
  return url;
}) as typeof URL.createObjectURL;

URL.revokeObjectURL = ((url: string): void => {
  nativeRevokeObjectURL(url);
  setTimeout(() => testBlobUrls.delete(url), 60_000);
}) as typeof URL.revokeObjectURL;

const openVerifiedTestPackage = async (
  input: HTMLInputElement,
  file: File,
  bytes: Uint8Array,
): Promise<void> => {
  const result = await openPackage(unwrapTestPackage(bytes), TEST_PACKAGE_PASSWORD);
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.source) as unknown;
    } catch (cause) {
      throw new Error("TEST-ONLY package did not reconstruct valid JSON", { cause });
    }
    const status = await testArtifactStatus(parsed);
    if (status !== "verified_test_key") {
      throw new Error("TEST-ONLY package bypass rejected: the inner chart is not a cryptographically verified test-key artifact");
    }
    reconstructed.set(file, result.source);
    input.dataset["astralUnpacked"] = "true";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } finally {
    result.id.drop();
  }
};

// This listener is installed before the biometric/package handlers. Only the
// distinct ASTRTEST1 wrapper is eligible for the public test password. Prefixing
// an ordinary encrypted package does not help: ASTRPKG decryption still has to
// succeed under the fixed test password, and the reconstructed chart must then
// pass CRC, key-id, signed-marker and Ed25519 verification before it is exposed.
document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== "astralFile") return;
  if (input.dataset["astralUnpacked"] === "true" || input.dataset["astralBiometricBypass"] === "true") return;
  if (input.dataset["astralTestChecked"] === "true") {
    delete input.dataset["astralTestChecked"];
    return;
  }
  const file = input.files?.[0];
  if (file === undefined) return;

  event.stopImmediatePropagation();
  void (async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isTestPackageBytes(bytes)) {
      input.dataset["astralTestChecked"] = "true";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    await openVerifiedTestPackage(input, file, bytes);
  })().catch((cause: unknown) => {
    input.value = "";
    report(cause);
  });
}, true);
