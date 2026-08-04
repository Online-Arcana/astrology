const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const completeNotice = element<HTMLElement>("#completeCard > p");
if (completeNotice !== null) {
  completeNotice.textContent = "The final .astral download is a password-encrypted package containing the complete chart. The password is never stored by this page.";
}

const generated = element<HTMLButtonElement>("#downloadGenerated");
if (generated !== null) generated.textContent = "Package and download .astral";

const opened = element<HTMLButtonElement>("#downloadOpened");
if (opened !== null) opened.textContent = "Package and download .astral";

const fileInput = element<HTMLInputElement>("#astralFile");
if (fileInput !== null) {
  fileInput.accept = ".astral,application/octet-stream,application/json";
}

const validation = element<HTMLElement>("#fileValidation");
if (validation !== null) {
  validation.textContent = "Encrypted .astral packages are decrypted, decompressed and decoded locally after you enter their password. The password is never stored.";
}

const rawTab = element<HTMLButtonElement>('.subtab[data-view="rawView"]');
if (rawTab !== null) rawTab.textContent = "Reconstructed JSON";

const labelHistoryDownloads = (): void => {
  for (const button of document.querySelectorAll<HTMLButtonElement>("#chartHistory button")) {
    if (button.textContent?.trim() === "Download") button.textContent = "Package and download";
  }
};

const history = element<HTMLElement>("#chartHistory");
if (history !== null) {
  labelHistoryDownloads();
  new MutationObserver(labelHistoryDownloads).observe(history, {
    childList: true,
    subtree: true,
  });
}

const footer = element<HTMLElement>("footer p");
if (footer !== null) {
  footer.textContent = "Chart calculation, recovery, packaging, encryption, decryption and file reconstruction run locally in this browser. OpenAI receives only interpretation requests while a chart is being generated.";
}
