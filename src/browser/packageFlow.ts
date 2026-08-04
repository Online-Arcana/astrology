import {
  auditPwd,
  open as openPackage,
  pack,
} from "astral-packager";

interface Task {
  mode: "open" | "pack";
  title: string;
  explanation: string;
  run(password: string, progress: (message: string) => void): Promise<void>;
}

interface DialogUi {
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  title: HTMLElement;
  explanation: HTMLElement;
  password: HTMLInputElement;
  passwordReveal: HTMLButtonElement;
  confirm: HTMLInputElement;
  confirmLabel: HTMLElement;
  confirmReveal: HTMLButtonElement;
  match: HTMLElement;
  audit: HTMLElement;
  meter: HTMLMeterElement;
  score: HTMLElement;
  tips: HTMLUListElement;
  error: HTMLElement;
  status: HTMLElement;
  cancel: HTMLButtonElement;
  submit: HTMLButtonElement;
}

const magic = "ASTRPKG";
const makeUrl = URL.createObjectURL.bind(URL);
const dropUrl = URL.revokeObjectURL.bind(URL);
const clickAnchor = HTMLAnchorElement.prototype.click;
const readBlobText = Blob.prototype.text;
const blobs = new Map<string, Blob>();
const opened = new WeakMap<Blob, string>();
let busy = false;

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const isPackage = (bytes: Uint8Array): boolean => {
  if (bytes.byteLength < magic.length) return false;
  for (let at = 0; at < magic.length; at += 1) {
    if (bytes[at] !== magic.charCodeAt(at)) return false;
  }
  return true;
};

const outputName = (value: string): string => {
  const stem = value
    .replace(/\.(?:astral|json|raw)$/iu, "")
    .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  return `${stem.length === 0 ? "chart" : stem}.astral`;
};

const download = (name: string, bytes: Uint8Array): void => {
  const copy = bytes.slice();
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = makeUrl(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = outputName(name);
  clickAnchor.call(anchor);
  setTimeout(() => dropUrl(url), 0);
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

const addDialogStyle = (): void => {
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
    .astral-package-dialog::backdrop {
      background: rgb(8 6 19 / .78);
      backdrop-filter: blur(4px);
    }
    .astral-package-dialog form {
      display: grid;
      gap: 1rem;
      padding: 1.4rem;
    }
    .astral-package-dialog h2,
    .astral-package-dialog p { margin: 0; }
    .astral-package-dialog label {
      display: grid;
      gap: .45rem;
      font-weight: 700;
    }
    .astral-package-dialog [hidden] { display: none !important; }
    .astral-package-dialog input {
      width: 100%;
      box-sizing: border-box;
    }
    .astral-package-password-field {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 3rem;
      align-items: stretch;
      gap: .45rem;
    }
    .astral-package-reveal {
      display: grid;
      place-items: center;
      min-width: 3rem;
      padding: .5rem;
    }
    .astral-package-eye {
      width: 1.35rem;
      height: 1.35rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .astral-package-audit {
      display: grid;
      gap: .55rem;
      padding: .85rem;
      border: 1px solid #4b426f;
      border-radius: .85rem;
      background: rgb(10 8 25 / .42);
    }
    .astral-package-audit-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: .5rem;
    }
    .astral-package-audit meter {
      width: 100%;
    }
    .astral-package-audit ul {
      margin: 0;
      padding-left: 1.2rem;
      color: #d9caef;
    }
    .astral-package-match {
      min-height: 1.35rem;
      color: #d9caef;
      font-weight: 600;
    }
    .astral-package-match.good { color: #b9f6cf; }
    .astral-package-match.error { color: #ffb9c4; }
    .astral-package-dialog .astral-package-status {
      min-height: 1.5rem;
      color: #d9caef;
    }
    .astral-package-dialog .astral-package-error {
      min-height: 1.5rem;
      color: #ffb9c4;
    }
    .astral-package-dialog .actions {
      display: flex;
      flex-wrap: wrap;
      gap: .75rem;
      justify-content: flex-end;
    }
  `;
  document.head.append(style);
};

const revealMarkup = (id: string, label: string): string => `
  <button id="${id}" class="ghost astral-package-reveal" type="button" aria-label="${label}" aria-pressed="false">
    <svg class="astral-package-eye eye-closed" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18"></path>
      <path d="M10.6 10.7A2 2 0 0 0 13.3 13.4"></path>
      <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a16 16 0 0 1-3 4.2"></path>
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8c1.5 0 2.8-.4 4-1"></path>
    </svg>
    <svg class="astral-package-eye eye-open" viewBox="0 0 24 24" aria-hidden="true" hidden>
      <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  </button>`;

const dialogUi = (): DialogUi => {
  let dialog = element<HTMLDialogElement>("#astralPackageDialog");
  if (dialog === null) {
    addDialogStyle();
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
          <span class="astral-package-password-field">
            <input id="astralPackagePassword" type="password" autocomplete="off" autocapitalize="none" spellcheck="false">
            ${revealMarkup("astralPackagePasswordReveal", "Reveal password")}
          </span>
        </label>
        <label id="astralPackageConfirmLabel">Confirm password
          <span class="astral-package-password-field">
            <input id="astralPackageConfirm" type="password" autocomplete="off" autocapitalize="none" spellcheck="false">
            ${revealMarkup("astralPackageConfirmReveal", "Reveal confirmation password")}
          </span>
          <small id="astralPackageMatch" class="astral-package-match" aria-live="polite"></small>
        </label>
        <section id="astralPackageAudit" class="astral-package-audit" data-score="0" aria-live="polite">
          <div class="astral-package-audit-head">
            <strong>Password strength</strong>
            <span id="astralPackageScore">Not scored</span>
          </div>
          <meter id="astralPackageMeter" min="0" max="4" value="0">0 out of 4</meter>
          <ul id="astralPackageTips"></ul>
        </section>
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
  const passwordReveal = element<HTMLButtonElement>("#astralPackagePasswordReveal");
  const confirm = element<HTMLInputElement>("#astralPackageConfirm");
  const confirmLabel = element<HTMLElement>("#astralPackageConfirmLabel");
  const confirmReveal = element<HTMLButtonElement>("#astralPackageConfirmReveal");
  const match = element<HTMLElement>("#astralPackageMatch");
  const audit = element<HTMLElement>("#astralPackageAudit");
  const meter = element<HTMLMeterElement>("#astralPackageMeter");
  const score = element<HTMLElement>("#astralPackageScore");
  const tips = element<HTMLUListElement>("#astralPackageTips");
  const error = element<HTMLElement>("#astralPackageError");
  const status = element<HTMLElement>("#astralPackageStatus");
  const cancel = element<HTMLButtonElement>("#astralPackageCancel");
  const submit = element<HTMLButtonElement>("#astralPackageContinue");
  if (form === null || title === null || explanation === null || password === null
    || passwordReveal === null || confirm === null || confirmLabel === null
    || confirmReveal === null || match === null || audit === null || meter === null
    || score === null || tips === null || error === null || status === null
    || cancel === null || submit === null) {
    throw new Error("Password dialog is incomplete");
  }
  return {
    dialog,
    form,
    title,
    explanation,
    password,
    passwordReveal,
    confirm,
    confirmLabel,
    confirmReveal,
    match,
    audit,
    meter,
    score,
    tips,
    error,
    status,
    cancel,
    submit,
  };
};

const setReveal = (toggle: HTMLButtonElement, input: HTMLInputElement, shown: boolean): void => {
  input.type = shown ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(shown));
  toggle.setAttribute("aria-label", shown ? "Hide password" : "Reveal password");
  const open = toggle.querySelector<SVGElement>(".eye-open");
  const closed = toggle.querySelector<SVGElement>(".eye-closed");
  if (open !== null) {
    if (shown) open.removeAttribute("hidden");
    else open.setAttribute("hidden", "");
    open.style.display = shown ? "block" : "none";
  }
  if (closed !== null) {
    if (shown) closed.setAttribute("hidden", "");
    else closed.removeAttribute("hidden");
    closed.style.display = shown ? "none" : "block";
  }
};

const setConfirmVisible = (ui: DialogUi, visible: boolean): void => {
  ui.confirmLabel.hidden = !visible;
  ui.confirmLabel.style.display = visible ? "grid" : "none";
  ui.confirm.required = visible;
  ui.confirm.disabled = !visible;
  ui.confirmReveal.disabled = !visible;
  if (visible) return;
  ui.confirm.value = "";
  ui.confirm.setCustomValidity("");
  ui.confirm.setAttribute("aria-invalid", "false");
  ui.match.textContent = "";
  ui.match.className = "astral-package-match";
};

const setAuditVisible = (ui: DialogUi, visible: boolean): void => {
  ui.audit.hidden = !visible;
  ui.audit.style.display = visible ? "grid" : "none";
};

const showAudit = (ui: DialogUi): ReturnType<typeof auditPwd> => {
  const value = auditPwd(ui.password.value);
  ui.audit.dataset["score"] = String(value.score);
  ui.meter.value = value.score;
  ui.meter.textContent = `${value.score} out of 4`;
  ui.score.textContent = ui.password.value.length === 0
    ? "Not scored"
    : `${value.score}/4 — ${value.label}`;
  const messages = ui.password.value.length === 0
    ? ["Use at least 10 characters and avoid predictable words, dates or sequences."]
    : value.ok
      ? ["This password is accepted for a new encrypted container."]
      : [...new Set([value.warning, ...value.suggestions])].filter((item) => item.length > 0);
  ui.tips.replaceChildren(...messages.map((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    return item;
  }));
  return value;
};

const checkMatch = (ui: DialogUi): boolean => {
  if (ui.confirm.disabled) {
    ui.confirm.setCustomValidity("");
    ui.confirm.setAttribute("aria-invalid", "false");
    ui.match.textContent = "";
    ui.match.className = "astral-package-match";
    return true;
  }
  if (ui.confirm.value.length === 0) {
    ui.confirm.setCustomValidity("");
    ui.confirm.setAttribute("aria-invalid", "false");
    ui.match.textContent = "Re-enter the password to confirm it.";
    ui.match.className = "astral-package-match";
    return false;
  }
  const matches = ui.confirm.value === ui.password.value;
  ui.confirm.setCustomValidity(matches ? "" : "Passwords do not match.");
  ui.confirm.setAttribute("aria-invalid", String(!matches));
  ui.match.textContent = matches ? "Passwords match." : "Passwords do not match.";
  ui.match.className = `astral-package-match ${matches ? "good" : "error"}`;
  return matches;
};

const clearSecrets = (ui: DialogUi): void => {
  ui.password.value = "";
  ui.confirm.value = "";
};

const working = (ui: DialogUi, value: boolean): void => {
  ui.password.disabled = value;
  ui.passwordReveal.disabled = value;
  ui.confirm.disabled = value || ui.confirmLabel.hidden;
  ui.confirmReveal.disabled = value || ui.confirmLabel.hidden;
  ui.cancel.disabled = value;
  ui.submit.disabled = value;
};

const resetFields = (ui: DialogUi, mode: Task["mode"]): void => {
  clearSecrets(ui);
  setReveal(ui.passwordReveal, ui.password, false);
  setReveal(ui.confirmReveal, ui.confirm, false);
  setConfirmVisible(ui, mode === "pack");
  setAuditVisible(ui, mode === "pack");
  ui.password.autocomplete = mode === "pack" ? "new-password" : "current-password";
  ui.password.minLength = mode === "pack" ? 10 : 0;
  ui.password.required = true;
  ui.error.textContent = "";
  if (mode === "pack") {
    showAudit(ui);
    checkMatch(ui);
  }
};

const runTask = async (task: Task): Promise<boolean> => {
  if (busy) throw new Error("Finish the current password operation first");
  busy = true;
  const ui = dialogUi();
  resetFields(ui, task.mode);
  working(ui, false);
  ui.title.textContent = task.title;
  ui.explanation.textContent = task.explanation;
  ui.status.textContent = task.mode === "pack"
    ? "The password is used only for this package and is never saved."
    : "The password is used only to open this file and is never saved.";
  ui.submit.textContent = task.mode === "pack" ? "Package" : "Open";

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (completed: boolean): void => {
      if (settled) return;
      settled = true;
      ui.form.removeEventListener("submit", submit);
      ui.cancel.removeEventListener("click", cancel);
      ui.dialog.removeEventListener("cancel", dismiss);
      ui.password.removeEventListener("input", passwordInput);
      ui.confirm.removeEventListener("input", confirmInput);
      ui.passwordReveal.removeEventListener("click", revealPassword);
      ui.confirmReveal.removeEventListener("click", revealConfirm);
      resetFields(ui, task.mode);
      working(ui, false);
      if (ui.dialog.open) ui.dialog.close();
      busy = false;
      resolve(completed);
    };

    const cancel = (): void => finish(false);
    const dismiss = (event: Event): void => {
      event.preventDefault();
      finish(false);
    };
    const passwordInput = (): void => {
      if (task.mode === "pack") showAudit(ui);
      checkMatch(ui);
    };
    const confirmInput = (): void => { checkMatch(ui); };
    const revealPassword = (): void => {
      const shown = ui.password.type === "password";
      setReveal(ui.passwordReveal, ui.password, shown);
      if (task.mode === "pack") {
        setConfirmVisible(ui, !shown);
        setReveal(ui.confirmReveal, ui.confirm, false);
        checkMatch(ui);
      }
    };
    const revealConfirm = (): void => {
      if (ui.confirm.disabled) return;
      setReveal(ui.confirmReveal, ui.confirm, ui.confirm.type === "password");
    };
    const submit = (event: SubmitEvent): void => {
      event.preventDefault();
      let password = ui.password.value;
      if (password.length === 0) {
        ui.error.textContent = "Password is required.";
        return;
      }
      if (task.mode === "pack") {
        const audit = showAudit(ui);
        if (!audit.ok) {
          ui.error.textContent = audit.warning || "Choose a password scored Strong or Excellent.";
          return;
        }
        if (!checkMatch(ui)) {
          ui.error.textContent = "The passwords do not match.";
          return;
        }
      }

      ui.error.textContent = "";
      working(ui, true);
      void task.run(password, (message) => { ui.status.textContent = message; })
        .then(() => finish(true))
        .catch((cause: unknown) => {
          ui.error.textContent = cause instanceof Error ? cause.message : String(cause);
          ui.status.textContent = task.mode === "pack"
            ? "No file was downloaded. Choose a password and try again."
            : "The file remains unopened. Check the password and try again.";
          resetFields(ui, task.mode);
          working(ui, false);
          ui.password.focus();
        })
        .finally(() => { password = ""; });
    };

    ui.form.addEventListener("submit", submit);
    ui.cancel.addEventListener("click", cancel);
    ui.dialog.addEventListener("cancel", dismiss);
    ui.password.addEventListener("input", passwordInput);
    ui.confirm.addEventListener("input", confirmInput);
    ui.passwordReveal.addEventListener("click", revealPassword);
    ui.confirmReveal.addEventListener("click", revealConfirm);
    ui.dialog.showModal();
    ui.password.focus();
  });
};

const packageBlob = async (name: string, blob: Blob): Promise<void> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (isPackage(bytes)) {
    download(name, bytes);
    return;
  }
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  await runTask({
    mode: "pack",
    title: "Protect this .astral file",
    explanation: "Choose the password required to decrypt this packaged chart. It will not be stored anywhere.",
    run: async (password, progress) => {
      const result = await pack(source, password, ({ pct, stage }) => {
        progress(`${pct}% · ${stage}`);
      });
      download(name, result.bytes);
    },
  });
};

const redispatch = (input: HTMLInputElement): void => {
  input.dataset["astralUnpacked"] = "true";
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const unpack = async (input: HTMLInputElement, file: File, bytes: Uint8Array): Promise<void> => {
  const completed = await runTask({
    mode: "open",
    title: "Open encrypted .astral file",
    explanation: "Enter the package password. Decryption, decompression and protobuf decoding happen locally in this browser.",
    run: async (password, progress) => {
      progress("Decrypting and reconstructing the chart…");
      const result = await openPackage(bytes, password);
      try {
        opened.set(file, result.source);
        redispatch(input);
      } finally {
        result.id.drop();
      }
    },
  });
  if (!completed) input.value = "";
};

const selected = async (input: HTMLInputElement, file: File): Promise<void> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isPackage(bytes)) {
    await unpack(input, file, bytes);
    return;
  }
  redispatch(input);
};

Blob.prototype.text = function astralUnpackedText(): Promise<string> {
  const source = opened.get(this);
  return source === undefined ? readBlobText.call(this) : Promise.resolve(source);
};

URL.createObjectURL = ((object: Blob | MediaSource): string => {
  const url = makeUrl(object);
  if (object instanceof Blob) blobs.set(url, object);
  return url;
}) as typeof URL.createObjectURL;

URL.revokeObjectURL = ((url: string): void => {
  dropUrl(url);
  setTimeout(() => blobs.delete(url), 60_000);
}) as typeof URL.revokeObjectURL;

HTMLAnchorElement.prototype.click = function packagedAstralClick(): void {
  const blob = blobs.get(this.href);
  const astral = this.download.toLocaleLowerCase("en-GB").endsWith(".astral");
  if (!astral || blob === undefined) {
    clickAnchor.call(this);
    return;
  }
  void packageBlob(this.download, blob).catch(report);
};

document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== "astralFile") return;
  if (input.dataset["astralUnpacked"] === "true") {
    delete input.dataset["astralUnpacked"];
    return;
  }
  const file = input.files?.[0];
  if (file === undefined) return;
  event.stopImmediatePropagation();
  void selected(input, file).catch((cause: unknown) => {
    input.value = "";
    report(cause);
  });
}, true);

const automaticGenerationPackage = (): void => {
  const card = element<HTMLElement>("#completeCard");
  const button = element<HTMLButtonElement>("#downloadGenerated");
  if (card === null || button === null) return;

  const check = (): void => {
    if (card.classList.contains("hidden")) {
      delete card.dataset["packagePrompted"];
      return;
    }
    if (card.dataset["packagePrompted"] === "true") return;
    card.dataset["packagePrompted"] = "true";
    setTimeout(() => button.click(), 0);
  };

  new MutationObserver(check).observe(card, {
    attributes: true,
    attributeFilter: ["class"],
  });
  check();
};

automaticGenerationPackage();
