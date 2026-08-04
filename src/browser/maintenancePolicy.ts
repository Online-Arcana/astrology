import { assembleAstralFile } from "../file/document.js";
import { encodeAstralFile, isAstralFile } from "../file/validate.js";
import type { PreferredGender } from "../types/base.js";
import {
  loadSigningKey,
  parseSigningKey,
  validateSigningKey,
  type BrowserSigningKey,
} from "./keys.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const preferredGender = (value: unknown): PreferredGender =>
  value === "female" || value === "non-binary" ? value : "male";

const safeName = (value: string): string => value
  .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "") || "astral";

const outputName = (source: string): string => {
  const base = source.replace(/\.(?:astral|json)$/iu, "");
  return `${safeName(base)}-canonical.astral`;
};

const setStatus = (message: string, warning = false): void => {
  const status = element<HTMLElement>("#canonicaliseStatus");
  if (status === null) return;
  status.textContent = message;
  status.className = warning
    ? "notice warning canonicalise-analysis"
    : "canonicalise-analysis";
};

const download = (name: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const signingKey = async (): Promise<BrowserSigningKey> => {
  const entered = element<HTMLInputElement>("#signingKey")?.value.trim() ?? "";
  const key = entered.length > 0 ? parseSigningKey(entered) : loadSigningKey();
  if (key === null) throw new Error("Generate, enter or import an Ed25519 signing key first");
  await validateSigningKey(key);
  return key;
};

const regenerationSelected = (): boolean =>
  element<HTMLInputElement>("#canonicaliseComplete")?.checked === true;

const signingSelected = (): boolean =>
  element<HTMLInputElement>("#canonicaliseSign")?.checked === true;

const syncPolicyUi = (): void => {
  const complete = element<HTMLInputElement>("#canonicaliseComplete");
  const run = element<HTMLButtonElement>("#canonicaliseRun");
  if (complete === null || run === null || complete.checked) return;

  run.textContent = signingSelected() ? "Sign and download" : "Canonicalise and download";
  setStatus(signingSelected()
    ? "Recalculation is off. The existing calculations and interpretations will be preserved without an API call; the new copy will update selected metadata, integrity and signature only."
    : "Recalculation is off. The existing calculations and interpretations will be preserved without an API call; the new copy will update selected metadata and integrity only.");
};

const defaultRegenerationOff = (attempt = 0): void => {
  const card = element<HTMLElement>("#canonicaliseCard");
  const complete = element<HTMLInputElement>("#canonicaliseComplete");
  if (card === null || complete === null || card.classList.contains("hidden")) {
    if (attempt < 120) setTimeout(() => defaultRegenerationOff(attempt + 1), 25);
    return;
  }
  complete.checked = false;
  complete.dispatchEvent(new Event("change", { bubbles: true }));
  setTimeout(syncPolicyUi, 0);
};

const signOrCanonicaliseCurrent = async (): Promise<void> => {
  const input = element<HTMLInputElement>("#astralFile");
  const file = input?.files?.[0];
  if (file === undefined) throw new Error("Open an .astral file first");

  const raw: unknown = JSON.parse(await file.text());
  if (!isAstralFile(raw)) {
    throw new Error("This file is not current-schema complete. Explicitly enable recalculation to rebuild it before downloading a new copy");
  }

  const sign = signingSelected();
  const key = sign ? await signingKey() : null;
  const gender = preferredGender(element<HTMLSelectElement>("#canonicaliseGender")?.value);
  const calculation = raw["astral-calculation"];
  const calculationWithMetadata = calculation.subject.preferredGender === gender
    ? calculation
    : {
        ...calculation,
        subject: {
          ...calculation.subject,
          preferredGender: gender,
        },
      };
  const authority = key === null
    ? null
    : {
        issuer: key.issuer,
        keys: key,
        generatedAt: new Date().toISOString(),
      };

  setStatus(sign
    ? "Signing the current chart without recalculating or reinterpreting it…"
    : "Canonicalising the current chart without recalculating or reinterpreting it…");
  const output = await assembleAstralFile(calculationWithMetadata, raw["astral-chart"], authority);
  download(outputName(file.name), encodeAstralFile(output, true));
  setStatus(sign
    ? "Signed chart downloaded. No calculations or interpretations were regenerated."
    : "Canonical chart downloaded. No calculations or interpretations were regenerated.");
};

const fileInput = element<HTMLInputElement>("#astralFile");
fileInput?.addEventListener("change", () => defaultRegenerationOff());

// The maintenance UI is created only after a file is opened. Handle its
// controls through delegated listeners so the policy applies immediately.
document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (!["canonicaliseComplete", "canonicaliseSign", "canonicaliseGender"].includes(target.id)) return;
  setTimeout(syncPolicyUi, 0);
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("#canonicaliseRun")
    : null;
  if (target === null || regenerationSelected()) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  target.disabled = true;
  void signOrCanonicaliseCurrent()
    .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause), true))
    .finally(() => {
      target.disabled = false;
      syncPolicyUi();
    });
}, true);
