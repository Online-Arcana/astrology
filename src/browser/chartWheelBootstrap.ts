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

const cardShell = (id: string, eyebrow: string, heading: string, intro: string): HTMLElement => {
  const card = document.createElement("section");
  card.id = id;
  card.className = "card chart-wheel-card";

  const header = document.createElement("div");
  header.className = "section-heading";
  const copy = document.createElement("div");
  const overline = document.createElement("p");
  overline.className = "eyebrow";
  overline.textContent = eyebrow;
  const title = document.createElement("h2");
  title.textContent = heading;
  copy.append(overline, title);
  header.append(copy);

  const paragraph = document.createElement("p");
  paragraph.className = "wheel-intro";
  paragraph.textContent = intro;
  card.append(header, paragraph);
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
  const card = cardShell(
    "liveChartWheelCard",
    "Deterministic chart",
    "Your chart wheel",
    "The astronomical calculation is complete. You can explore the wheel while the interpretation is still being generated.",
  );
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
  const existing = formattedView.querySelector<HTMLElement>("#fileChartWheelCard");
  if (existing !== null) return existing;
  const card = cardShell(
    "fileChartWheelCard",
    "Deterministic reconstruction",
    "Chart wheel",
    "This wheel is rebuilt from the deterministic calculation already stored in the .astral file. No additional metadata is required.",
  );
  formattedView.prepend(card);
  return card;
};

let lastViewerFingerprint: string | null = null;
const syncViewerWheel = (): void => {
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
  if (fingerprint === lastViewerFingerprint) return;
  const card = viewerCard();
  if (card === null) return;
  renderIntoCard(card, calculation);
  lastViewerFingerprint = fingerprint;
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

syncViewerWheel();
