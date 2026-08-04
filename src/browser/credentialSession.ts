import { saveOpenAiKey } from "./keys.js";

const openAi = document.querySelector<HTMLInputElement>("#openAiKey");
const form = document.querySelector<HTMLFormElement>("#chartForm");

const syncOpenAiKey = (): void => {
  if (openAi === null) return;
  saveOpenAiKey(openAi.value);
};

openAi?.addEventListener("change", syncOpenAiKey);
openAi?.addEventListener("blur", syncOpenAiKey);

if (form !== null) {
  document.addEventListener("submit", (event) => {
    if (event.target !== form) return;
    syncOpenAiKey();
  }, true);
}
