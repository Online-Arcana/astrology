import {
  applyBrowserSecretSnapshot,
  browserSecretSnapshot,
  clearBrowserSecretSession,
  parseSigningKey,
  saveOpenAiKey,
  savePackagePassword,
  saveSigningKey,
  signingKeyText,
} from "./keys.js";
import { clearPackageFingerprints } from "./packageFingerprints.js";
import { browserVault, type BrowserSecretSnapshot } from "./vault.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

let unlocked = false;
let inactivityTimer = 0;

const setStatus = (message: string, warning = false): void => {
  const status = element<HTMLElement>("#credentialVaultStatus");
  if (status === null) return;
  if (status.textContent !== message) status.textContent = message;
  const className = warning ? "notice warning vault-status" : "muted vault-status";
  if (status.className !== className) status.className = className;
};

const syncSigningFields = (text: string): void => {
  const source = element<HTMLInputElement>("#signingKey");
  if (source !== null) source.value = text;
  if (text.length === 0) {
    for (const selector of ["#signingIssuer", "#signingPrivatePkcs8", "#signingPublicRaw"]) {
      const field = element<HTMLInputElement>(selector);
      if (field !== null) field.value = "";
    }
    return;
  }
  try {
    const key = parseSigningKey(text);
    const issuer = element<HTMLInputElement>("#signingIssuer");
    const privateKey = element<HTMLInputElement>("#signingPrivatePkcs8");
    const publicKey = element<HTMLInputElement>("#signingPublicRaw");
    if (issuer !== null) issuer.value = key.issuer;
    if (privateKey !== null) privateKey.value = key.privatePkcs8;
    if (publicKey !== null) publicKey.value = key.publicRaw;
  } catch {
    // The normal signing-key validator reports malformed content.
  }
};

const applySnapshotToPage = (snapshot: BrowserSecretSnapshot): void => {
  applyBrowserSecretSnapshot(snapshot);
  const openAi = element<HTMLInputElement>("#openAiKey");
  if (openAi !== null) openAi.value = snapshot.openAiKey;
  syncSigningFields(snapshot.signingKeyText ?? "");

  const key = snapshot.signingKeyText === null ? null : parseSigningKey(snapshot.signingKeyText);
  saveOpenAiKey(snapshot.openAiKey);
  saveSigningKey(key);

  // The application owns a private signing-key reference. Its existing save
  // action updates that reference after the vault populated the hidden bundle.
  if (key !== null) element<HTMLButtonElement>("#saveSigningKey")?.click();
};

const signingKeyTextFromInput = (value: string): string => signingKeyText(parseSigningKey(value));

const currentSnapshot = (): BrowserSecretSnapshot => {
  const legacy = browserVault.legacySnapshot();
  const session = browserSecretSnapshot();
  const openAi = element<HTMLInputElement>("#openAiKey")?.value.trim()
    || session.openAiKey
    || legacy?.openAiKey
    || "";
  const enteredSigning = element<HTMLInputElement>("#signingKey")?.value.trim() ?? "";
  const selectedSigning = enteredSigning.length > 0
    ? signingKeyTextFromInput(enteredSigning)
    : session.signingKeyText ?? legacy?.signingKeyText ?? null;
  return {
    openAiKey: openAi,
    signingKeyText: selectedSigning,
    packagePasswords: {
      ...(legacy?.packagePasswords ?? {}),
      ...(session.packagePasswords ?? {}),
    },
  };
};

const sensitiveSelectors = [
  "#copyOpenAiKey",
  "#downloadOpenAiKey",
  "#importOpenAiKey",
  "#copySigningKeyBundle",
  "#downloadSigningKeyBundle",
  "#importSigningKeyBundle",
  "#saveSigningKey",
  "#generateSigningKey",
  "#generateButton",
  "#canonicaliseRun",
];

const credentialFieldSelectors = [
  "#openAiKey",
  "#signingIssuer",
  "#signingPrivatePkcs8",
  "#signingPublicRaw",
  "#showOpenAiKey",
  "#showSigningKeyFields",
];

const vaultExists = (): boolean => element<HTMLElement>("#credentialVault")?.dataset["exists"] === "true";
const lockedByVault = (): boolean => vaultExists() && !unlocked;

const setDisabled = (control: HTMLButtonElement | HTMLInputElement, disabled: boolean): void => {
  if (control.disabled !== disabled) control.disabled = disabled;
};

const enforceLockedControls = (): void => {
  const exists = vaultExists();
  const locked = exists && !unlocked;
  for (const selector of sensitiveSelectors) {
    const control = element<HTMLButtonElement>(selector);
    if (control !== null) setDisabled(control, locked);
  }
  for (const selector of credentialFieldSelectors) {
    const control = element<HTMLInputElement | HTMLButtonElement>(selector);
    if (control !== null) setDisabled(control, locked);
  }

  const badge = element<HTMLElement>("#credentialVaultBadge");
  if (badge !== null) {
    const text = !exists ? "Not protected" : unlocked ? "Unlocked" : "Locked";
    const className = `badge ${!exists ? "warn" : unlocked ? "good" : "neutral"}`;
    if (badge.textContent !== text) badge.textContent = text;
    if (badge.className !== className) badge.className = className;
  }
  const unlock = element<HTMLButtonElement>("#unlockCredentialVault");
  const protect = element<HTMLButtonElement>("#protectCredentialVault");
  const lock = element<HTMLButtonElement>("#lockCredentialVault");
  const remove = element<HTMLButtonElement>("#removeCredentialVault");
  if (unlock !== null) unlock.hidden = !exists || unlocked;
  if (protect !== null) protect.hidden = exists;
  if (lock !== null) lock.hidden = !exists || !unlocked;
  if (remove !== null) remove.hidden = !exists;
};

const updateState = async (): Promise<void> => {
  const host = element<HTMLElement>("#credentialVault");
  if (host === null) return;
  let exists = false;
  try {
    exists = await browserVault.exists();
  } catch (cause: unknown) {
    host.dataset["exists"] = "false";
    setStatus(cause instanceof Error ? cause.message : String(cause), true);
    enforceLockedControls();
    return;
  }
  host.dataset["exists"] = String(exists);
  const legacy = browserVault.legacySnapshot();
  if (exists) {
    setStatus(unlocked
      ? "Credentials and remembered chart passwords are decrypted only for this page session. Lock them when finished."
      : "Unlock with your passkey, biometric or security key before using saved credentials or remembered chart passwords.");
  } else if (legacy !== null) {
    setStatus("Plaintext credentials from the earlier browser version were detected. Protect them now to migrate them into the encrypted passkey vault.", true);
  } else {
    setStatus("Keys and chart passwords entered without a vault remain memory-only and disappear when this page closes. Protect them to save encrypted copies.");
  }
  enforceLockedControls();
};

const resetInactivity = (): void => {
  if (!unlocked) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(() => lockVault("The credential vault locked after 15 minutes of inactivity."), 15 * 60 * 1000);
};

const clearPageSecrets = (): void => {
  // The vault is locked before these existing actions run, so their normal
  // save hooks can clear the application's private references without writing
  // an empty encrypted snapshot over the persisted credentials.
  element<HTMLButtonElement>("#clearOpenAiKey")?.click();
  element<HTMLButtonElement>("#clearSigningKey")?.click();
  clearBrowserSecretSession();
  syncSigningFields("");
};

const lockVault = (message = "Credential vault locked. Decrypted keys and chart passwords were removed from this page."): void => {
  browserVault.lock();
  clearTimeout(inactivityTimer);
  clearPageSecrets();
  unlocked = false;
  setStatus(message);
  enforceLockedControls();
};

const protectVault = async (): Promise<void> => {
  const snapshot = currentSnapshot();
  const packageCount = Object.keys(snapshot.packagePasswords ?? {}).length;
  if (snapshot.openAiKey.length === 0 && snapshot.signingKeyText === null && packageCount === 0) {
    throw new Error("Enter or import at least one credential or open one encrypted chart before creating the encrypted vault");
  }
  if (snapshot.signingKeyText !== null) parseSigningKey(snapshot.signingKeyText);
  setStatus("Creating a passkey-protected encryption key. Complete the browser verification prompt.");
  await browserVault.create(snapshot);
  unlocked = true;
  applySnapshotToPage(snapshot);
  resetInactivity();
  await updateState();
};

const unlockVault = async (): Promise<BrowserSecretSnapshot> => {
  setStatus("Waiting for passkey or biometric verification…");
  const snapshot = await browserVault.unlock();
  unlocked = true;
  applySnapshotToPage(snapshot);
  resetInactivity();
  await updateState();
  return snapshot;
};

const removeVault = async (): Promise<void> => {
  if (!confirm("Delete the encrypted credential vault from this browser? Keep an exported copy of any key you still need.")) return;
  await browserVault.remove();
  clearPackageFingerprints();
  clearPageSecrets();
  unlocked = false;
  await updateState();
};

const createUi = (): void => {
  if (element("#credentialVault") !== null) return;
  const card = element<HTMLElement>(".security-card");
  const credentials = element<HTMLElement>(".credentials");
  if (card === null || credentials === null) return;

  const host = document.createElement("section");
  host.id = "credentialVault";
  host.className = "credential-vault";
  host.dataset["exists"] = "false";
  host.innerHTML = `
    <div class="vault-heading">
      <div>
        <strong>Encrypted browser credential vault</strong>
        <span>WebAuthn PRF + AES-GCM · no saved plaintext keys or chart passwords</span>
      </div>
      <span id="credentialVaultBadge" class="badge warn">Checking</span>
    </div>
    <div class="actions vault-actions">
      <button id="protectCredentialVault" type="button" class="secondary">Protect secrets with passkey</button>
      <button id="unlockCredentialVault" type="button" class="secondary" hidden>Unlock secrets</button>
      <button id="lockCredentialVault" type="button" class="ghost" hidden>Lock secrets</button>
      <button id="removeCredentialVault" type="button" class="ghost" hidden>Delete encrypted vault</button>
    </div>
    <p id="credentialVaultStatus" class="muted vault-status">Checking browser support…</p>`;
  card.insertBefore(host, credentials);

  element<HTMLButtonElement>("#protectCredentialVault")?.addEventListener("click", () => void protectVault()
    .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));
  element<HTMLButtonElement>("#unlockCredentialVault")?.addEventListener("click", () => void unlockVault()
    .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));
  element<HTMLButtonElement>("#lockCredentialVault")?.addEventListener("click", () => lockVault());
  element<HTMLButtonElement>("#removeCredentialVault")?.addEventListener("click", () => void removeVault()
    .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));

  for (const eventName of ["pointerdown", "keydown"] as const) {
    document.addEventListener(eventName, resetInactivity, { passive: true });
  }
  document.addEventListener("click", (event) => {
    if (!lockedByVault()) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (target === null || !sensitiveSelectors.some((selector) => target.matches(selector))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus("Unlock the credential vault before using this action.", true);
  }, true);
};

/** True only when this browser currently has a passkey-encrypted vault record. */
export const credentialVaultExistsForUse = (): Promise<boolean> => browserVault.exists();

/**
 * Unlock the passkey vault as the direct continuation of another protected
 * action. A recognised encrypted chart calls this and then decrypts immediately
 * with the recovered password; no password form is populated or displayed.
 */
export const unlockCredentialVaultForUse = async (): Promise<BrowserSecretSnapshot> => {
  if (browserVault.unlocked) {
    resetInactivity();
    return browserSecretSnapshot();
  }
  return unlockVault();
};

/** Save a chart password only after it is protected by the same biometric vault. */
export const rememberPackagePasswordWithBiometrics = async (
  encryptedPackageSha256: string,
  password: string,
): Promise<void> => {
  const exists = await browserVault.exists();
  if (exists && !browserVault.unlocked) await unlockVault();
  savePackagePassword(encryptedPackageSha256, password);
  if (!exists) {
    await protectVault();
    return;
  }
  await browserVault.save(browserSecretSnapshot());
  resetInactivity();
  await updateState();
};

export const initialiseVaultUi = (): void => {
  createUi();
  void updateState();
};
