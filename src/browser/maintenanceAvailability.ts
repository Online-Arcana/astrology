const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const setStatus = (message: string): void => {
  const status = element<HTMLElement>("#canonicaliseStatus");
  if (status === null) return;
  status.textContent = message;
  status.className = "notice warning canonicalise-analysis";
};

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("#canonicaliseRun")
    : null;
  if (target === null) return;
  if (element<HTMLInputElement>("#canonicaliseComplete")?.checked !== true) return;
  if (element<HTMLButtonElement>("#generateButton")?.disabled !== true) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  setStatus("Finish or stop the current chart generation before starting this recalculation.");
}, true);
