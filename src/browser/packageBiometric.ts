import { open as openPackage } from "astral-packager";
import {
  forgetPackagePassword,
  loadPackagePassword,
} from "./keys.js";
import {
  encryptedPackageFingerprint,
  forgetPackageFingerprint,
  packageFingerprintRemembered,
  rememberPackageFingerprint,
} from "./packageFingerprints.js";
import {
  credentialVaultExistsForUse,
  rememberPackagePasswordWithBiometrics,
  unlockCredentialVaultForUse,
} from "./vaultUi.js";

const magic = "ASTRPKG";
const nativeBlobText = Blob.prototype.text;
const nativeShowModal = HTMLDialogElement.prototype.showModal;
const reconstructed = new WeakMap<Blob, string>();

interface SelectedPackage {
  file: File;
  fingerprint: string;
  bytes: Uint8Array;
}

interface PendingRemember {
  file: File;
  fingerprint: string;
  password: string;
}

let selectedPackage: SelectedPackage | null = null;
let pendingRemember: PendingRemember | null = null;

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const isPackage = (bytes: Uint8Array): boolean => {
  if (bytes.byteLength < magic.length) return false;
  for (let index = 0; index < magic.length; index += 1) {
    if (bytes[index] !== magic.charCodeAt(index)) return false;
  }
  return true;
};

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

const redispatch = (input: HTMLInputElement, unpacked: boolean): void => {
  input.dataset[unpacked ? "astralUnpacked" : "astralBiometricBypass"] = "true";
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const storedPasswordFailure = (cause: unknown): boolean =>
  cause instanceof Error && /wrong password or damaged container/iu.test(cause.message);

const fallBackToPassword = (input: HTMLInputElement): void => {
  redispatch(input, false);
};

const seamlessOpen = async (
  input: HTMLInputElement,
  selected: SelectedPackage,
): Promise<void> => {
  try {
    if (!await credentialVaultExistsForUse()) {
      forgetPackageFingerprint(selected.fingerprint);
      fallBackToPassword(input);
      return;
    }

    await unlockCredentialVaultForUse();
    let password = loadPackagePassword(selected.fingerprint);
    if (password === null) {
      forgetPackageFingerprint(selected.fingerprint);
      fallBackToPassword(input);
      return;
    }

    try {
      const result = await openPackage(selected.bytes, password);
      try {
        reconstructed.set(selected.file, result.source);
        redispatch(input, true);
      } finally {
        result.id.drop();
      }
    } catch (cause: unknown) {
      if (storedPasswordFailure(cause)) {
        forgetPackagePassword(selected.fingerprint);
        forgetPackageFingerprint(selected.fingerprint);
      }
      fallBackToPassword(input);
    } finally {
      password = "";
    }
  } catch {
    // Cancelling or failing biometric verification never locks the user out.
    // The ordinary package-password dialog remains the fallback path.
    fallBackToPassword(input);
  }
};

const inspectSelection = async (input: HTMLInputElement, file: File): Promise<void> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPackage(bytes)) {
    selectedPackage = null;
    redispatch(input, false);
    return;
  }

  const fingerprint = await encryptedPackageFingerprint(bytes);
  const selected = { file, fingerprint, bytes } satisfies SelectedPackage;
  selectedPackage = selected;
  if (!packageFingerprintRemembered(fingerprint)) {
    redispatch(input, false);
    return;
  }
  await seamlessOpen(input, selected);
};

const rememberUi = (dialog: HTMLDialogElement): HTMLLabelElement => {
  let label = dialog.querySelector<HTMLLabelElement>("#astralRememberPasswordLabel");
  if (label !== null) return label;
  label = document.createElement("label");
  label.id = "astralRememberPasswordLabel";
  label.className = "astral-package-remember";
  label.innerHTML = `
    <span>
      <input id="astralRememberPassword" type="checkbox">
      Remember this password behind biometrics on this browser
    </span>
    <small>Optional. The encrypted file SHA-256 is stored in localStorage only as a file fingerprint. The password is encrypted inside the passkey vault.</small>`;
  const status = dialog.querySelector<HTMLElement>("#astralPackageStatus");
  if (status === null) throw new Error("Package password status element is missing");
  status.before(label);
  return label;
};

HTMLDialogElement.prototype.showModal = function biometricPackageDialog(): void {
  if (this.id === "astralPackageDialog") {
    const label = rememberUi(this);
    const checkbox = label.querySelector<HTMLInputElement>("#astralRememberPassword");
    const action = this.querySelector<HTMLButtonElement>("#astralPackageContinue")?.textContent?.trim() ?? "";
    const status = this.querySelector<HTMLElement>("#astralPackageStatus");
    const opening = action === "Open";
    label.hidden = !opening;
    label.style.display = opening ? "grid" : "none";
    if (checkbox !== null) checkbox.checked = false;
    if (opening && status !== null) {
      status.textContent = "The password is discarded after opening unless you explicitly protect it with the optional biometric vault.";
    }
  }
  nativeShowModal.call(this);
};

Blob.prototype.text = function biometricReconstructedText(): Promise<string> {
  const source = reconstructed.get(this);
  return source === undefined ? nativeBlobText.call(this) : Promise.resolve(source);
};

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const dialog = form.closest<HTMLDialogElement>("#astralPackageDialog");
  if (dialog === null) return;
  const action = dialog.querySelector<HTMLButtonElement>("#astralPackageContinue")?.textContent?.trim() ?? "";
  const checkbox = dialog.querySelector<HTMLInputElement>("#astralRememberPassword");
  const password = dialog.querySelector<HTMLInputElement>("#astralPackagePassword")?.value ?? "";
  if (action !== "Open" || checkbox?.checked !== true || password.length === 0 || selectedPackage === null) {
    pendingRemember = null;
    return;
  }
  pendingRemember = {
    file: selectedPackage.file,
    fingerprint: selectedPackage.fingerprint,
    password,
  };
}, true);

document.addEventListener("close", (event) => {
  if (event.target instanceof HTMLDialogElement && event.target.id === "astralPackageDialog") {
    pendingRemember = null;
  }
}, true);

document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== "astralFile") return;
  const file = input.files?.[0];

  if (input.dataset["astralUnpacked"] === "true") {
    const pending = pendingRemember;
    pendingRemember = null;
    selectedPackage = null;
    if (pending !== null && file === pending.file) {
      let password = pending.password;
      void rememberPackagePasswordWithBiometrics(pending.fingerprint, password)
        .then(() => rememberPackageFingerprint(pending.fingerprint))
        .catch(report)
        .finally(() => { password = ""; });
    }
    return;
  }

  if (input.dataset["astralBiometricBypass"] === "true") {
    delete input.dataset["astralBiometricBypass"];
    return;
  }

  if (file === undefined) return;
  event.stopImmediatePropagation();
  void inspectSelection(input, file).catch((cause: unknown) => {
    selectedPackage = null;
    input.value = "";
    report(cause);
  });
}, true);
