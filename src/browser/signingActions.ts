import {
  loadSigningKey,
  parseSigningKey,
  signingKeyText,
  type BrowserSigningKey,
} from "./keys.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }
  const temporary = document.createElement("textarea");
  temporary.value = value;
  temporary.readOnly = true;
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.append(temporary);
  temporary.select();
  const copied = document.execCommand("copy");
  temporary.remove();
  if (!copied) throw new Error("The browser did not allow clipboard access");
};

const safeIssuer = (value: string): string => value
  .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "") || "astral";

const download = (name: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const syncVisibleFields = (key: BrowserSigningKey): void => {
  const values: Readonly<Record<string, string>> = {
    signingIssuer: key.issuer,
    signingPrivatePkcs8: key.privatePkcs8,
    signingPublicRaw: key.publicRaw,
  };
  for (const [id, value] of Object.entries(values)) {
    const field = document.getElementById(id);
    if (field instanceof HTMLInputElement) field.value = value;
  }
};

const source = element<HTMLInputElement>("#signingKey");
const credential = source?.closest<HTMLElement>(".credential-signing") ?? null;

if (source !== null && credential !== null && element("#copySigningKeyBundle") === null) {
  const actions = document.createElement("div");
  actions.className = "actions signing-key-actions";

  const action = (id: string, label: string): HTMLButtonElement => {
    const value = document.createElement("button");
    value.id = id;
    value.type = "button";
    value.className = "ghost";
    value.textContent = label;
    actions.append(value);
    return value;
  };

  const copy = action("copySigningKeyBundle", "Copy bundle");
  const save = action("downloadSigningKeyBundle", "Download bundle");
  const importButton = action("importSigningKeyBundle", "Import bundle");
  const importInput = document.createElement("input");
  importInput.id = "signingKeyBundleFile";
  importInput.type = "file";
  importInput.accept = ".json,application/json";
  importInput.hidden = true;
  actions.append(importInput);

  const status = document.createElement("p");
  status.id = "signingKeyExportStatus";
  status.className = "muted";
  status.textContent = "Back up the complete bundle somewhere private. Export requires the encrypted vault to be unlocked when one exists.";
  credential.append(actions, status);

  const setStatus = (message: string, warning = false): void => {
    status.textContent = message;
    status.className = warning ? "notice warning" : "muted";
  };

  const bundle = (): BrowserSigningKey => {
    const entered = source.value.trim();
    if (entered.length > 0) return parseSigningKey(entered);
    const current = loadSigningKey();
    if (current === null) throw new Error("Generate or import a signing key before exporting it");
    return current;
  };

  copy.addEventListener("click", () => void (async () => {
    await copyText(signingKeyText(bundle()));
    setStatus("Signing key bundle copied. Store it somewhere private.");
  })().catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));

  save.addEventListener("click", () => {
    try {
      const selected = bundle();
      download(`${safeIssuer(selected.issuer)}-signing-key.json`, `${signingKeyText(selected)}\n`);
      setStatus("Signing key bundle downloaded. Keep the file private and backed up.");
    } catch (cause: unknown) {
      setStatus(cause instanceof Error ? cause.message : String(cause), true);
    }
  });

  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => void (async () => {
    const file = importInput.files?.[0];
    if (file === undefined) return;
    const selected = parseSigningKey(await file.text());
    source.value = signingKeyText(selected);
    source.dispatchEvent(new Event("input", { bubbles: true }));
    syncVisibleFields(selected);
    element<HTMLButtonElement>("#saveSigningKey")?.click();
    importInput.value = "";
    setStatus("Bundle loaded. The page is validating it for this session and encrypted vault.");
  })().catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));
}
