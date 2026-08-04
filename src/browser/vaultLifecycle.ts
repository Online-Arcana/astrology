import { browserVault } from "./vault.js";
import { clearBrowserSecretSession } from "./keys.js";

const clearPageCredentials = (): void => {
  browserVault.lock();
  document.querySelector<HTMLButtonElement>("#clearOpenAiKey")?.click();
  document.querySelector<HTMLButtonElement>("#clearSigningKey")?.click();
  clearBrowserSecretSession();
  for (const selector of ["#openAiKey", "#signingKey", "#signingIssuer", "#signingPrivatePkcs8", "#signingPublicRaw"]) {
    const field = document.querySelector<HTMLInputElement>(selector);
    if (field !== null) field.value = "";
  }
};

window.addEventListener("pagehide", clearPageCredentials);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
