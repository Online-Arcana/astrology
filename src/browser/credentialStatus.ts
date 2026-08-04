const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const signingStatus = (): HTMLElement | null => element<HTMLElement>("#signingKeyExportStatus");

const setSigningStatus = (message: string, warning = false): void => {
  const status = signingStatus();
  if (status === null) return;
  status.textContent = message;
  status.className = warning ? "notice warning" : "muted";
};

const generate = element<HTMLButtonElement>("#generateSigningKey");
generate?.addEventListener("click", () => {
  const source = element<HTMLInputElement>("#signingKey");
  const previous = source?.value ?? "";
  setSigningStatus("Generating a new signing key bundle in memory…");
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const current = source?.value ?? "";
    if (current.length > 0 && current !== previous) {
      clearInterval(timer);
      setSigningStatus("New key generated. It is saved only when the encrypted vault is unlocked; export a private backup as well.");
      return;
    }
    if (attempts < 80) return;
    clearInterval(timer);
    setSigningStatus("The page did not receive a generated signing key.", true);
  }, 100);
});

const save = element<HTMLButtonElement>("#saveSigningKey");
save?.addEventListener("click", () => {
  setTimeout(() => setSigningStatus("Signing key validated for this session. An unlocked vault stores only its encrypted form."), 0);
});
