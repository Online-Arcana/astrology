import {
  auditPwd,
  open as openPackage,
  pack,
} from "astral-packager";

interface PasswordRequest {
  mode: "open" | "pack";
  title: string;
  explanation: string;
  error?: string;
}

const packagedPrefix = "ASTRPKG";
const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
const originalAnchorClick = HTMLAnchorElement.prototype.click;
const trackedBlobs = new Map<string, Blob>();
let promptActive = false;

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const packaged = (bytes: Uint8Array): boolean => {
  if (bytes.byteLength < packagedPrefix.length) return false;
  for (let index = 0; index < packagedPrefix.length; index += 1) {
    if (bytes[index] !== packagedPrefix.charCodeAt(index)) return false;
  }
  return true;
};

const safeName = (value: string): string => {
  const cleaned = value
    .replace(/\.(?:astral|json|raw)$/iu, "")
    .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  return `${cleaned.length === 0 ? "chart" : cleaned}.astral`;
};

const directDownload = (name: string, bytes: Uint8Array): void => {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = originalCreateObjectUrl(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName(name);
  originalAnchorClick.call(anchor);
  setTimeout(() => originalRevokeObjectUrl(url), 0);
};

const ensureStyle = (): void => {
  if (element("#astralPackageDialogStyle") !== null) return;
  const style = document.createElement("style");
  style.id = "astralPackageDialogStyle";
  style.textContent = `
    .astral-package-dialog {
      width: min(34rem, calc(100vw - 2rem));
      border: 1px solid #4b426f;
      border-radius: 1.25rem;
      padding: 0;
      background: #17132d;
      color: #f6f0ff;
      box-shadow: 0 1.5rem 5rem rgb(0 0 0 / .55);
    }
    .astral-package-dialog::backdrop { background: rgb(8 6 19 / .78); backdrop-filter: blur(4px); }
    .astral-package-dialog form { display: grid; gap: 1rem; padding: 1.4rem; }
    .astral-package-dialog h2, .astral-package-dialog p { margin: 0; }
    .astral-package-dialog label { display: grid; gap: .45rem; font-weight: 700; }
    .astral-package-dialog input { width: 100%; box-sizing: border-box; }
    .astral-package-dialog .astral-package-status { min-height: 1.5rem; color: #d9caef; }
    .astral-package-dialog .astral-package-error { min-height: 1.5rem; color: #ffb9c4; }
    .astral-package-dialog .actions { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: flex-end; }
  `;
  document.head.append(style);
};

const ensureDialog = (): HTMLDialogElement => {
  const existing = element<HTMLDialogElement>("#astralPackageDialog");
  if (existing !== null) return existing;
  ensureStyle();
  const dialog = document.createElement("dialog");
  dialog.id = "astralPackageDialog";
  dialog.className = "astral-package-dialog";
  dialog.innerHTML = `
    <form method="dialog" autocomplete="off">
      <div>
        <p class="eyebrow">Encrypted .astral container</p>
        <h2 id="astralPackageTitle">Password required</h2>
      </div>
      <p id="astralPackageExplanation"></p>
      <label>Password
        <input id="astralPackagePassword" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false">
      </label>
      <label id="astralPackageConfirmLabel">Confirm password
        <input id="astralPackageConfirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false">
      </label>
      <p id="astralPackageError" class="astral-package-error" role="alert"></p>
      <p id="astralPackageStatus" class="astral-package-status" aria-live="polite"></p>
      <div class="actions">
        <button id="astralPackageCancel" type="button" class="ghost">Cancel</button>
        <button id="astralPackageContinue" type="submit">Continue</button>
      </div>
    </form>`;
  document.body.append(dialog);
  return dialog;
};

const clearDialogSecrets = (): void => {
  const password = element<HTMLInputElement>("#astralPackagePassword");
  const confirm = element<HTMLInputElement>("#astralPackageConfirm");
  if (password !== null) password.value = "";
  if (confirm !== null) confirm.value = "";
};

const requestPassword = async (request: PasswordRequest): Promise<string | null> => {
  if (promptActive) throw new Error("Finish the current password request first");
  promptActive = true;
  const dialog = ensureDialog();
  const form = dialog.querySelector<HTMLFormElement>("form");
  const title = element<HTMLElement>("#astralPackageTitle");
  const explanation = element<HTMLElement>("#astralPackageExplanation");
  const password = element<HTMLInputElement>("#astralPackagePassword");
  const confirm = element<HTMLInputElement>("#astralPackageConfirm");
  const confirmLabel = element<HTMLElement>("#astralPackageConfirmLabel");
  const error = element<HTMLElement>("#astralPackageError");
  const status = element<HTMLElement>("#astralPackageStatus");
  const cancel = element<HTMLButtonElement>("#astralPackageCancel");
  const submit = element<HTMLButtonElement>("#astralPackageContinue");
  if (form === null || title === null || explanation === null || password === null || confirm === null
    || confirmLabel === null || error === null || status === null || cancel === null || submit === null) {
    promptActive = false;
    throw new Error("Password dialog is incomplete");
  }

  clearDialogSecrets();
  title.textContent = request.title;
  explanation.textContent = request.explanation;
  error.textContent = request.error ?? "";
  status.textContent = request.mode === "pack"
    ? "The password is used only for this package and is never saved."
    : "The password is used only to open this file and is never saved.";
  confirmLabel.hidden = request.mode === "open";
  submit.textContent = request.mode === "pack" ? "Package" : "Open";

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null): void => {
      if (settled) return;
      settled = true;
      form.removeEventListener("submit", onSubmit);
      cancel.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onDialogCancel);
      clearDialogSecrets();
      if (dialog.open) dialog.close();
      promptActive = false;
      resolve(value);
    };
    const onCancel = (): void => finish(null);
    const onDialogCancel = (event: Event): void => {
      event.preventDefault();
      finish(null);
    };
    const onSubmit = (event: SubmitEvent): void => {
      event.preventDefault();
      const entered = password.value;
      if (entered.length === 0) {
        error.textContent = "Password is required.";
        return;
      }
      if (request.mode === "pack") {
        if (entered !== confirm.value) {
          error.textContent = "The passwords do not match.";
          return;
        }
        const audit = auditPwd(entered);
        if (!audit.ok) {
          error.textContent = audit.warning;
          return;
        }
      }
      finish(entered);
    };
    form.addEventListener("submit", onSubmit);
    cancel.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onDialogCancel);
    dialog.showModal();
    password.focus();
  });
};

const showProgress = (message: string): void => {
  const status = element<HTMLElement>("#astralPackageStatus");
  if (status !== null) status.textContent = message;
};

const packageBlob = async (name: string, blob: Blob): Promise<void> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (packaged(bytes)) {
    directDownload(name, bytes);
    return;
  }
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let password = await requestPassword({
    mode: "pack",
    title: "Protect this .astral file",
    explanation: "Choose the password required to decrypt this packaged chart. It will not be stored anywhere.",
  });
  if (password === null) return;
  try {
    showProgress("Preparing encrypted package…");
    const result = await pack(source, password, ({ pct, stage }) => {
      showProgress(`${pct}% · ${stage}`);
    });
    directDownload(name, result.bytes);
  } finally {
    password = "";
    clearDialogSecrets();
  }
};

const replaceInputFile = (input: HTMLInputElement, file: File): void => {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dataset["astralUnpacked"] = "true";
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const unpackFile = async (input: HTMLInputElement, file: File, bytes: Uint8Array): Promise<void> => {
  let lastError: string | undefined;
  for (;;) {
    let password = await requestPassword({
      mode: "open",
      title: "Open encrypted .astral file",
      explanation: "Enter the package password. Decryption, decompression and protobuf decoding happen locally in this browser.",
      ...(lastError === undefined ? {} : { error: lastError }),
    });
    if (password === null) {
      input.value = "";
      return;
    }
    try {
      showProgress("Decrypting and reconstructing the chart…");
      const result = await openPackage(bytes, password);
      try {
        replaceInputFile(input, new File([result.source], file.name, {
          type: "application/json;charset=utf-8",
          lastModified: file.lastModified,
        }));
      } finally {
        result.id.drop();
      }
      return;
    } catch (cause: unknown) {
      lastError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      password = "";
      clearDialogSecrets();
    }
  }
};

const handleSelectedFile = async (input: HTMLInputElement, file: File): Promise<void> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!packaged(bytes)) {
    replaceInputFile(input, file);
    return;
  }
  await unpackFile(input, file, bytes);
};

URL.createObjectURL = ((object: Blob | MediaSource): string => {
  const url = originalCreateObjectUrl(object);
  if (object instanceof Blob) trackedBlobs.set(url, object);
  return url;
}) as typeof URL.createObjectURL;

URL.revokeObjectURL = ((url: string): void => {
  originalRevokeObjectUrl(url);
  setTimeout(() => trackedBlobs.delete(url), 60_000);
}) as typeof URL.revokeObjectURL;

HTMLAnchorElement.prototype.click = function packageAstralClick(): void {
  const blob = trackedBlobs.get(this.href);
  if (!this.download.toLocaleLowerCase("en-GB").endsWith(".astral") || blob === undefined) {
    originalAnchorClick.call(this);
    return;
  }
  void packageBlob(this.download, blob).catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause);
    void requestPassword({
      mode: "open",
      title: "Packaging failed",
      explanation: "The chart was not downloaded because packaging failed.",
      error: message,
    });
  });
};

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.id !== "astralFile") return;
  if (target.dataset["astralUnpacked"] === "true") {
    delete target.dataset["astralUnpacked"];
    return;
  }
  const file = target.files?.[0];
  if (file === undefined) return;
  event.stopImmediatePropagation();
  void handleSelectedFile(target, file).catch((cause: unknown) => {
    target.value = "";
    const message = cause instanceof Error ? cause.message : String(cause);
    void requestPassword({
      mode: "open",
      title: "Could not open .astral file",
      explanation: "The selected chart could not be unpacked.",
      error: message,
    });
  });
}, true);

const updateDownloadLabels = (): void => {
  const generated = element<HTMLButtonElement>("#downloadGenerated");
  const opened = element<HTMLButtonElement>("#downloadOpened");
  if (generated !== null) generated.textContent = "Package and download .astral";
  if (opened !== null) opened.textContent = "Package and download .astral";
  for (const button of document.querySelectorAll<HTMLButtonElement>("#chartHistory button")) {
    if (button.textContent?.trim() === "Download") button.textContent = "Package and download";
  }
};

updateDownloadLabels();
new MutationObserver(updateDownloadLabels).observe(document.body, { childList: true, subtree: true });
