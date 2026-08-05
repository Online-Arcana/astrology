const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const nextPaint = (): Promise<void> => new Promise((resolve) => {
  let complete = false;
  const finish = (): void => {
    if (complete) return;
    complete = true;
    resolve();
  };
  window.setTimeout(finish, 150);
  requestAnimationFrame(() => requestAnimationFrame(finish));
});

const progressCard = (): HTMLElement | null => element<HTMLElement>("#progressCard");

const showPreparation = (): void => {
  element<HTMLButtonElement>('.tab[data-panel="createPanel"]')?.click();

  const card = progressCard();
  if (card !== null) {
    card.classList.remove("hidden");
    card.dataset["maintenancePreparation"] = "true";
    card.setAttribute("aria-busy", "true");
  }

  const bar = element<HTMLElement>("#progressBar");
  if (bar !== null) bar.style.width = "0%";

  const numbers = element<HTMLElement>("#progressNumbers");
  if (numbers !== null) numbers.textContent = "Preparing the audited chart for recalculation";

  const summary = element<HTMLElement>("#progressSummary");
  if (summary !== null) {
    summary.textContent = "Loading accepted interpretations into the normal generation runtime. The live lanes, ETA, token usage and cost will appear next.";
  }

  const eta = element<HTMLElement>("#generationEta");
  if (eta !== null) eta.textContent = "Calculating…";

  element<HTMLElement>("#laneList")?.replaceChildren();
  element<HTMLElement>("#billingPanel")?.classList.add("hidden");
  card?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const generationTookOver = (): void => {
  const card = progressCard();
  if (card?.dataset["maintenancePreparation"] !== "true") return;
  const numbers = element<HTMLElement>("#progressNumbers")?.textContent ?? "";
  if (!/^\d+\s+of\s+\d+/u.test(numbers)) return;
  delete card.dataset["maintenancePreparation"];
  card.setAttribute("aria-busy", "false");
};

const preparationFailed = (): void => {
  const card = progressCard();
  if (card?.dataset["maintenancePreparation"] !== "true") return;
  const status = element<HTMLElement>("#canonicaliseStatus");
  if (status === null || !status.classList.contains("warning")) return;
  delete card.dataset["maintenancePreparation"];
  card.removeAttribute("aria-busy");
  card.classList.add("hidden");
  element<HTMLButtonElement>('.tab[data-panel="openPanel"]')?.click();
  status.scrollIntoView({ behavior: "smooth", block: "center" });
};

const numbers = element<HTMLElement>("#progressNumbers");
if (numbers !== null) {
  new MutationObserver(generationTookOver).observe(numbers, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const status = element<HTMLElement>("#canonicaliseStatus");
if (status !== null) {
  new MutationObserver(preparationFailed).observe(status, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("#canonicaliseRun")
    : null;
  if (target === null) return;
  if (element<HTMLInputElement>("#canonicaliseComplete")?.checked !== true) return;

  if (target.dataset["maintenancePaintReady"] === "true") {
    delete target.dataset["maintenancePaintReady"];
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  target.disabled = true;
  showPreparation();

  void nextPaint().then(() => {
    target.dataset["maintenancePaintReady"] = "true";
    target.disabled = false;
    target.click();
  });
}, true);
