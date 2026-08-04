import {
  decodeReadableAstralFile,
  isAstralFile,
  validateAstralFile,
} from "../file/validate.js";
import type { AstralFile } from "../types/file.js";
import {
  loadSigningKey,
  parseSigningKey,
  signingKeyId,
  type BrowserSigningKey,
} from "./keys.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const liveSigningKey = (): BrowserSigningKey | null => {
  const entered = element<HTMLInputElement>("#signingKey")?.value.trim() ?? "";
  if (entered.length > 0) {
    try {
      return parseSigningKey(entered);
    } catch {
      // The normal credential validator reports malformed key bundles.
    }
  }
  return loadSigningKey();
};

const authorityCopy = async (file: AstralFile): Promise<{
  badge: string;
  className: string;
  detail: string;
}> => {
  const validation = await validateAstralFile(file);
  const validationText = `Structure ${validation.structure}; integrity ${validation.integrity}.`;
  if (file.authority === null) {
    return {
      badge: "Unsigned",
      className: "badge warn",
      detail: `${validationText} This chart is unsigned.`,
    };
  }
  if (validation.authority === "invalid") {
    return {
      badge: "Invalid signature",
      className: "badge bad",
      detail: `${validationText} The authority signature from ${file.authority.issuer} is invalid.`,
    };
  }

  const key = liveSigningKey();
  if (key === null) {
    return {
      badge: "Signature verified",
      className: "badge good",
      detail: `${validationText} Signature verified. Issuer: ${file.authority.issuer}. No signing key is currently loaded, so this page cannot compare ownership.`,
    };
  }
  const matches = file.authority.keyId === await signingKeyId(key);
  return matches
    ? {
        badge: "Made by this browser key",
        className: "badge good",
        detail: `${validationText} Signature verified. Issuer: ${file.authority.issuer}. It matches the signing key currently loaded.`,
      }
    : {
        badge: "Signature verified",
        className: "badge good",
        detail: `${validationText} Signature verified. Issuer: ${file.authority.issuer}. It uses a different key from the one currently loaded; that does not identify which tool created it.`,
      };
};

const replaceFalseClaims = (detail: string): void => {
  const roots = [element<HTMLElement>("#viewerCard"), element<HTMLElement>("#formattedChart")]
    .filter((value): value is HTMLElement => value !== null);
  for (const root of roots) {
    for (const node of root.querySelectorAll<HTMLElement>("p, span, dd, small")) {
      const value = node.textContent?.trim() ?? "";
      if (!/^(?:signature created elsewhere|signed by another authority)/iu.test(value)) continue;
      if (node.textContent !== detail) node.textContent = detail;
    }
  }
};

let refreshing = false;
const refresh = async (): Promise<void> => {
  if (refreshing) return;
  const input = element<HTMLInputElement>("#astralFile");
  const selected = input?.files?.[0];
  if (selected === undefined) return;
  refreshing = true;
  try {
    const raw = await selected.text();
    const readable = decodeReadableAstralFile(raw);
    if (!isAstralFile(readable)) return;
    const copy = await authorityCopy(readable);
    const badge = element<HTMLElement>("#fileAuthority");
    if (badge !== null) {
      if (badge.textContent !== copy.badge) badge.textContent = copy.badge;
      if (badge.className !== copy.className) badge.className = copy.className;
    }
    const detail = element<HTMLElement>("#fileValidation");
    if (detail !== null && detail.textContent !== copy.detail) detail.textContent = copy.detail;
    replaceFalseClaims(copy.detail);
  } finally {
    refreshing = false;
  }
};

const refreshSoon = (): void => {
  setTimeout(() => void refresh(), 0);
};

const fileInput = element<HTMLInputElement>("#astralFile");
fileInput?.addEventListener("change", refreshSoon);

const signingInput = element<HTMLInputElement>("#signingKey");
signingInput?.addEventListener("input", refreshSoon);
signingInput?.addEventListener("change", refreshSoon);

for (const selector of [
  "#saveSigningKey",
  "#generateSigningKey",
  "#clearSigningKey",
  "#importSigningKeyBundle",
  "#unlockCredentialVault",
  "#lockCredentialVault",
]) {
  element<HTMLButtonElement>(selector)?.addEventListener("click", () => {
    setTimeout(() => void refresh(), 150);
  });
}

const badge = element<HTMLElement>("#fileAuthority");
if (badge !== null) {
  new MutationObserver(refreshSoon).observe(badge, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const formatted = element<HTMLElement>("#formattedChart");
if (formatted !== null) {
  new MutationObserver(refreshSoon).observe(formatted, {
    childList: true,
    subtree: true,
  });
}
