const rewrite = (target: HTMLElement): void => {
  const value = target.textContent ?? "";
  if (/OpenAI API key imported and saved locally\.?/iu.test(value)) {
    target.textContent = "OpenAI API key imported for this page session and saved encrypted when the vault is unlocked.";
  }
  if (/Bundle loaded\. The page is validating it for this session and encrypted vault\.?/iu.test(value)) {
    target.textContent = "Bundle loaded for this page session. An unlocked vault stores only its encrypted form.";
  }
};

const observe = (selector: string): void => {
  const target = document.querySelector<HTMLElement>(selector);
  if (target === null) return;
  rewrite(target);
  new MutationObserver(() => rewrite(target)).observe(target, {
    childList: true,
    characterData: true,
    subtree: true,
  });
};

observe("#openAiKeyToolStatus");
observe("#signingKeyExportStatus");
