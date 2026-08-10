import { pack } from "astral-packager";
import {
  TEST_PACKAGE_PASSWORD,
  testArtifactStatus,
  wrapTestPackage,
} from "../testing/artifact.js";
import {
  nativeAnchorClick,
  nativeCreateObjectURL,
  nativeRevokeObjectURL,
  testBlobUrls,
} from "./testPackageTransport.js";

const ordinaryPackagedClick = HTMLAnchorElement.prototype.click;

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

const testName = (value: string): string => value.replace(/\.astral$/iu, "-TEST-ONLY.astral");

const directDownload = (name: string, bytes: Uint8Array): void => {
  const copy = bytes.slice();
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = nativeCreateObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = testName(name);
  nativeAnchorClick.call(anchor);
  setTimeout(() => nativeRevokeObjectURL(url), 0);
};

const packageIfVerifiedTest = async (anchor: HTMLAnchorElement, blob: Blob): Promise<void> => {
  const source = await blob.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    ordinaryPackagedClick.call(anchor);
    return;
  }

  const status = await testArtifactStatus(parsed);
  if (status !== "verified_test_key") {
    ordinaryPackagedClick.call(anchor);
    return;
  }

  const result = await pack(source, TEST_PACKAGE_PASSWORD);
  directDownload(anchor.download, wrapTestPackage(result.bytes));
};

// packageFlow owns normal .astral downloads. This final wrapper handles only a
// cryptographically verified test-key artifact; everything else is delegated
// unchanged to the ordinary password-protected packaging path.
HTMLAnchorElement.prototype.click = function testAwarePackagedAstralClick(): void {
  const blob = testBlobUrls.get(this.href);
  const astral = this.download.toLocaleLowerCase("en-GB").endsWith(".astral");
  if (!astral || blob === undefined) {
    ordinaryPackagedClick.call(this);
    return;
  }
  void packageIfVerifiedTest(this, blob).catch(report);
};
