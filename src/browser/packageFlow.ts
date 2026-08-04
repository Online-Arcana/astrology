import {
  auditPwd,
  open as openPackage,
  pack,
} from "astral-packager";

interface PasswordTask {
  mode: "open" | "pack";
  title: string;
  explanation: string;
  run(password: string, progress: (message: string) => void): Promise<void>;
}

interface PasswordDialog {
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  title: HTMLElement;
  explanation: HTMLElement;
  password: HTMLInputElement;
  confirm: HTMLInputElement;
  confirmLabel: HTMLElement;
  error: HTMLElement;
  status: HTMLElement;
  cancel: HTMLButtonElement;
  submit: HTMLButtonElement;
}

const packagedPrefix = "ASTRPKG";
const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
const originalAnchorClick = HTMLAnchorElement.prototype.click;
const originalBlobText = Blob.prototype.text;
const trackedBlobs = new Map<string, Blob>();
const unpackedSources = new WeakMap<Blob, string>();
let passwordTaskActive = false;

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
  const copy = bytes.slice();
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = originalCreateObjectUrl(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName(name);
  originalAnchorClick.call(anchor);
  setTimeout(() => originalRevokeObjectUrl(url), 0);
};

const reportPageError = (cause: unknown): void => {
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

const ensureDialog = (): PasswordDialog => {
  let dialog = element<HTMLDialogElement>("#astralPackageDialog");
  if (dialog === null) {
    ensureStyle();
    dialog = document.createElement("dialog");
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
          <input id="astralPackagePassword" type="password" autocomplete="off" autocapitalize="none" spellcheck="false">
        </label>
        <label id="astralPackageConfirmLabel">Confirm password
          <input id="astralPackageConfirm" type="password" autocomplete="off" autocapitalize="none" spellcheck="false">
        </label>
        <p id="astralPackageError" class="astral-package-error" role="alert"></p>
        <p id="astralPackageStatus" class="astral-package-status" aria-live="polite"></p>
        <div class="actions">
          <button id="astralPackageCancel" type="button" class="ghost">Cancel</button>
          <button id="astralPackageContinue" type="submit">Continue</button>
        </div>
      </form>`;
    document.body.append(dialog);
  }

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
    throw new Error("Password dialog is incomplete");
  }
  return { dialog, form, title, explanation, password, confirm, confirmLabel, error, status, cancel, submit };
};

const clearSecrets = ({ password, confirm }: PasswordDialog): void => {
  password.value = "";
  confirm.value = "";
};

const setWorking = (ui: PasswordDialog, working: boolean): void => {
  ui.password.disabled = working;
  ui.confirm.disabled = working;
  ui.cancel.disabled = working;
  ui.submit.disabled = working;
};

const runPasswordTask = async (task: PasswordTask): Promise<boolean> => {
  if (passwordTaskActive) throw new Error("Finish the current password operation first");
  passwordTaskActive = true;
  const ui = ensureDialog();
  clearSecrets(ui);
  setWorking(ui, false);
  ui.title.textContent = task.title;
  ui.explanation.textContent = task.explanation;
  ui.confirmLabel.hidden = task.mode === "open";
  ui.error.textContent = "";
  ui.status.textContent = task.mode === "pack"
    ? "The password is used only for this package and is never saved."
    : "The password is used only to open this file and is never saved.";
  ui.submit.textContent = task.mode === "pack" ? "Package" : "Open";

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (completed: boolean): void => {
      if (settled) return;
      settled = true;
      ui.form.removeEventListener("submit", onSubmit);
      ui.cancel.removeEventListener("click", onCancel);
      ui.dialog.removeEventListener("cancel", onDialogCancel);
      clearSecrets(ui);
      setWorking(ui, false);
      if (ui.dialog.open) ui.dialog.close();
      passwordTaskActive = false;
      resolve(completed);
    };
    const onCancel = (): void => finish(false);
    const onDialogCancel = (event: Event): void => {
      event.preventDefault();
      finish(false);
    };
    const onSubmit = (event: SubmitEvent): void => {
      event.preventDefault();
      let entered = ui.password.value;
      if (entered.length === 0) {
        ui.error.textContent = "Password is required.";
        return;
      }
      if (task.mode === "pack" && entered !== ui.confirm.value) {
        ui.error.textContent = "The passwords do not match.";
        return;
      }
      if (task.mode === "pack") {
        const audit = auditPwd(entered);
        if (!audit.ok) {
          ui.error.textContent = audit.warning;
          return;
        }
      }

      ui.error.textContent = "";
      setWorking(ui, true);
      void task.run(entered, (message) => { ui.status.textContent = message; })
        .then(() => finish(true))
        .catch((cause: unknown) => {
          ui.error.textContent = cause instanceof Error ? cause.message : String(cause);
          ui.status.textContent = task.mode === "pack"
            ? "No file was downloaded. Choose a password and try again."
            : "The file remains unopened. Check the password and try again.";
          clearSecrets(ui);
          setWorking(ui, false);
          ui.password.focus();
        })
        .finally(() => { entered = ""; });
    };

    ui.form.addEventListener("submit", onSubmit);
    ui.cancel.addEventListener("click", onCancel);
    ui.dialog.addEventListener("cancel", onDialogCancel);
    ui.dialog.showModal();
    ui.password.focus();
  });
};

const packageBlob = async (name: string, blob: Blob): Promise<void> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (packaged(bytes)) {
    directDownload(name, bytes);
    return;
  }
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  await runPasswordTask({
    mode: "pack",
    title: "Protect this .astral file",
    explanation: "Choose the password required to decrypt this packaged chart. It will not be stored anywhere.",
    run: async (password, progress) => {
      const result = await pack(source, password, ({ pct, stage }) => progress(`${pct}% · ${stage}`));
      directDownload(name, result.bytes);
    },
  });
};

const redispatchInput = (input: HTMLInputElement): void => {
  input.dataset["astralUnpacked"] = "true";
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const attachUnpackedSource = (file: File, source: string): void => {
  unpackedSources.set(file, source);
};

const unpackFile = async (input: HTMLInputElement, file: File, bytes: Uint8Array): Promise<void> => {
  const opened = await runPasswordTask({
    mode: "open",
    title: "Open encrypted .astral file",
    explanation: "Enter the package password. Decryption, decompression and protobuf decoding happen locally in this browser.",
    run: async (password, progress) => {
      progress("Decrypting and reconstructing the chart…");
      const result = await openPackage(bytes, password);
      try {
        attachUnpackedSource(file, result.source);
        redispatchInput(input);
      } finally {
        result.id.drop();
      }
    },
  });
  if (!opened) input.value = "";
};

const handleSelectedFile = async (input: HTMLInputElement, file: File): Promise<void> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (packaged(bytes)) {
    await unpackFile(input, file, bytes);
    return;
  }
  redispatchInput(input);
};

Blob.prototype.text = function astralUnpackedText(): Promise<string> {
  const source = unpackedSources.get(this);
  return source === undefined ? originalBlobText.call(this) : Promise.resolve(source);
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
  void packageBlob(this.download, blob).catch(reportPageError);
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
    reportPageError(cause);
  });
}, true);

const updateDownloadLabels = (): void => {
  const generated = element<HTMLButtonElement>("#downloadGenerated");
  const opened = element<HTMLButtonElement>("#downloadOpened");
  if (generated !== null) generated.textContent = "Package and download .astral";
  if (opened !== null) opened.textContent = "Package and download .astral";
  for (const value of document.querySelectorAll<HTMLButtonElement>("#chartHistory button")) {
    if (value.textContent?.trim() === "Download") value.textContent = "Package and download";
  }
};

const initialiseAutomaticPackaging = (): void => {
  const card = element<HTMLElement>("#completeCard");
  const button = element<HTMLButtonElement>("#downloadGenerated");
  if (card === null || button === null) return;
  const packageCompletedChart = (): void => {
    if (card.classList.contains("hidden")) {
      delete card.dataset["packagePrompted"];
      return;
    }
    if (card.dataset["packagePrompted"] === "true") return;
    card.dataset["packagePrompted"] = "true";
    setTimeout(() => button.click(), 0);
  };
  new MutationObserver(packageCompletedChart).observe(card, {
    attributes: true,
    attributeFilter: ["class"],
  });
  packageCompletedChart();
};

updateDownloadLabels();
new MutationObserver(updateDownloadLabels).observe(document.body, { childList: true, subtree: true });
initialiseAutomaticPackaging();
