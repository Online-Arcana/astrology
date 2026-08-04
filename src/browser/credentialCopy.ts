const firstNotice = document.querySelector<HTMLElement>(".security-card > .notice");
if (firstNotice !== null) {
  firstNotice.textContent = "Credentials are never saved as plaintext by this version. You may keep them memory-only for the current page session or protect encrypted copies with a passkey, biometric or security key.";
}

const openAiNote = document.querySelector<HTMLElement>(".credential-openai .credential-note");
if (openAiNote !== null) {
  openAiNote.textContent = "Used from memory while this page is open. An unlocked encrypted vault updates automatically when the key changes.";
}

const warning = document.querySelector<HTMLElement>(".credential-warning");
if (warning !== null) {
  warning.textContent = "Normal generation signs only the chart being completed. The explicit test maintenance tool can create and sign a separate canonical copy of an opened file.";
}

const fileNotice = document.querySelector<HTMLElement>("#fileValidation");
if (fileNotice !== null) {
  fileNotice.textContent = "Opening a file never changes it. The maintenance tool can create a separate canonicalised or newly signed copy.";
}
