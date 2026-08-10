import type { AstralCalculation, AstralFile } from "../types/file.js";
import { renderChartWheel } from "./chartWheel.js";
import { applyCanonicalWheelGlyphs } from "./chartWheelGlyphs.js";

const stylesheetId = "astralChartWheelStyles";
if (document.getElementById(stylesheetId) === null) {
  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = "./chart-wheel.css";
  document.head.append(link);
}

const isCalculation = (value: unknown): value is AstralCalculation => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as { schema?: unknown }).schema === "astral-calculation/1.1.0";
};

const isAstralWithCalculation = (value: unknown): value is Pick<AstralFile, "astral-calculation"> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return isCalculation((value as { "astral-calculation"?: unknown })["astral-calculation"]);
};

const cardShell = (id: string, heading: string): HTMLElement => {
  const card = document.createElement("section");
  card.id = id;
  card.className = "card chart-wheel-card";

  const header = document.createElement("div");
  header.className = "section-heading";
  const title = document.createElement("h2");
  title.textContent = heading;
  header.append(title);

  card.append(header);
  return card;
};

const renderIntoCard = (card: HTMLElement, calculation: AstralCalculation): void => {
  card.querySelector(".chart-wheel")?.remove();
  const wheel = renderChartWheel(calculation);
  applyCanonicalWheelGlyphs(wheel);
  card.append(wheel);
};

const ensureLiveCard = (): HTMLElement | null => {
  const createPanel = document.querySelector<HTMLElement>("#createPanel");
  if (createPanel === null) return null;
  const existing = createPanel.querySelector<HTMLElement>("#liveChartWheelCard");
  if (existing !== null) return existing;
  const card = cardShell("liveChartWheelCard", "Your chart wheel");
  const progress = createPanel.querySelector<HTMLElement>("#progressCard");
  if (progress === null) createPanel.append(card);
  else progress.insertAdjacentElement("afterend", card);
  return card;
};

const showLiveCalculation = (calculation: AstralCalculation): void => {
  const card = ensureLiveCard();
  if (card === null) return;
  renderIntoCard(card, calculation);
  card.classList.remove("hidden");
};

const viewerCard = (): HTMLElement | null => {
  const formattedView = document.querySelector<HTMLElement>("#formattedView");
  if (formattedView === null) return null;

  const existing = document.querySelector<HTMLElement>("#fileChartWheelCard");
  if (existing !== null) {
    if (existing.parentElement !== formattedView) formattedView.prepend(existing);
    formattedView.classList.add("chart-wheel-mounted");
    return existing;
  }

  const card = cardShell("fileChartWheelCard", "Chart wheel");
  formattedView.prepend(card);
  formattedView.classList.add("chart-wheel-mounted");
  return card;
};

export const mountViewerChartWheel = (calculation: AstralCalculation): void => {
  const card = viewerCard();
  if (card === null) return;
  renderIntoCard(card, calculation);
  lastViewerFingerprint = calculation.provenance.calculationFingerprint;
};

let lastViewerFingerprint: string | null = null;
let syncingViewerWheel = false;

const viewerWheelPresent = (): boolean =>
  document.querySelector("#fileChartWheelCard .chart-wheel svg") !== null;

const syncViewerWheel = (): void => {
  if (syncingViewerWheel) return;
  const raw = document.querySelector<HTMLElement>("#rawChart")?.textContent?.trim() ?? "";
  if (raw.length === 0) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isAstralWithCalculation(parsed)) return;

  const calculation = parsed["astral-calculation"];
  const fingerprint = calculation.provenance.calculationFingerprint;
  if (fingerprint === lastViewerFingerprint && viewerWheelPresent()) return;

  syncingViewerWheel = true;
  try {
    mountViewerChartWheel(calculation);
  } finally {
    syncingViewerWheel = false;
  }
};

window.addEventListener("astral:calculation", (event) => {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (isCalculation(detail)) showLiveCalculation(detail);
});

const rawChart = document.querySelector<HTMLElement>("#rawChart");
if (rawChart !== null) {
  new MutationObserver(syncViewerWheel).observe(rawChart, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const formattedChart = document.querySelector<HTMLElement>("#formattedChart");
if (formattedChart !== null) {
  new MutationObserver(syncViewerWheel).observe(formattedChart, {
    childList: true,
    subtree: false,
  });
}

window.addEventListener("pageshow", syncViewerWheel);
queueMicrotask(syncViewerWheel);
