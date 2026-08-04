import { isAstralFile } from "../file/validate.js";
import { auditOpenedInterpretations, type OpenedInterpretationAudit } from "./maintenanceAudit.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

let latest: OpenedInterpretationAudit | null = null;
let auditReady = false;

const ensureOutput = (): HTMLElement | null => {
  let output = element<HTMLElement>("#canonicaliseInterpretationAudit");
  if (output !== null) return output;
  const status = element<HTMLElement>("#canonicaliseStatus");
  if (status === null) return null;
  output = document.createElement("div");
  output.id = "canonicaliseInterpretationAudit";
  output.className = "notice canonicalise-interpretation-audit";
  status.insertAdjacentElement("afterend", output);
  return output;
};

const setActionStatus = (message: string, warning = false): void => {
  const status = element<HTMLElement>("#canonicaliseStatus");
  if (status === null) return;
  status.textContent = message;
  status.className = warning
    ? "notice warning canonicalise-analysis"
    : "canonicalise-analysis";
};

const regenerationSelected = (): boolean =>
  element<HTMLInputElement>("#canonicaliseComplete")?.checked === true;

const signingSelected = (): boolean =>
  element<HTMLInputElement>("#canonicaliseSign")?.checked === true;

const render = (): boolean => {
  const output = ensureOutput();
  if (output === null) return false;
  if (!auditReady) {
    output.className = "notice canonicalise-interpretation-audit";
    output.textContent = "Analysing every planned interpretation and deterministic source reference…";
    return true;
  }
  if (latest === null) return true;
  if (latest.complete) {
    output.className = "notice canonicalise-interpretation-audit";
    output.textContent = "Every planned interpretation parses under the current strict schema, passes deterministic NLP and uses permitted, resolvable source references.";
    return true;
  }
  const examples = latest.invalidUnitIds.slice(0, 8);
  const remaining = latest.invalidUnitIds.length - examples.length;
  const action = regenerationSelected()
    ? "Regeneration is selected, so these units will be rebuilt."
    : "Recalculation is off, so the existing calculations and interpretations will be preserved unchanged; signing will attest to those exact existing contents.";
  output.className = "notice warning canonicalise-interpretation-audit";
  output.textContent = `${latest.invalidUnitIds.length} interpretation unit${latest.invalidUnitIds.length === 1 ? "" : "s"} do not pass the current maintenance audit: ${examples.join(", ")}${remaining > 0 ? ` and ${remaining} more` : ""}. ${action}`;
  return true;
};

const renderSoon = (attempt = 0): void => {
  if (render() || attempt >= 20) return;
  setTimeout(() => renderSoon(attempt + 1), 25);
};

const runButton = (): HTMLButtonElement | null => element<HTMLButtonElement>("#canonicaliseRun");

const setAuditPending = (): void => {
  auditReady = false;
  latest = null;
  const disable = (attempt = 0): void => {
    if (auditReady) return;
    const run = runButton();
    if (run !== null) {
      run.disabled = true;
      run.dataset["auditPending"] = "true";
      renderSoon();
      return;
    }
    if (attempt < 20) setTimeout(() => disable(attempt + 1), 25);
  };
  disable();
};

const refreshMaintenancePlan = (attempt = 0): void => {
  const analyse = element<HTMLButtonElement>("#canonicaliseAnalyse");
  const run = runButton();
  if (analyse === null || run === null) {
    if (attempt < 20) setTimeout(() => refreshMaintenancePlan(attempt + 1), 25);
    return;
  }
  delete run.dataset["auditPending"];
  analyse.click();
};

const selectRecommendedRegeneration = (): void => {
  if (latest?.complete !== false) return;
  const complete = element<HTMLInputElement>("#canonicaliseComplete");
  if (complete === null || complete.checked) return;
  complete.checked = true;
  complete.dispatchEvent(new Event("change", { bubbles: true }));
};

const applyAudit = (audit: OpenedInterpretationAudit): void => {
  latest = audit;
  auditReady = true;
  selectRecommendedRegeneration();
  renderSoon();
  refreshMaintenancePlan();
};

const markLegacyAuditComplete = (): void => {
  latest = null;
  auditReady = true;
  const show = (attempt = 0): void => {
    const output = ensureOutput();
    if (output === null && attempt < 20) {
      setTimeout(() => show(attempt + 1), 25);
      return;
    }
    if (output === null) return;
    output.className = "notice warning canonicalise-interpretation-audit";
    output.textContent = "This file is not current-schema complete, so the maintenance tool must rebuild the full chart rather than attempting a sign-only copy.";
    refreshMaintenancePlan();
  };
  show();
};

const auditFile = async (file: File): Promise<void> => {
  const raw: unknown = JSON.parse(await file.text());
  if (!isAstralFile(raw)) {
    markLegacyAuditComplete();
    return;
  }
  applyAudit(auditOpenedInterpretations(raw));
};

const actionMessage = (): string => {
  if (regenerationSelected()) {
    return "Starting canonical regeneration. Loading the embedded place and current calculation data…";
  }
  if (signingSelected()) {
    return "Signing the current chart without recalculating it. Preparing the signed download…";
  }
  return "Preparing a canonical copy without recalculating the current chart…";
};

export const initialiseMaintenanceAuditUi = (): void => {
  const fileInput = element<HTMLInputElement>("#astralFile");
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file === undefined) return;
    setAuditPending();
    void auditFile(file).catch((cause: unknown) => {
      latest = null;
      auditReady = false;
      const show = (attempt = 0): void => {
        const output = ensureOutput();
        if (output === null && attempt < 20) {
          setTimeout(() => show(attempt + 1), 25);
          return;
        }
        if (output === null) return;
        output.className = "notice warning canonicalise-interpretation-audit";
        output.textContent = cause instanceof Error ? cause.message : String(cause);
      };
      show();
    });
  });
  element<HTMLButtonElement>("#canonicaliseAnalyse")?.addEventListener("click", () => setTimeout(renderSoon, 0));
  element<HTMLInputElement>("#canonicaliseComplete")?.addEventListener("change", renderSoon);
  element<HTMLInputElement>("#canonicaliseSign")?.addEventListener("change", renderSoon);
  element<HTMLButtonElement>("#canonicaliseRun")?.addEventListener("click", (event) => {
    if (!auditReady) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setActionStatus("The interpretation audit is still running. Wait for it to finish before creating the updated copy.", true);
      renderSoon();
      return;
    }
    setActionStatus(actionMessage());
  }, true);
};
