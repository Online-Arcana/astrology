import {
  isTestSigningKey,
  loadSigningKey,
  parseSigningKey,
} from "./keys.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const enteredKeyIsTestOnly = (): boolean => {
  const source = element<HTMLInputElement>("#signingKey");
  const entered = source?.value.trim() ?? "";
  if (entered.length > 0) {
    try {
      return isTestSigningKey(parseSigningKey(entered));
    } catch {
      return false;
    }
  }
  const current = loadSigningKey();
  return current !== null && isTestSigningKey(current);
};

const ensureWarning = (parent: HTMLElement, id: string): HTMLElement => {
  let warning = element<HTMLElement>(`#${id}`);
  if (warning !== null) return warning;
  warning = document.createElement("p");
  warning.id = id;
  warning.className = "notice warning";
  parent.append(warning);
  return warning;
};

const refresh = (): void => {
  const testOnly = enteredKeyIsTestOnly();
  const signingCredential = element<HTMLElement>(".credential-signing");
  const save = element<HTMLButtonElement>("#saveSigningKey");
  if (save !== null) save.disabled = testOnly;
  if (signingCredential !== null) {
    const warning = ensureWarning(signingCredential, "testSigningKeyWarning");
    warning.hidden = !testOnly;
    warning.textContent = "TEST-ONLY SIGNING BUNDLE — not a valid production signing identity. It cannot be saved to the credential vault or used to sign, canonicalise or re-sign a real chart.";
  }

  const sign = element<HTMLInputElement>("#canonicaliseSign");
  const card = element<HTMLElement>("#canonicaliseCard");
  if (sign !== null) {
    if (testOnly) sign.checked = false;
    sign.disabled = testOnly;
  }
  if (card !== null) {
    const warning = ensureWarning(card, "testSigningMaintenanceWarning");
    warning.hidden = !testOnly;
    warning.textContent = "Re-signing is disabled because the entered bundle is TEST-ONLY. Testing keys are deliberately invalid for canonicalising or signing ordinary .astral files.";
  }
};

for (const selector of ["#signingKey", "#signingIssuer", "#signingPrivatePkcs8", "#signingPublicRaw"]) {
  const input = element<HTMLInputElement>(selector);
  input?.addEventListener("input", () => setTimeout(refresh, 0));
  input?.addEventListener("change", () => setTimeout(refresh, 0));
}
for (const selector of ["#importSigningKeyBundle", "#generateSigningKey", "#clearSigningKey", "#unlockCredentialVault", "#lockCredentialVault"]) {
  element<HTMLButtonElement>(selector)?.addEventListener("click", () => setTimeout(refresh, 150));
}

refresh();
