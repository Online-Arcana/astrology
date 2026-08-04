import { isAstralFile, validateAstralFile } from "../file/validate.js";
import { loadSigningKey, signingKeyId } from "./keys.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

let revision = 0;

const refreshAuthorityLabel = async (): Promise<void> => {
  const selectedRevision = ++revision;
  const raw = element<HTMLElement>("#rawChart")?.textContent?.trim() ?? "";
  if (raw.length === 0) return;

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return;
  }
  if (!isAstralFile(value) || value.authority === null) return;

  const key = loadSigningKey();
  if (key === null) return;
  const [validation, currentKeyId] = await Promise.all([
    validateAstralFile(value),
    signingKeyId(key),
  ]);
  if (selectedRevision !== revision) return;
  if (validation.authority !== "trusted" && validation.authority !== "valid_untrusted") return;
  if (value.authority.keyId !== currentKeyId) return;

  const badge = element<HTMLElement>("#fileAuthority");
  if (badge === null) return;
  badge.textContent = "Made by this browser key";
  badge.className = "badge good";
};

const raw = element<HTMLElement>("#rawChart");
if (raw !== null) {
  new MutationObserver(() => { void refreshAuthorityLabel(); }).observe(raw, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

for (const selector of ["#signingKey", "#signingIssuer", "#signingPrivatePkcs8", "#signingPublicRaw"]) {
  const control = element<HTMLInputElement>(selector);
  control?.addEventListener("input", () => { void refreshAuthorityLabel(); });
  control?.addEventListener("change", () => { void refreshAuthorityLabel(); });
}

void refreshAuthorityLabel();
