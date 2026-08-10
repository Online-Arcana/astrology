import type { Aspect } from "../types/astro.js";
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

const aspectMeanings: Readonly<Record<Aspect["kind"], string>> = {
  conjunction: "The two points act together and intensify one another. Their themes are difficult to separate in this part of the chart.",
  opposition: "The two points pull from opposite sides. The aspect asks for balance, awareness and integration between them.",
  trine: "The two points tend to work together easily. Their themes reinforce one another with relatively little friction.",
  square: "The two points create friction and pressure. The tension can be demanding, but it can also drive action and development.",
  sextile: "The two points support one another through an opportunity that becomes stronger when it is actively used.",
  quincunx: "The two points do not fit together naturally. Repeated adjustment and compromise are usually needed between their themes.",
  semisextile: "The connection is subtle and adjacent. The two themes can support one another, but usually require conscious attention.",
  semisquare: "A low-level but persistent tension links the two points, often creating irritation that pushes for adjustment or action.",
  sesquiquadrate: "The two points create sustained internal pressure. The tension is less obvious than a square but can become difficult to ignore.",
  quintile: "The two points are linked through creative or specialised potential that can be developed deliberately.",
  biquintile: "The two points form a strong creative or inventive connection, often expressed through refinement, technique or unusual problem-solving.",
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

const addAspectExplanations = (wheel: HTMLElement, calculation: AstralCalculation): void => {
  const detail = wheel.querySelector<HTMLElement>(".wheel-detail");
  if (detail === null) return;

  const visibleAspects = calculation.system.aspects.filter((aspect) =>
    calculation.system.points[aspect.a].position.value !== null
    && calculation.system.points[aspect.b].position.value !== null);
  const hitLines = [...wheel.querySelectorAll<SVGLineElement>(".wheel-aspect-hit")];

  hitLines.forEach((hit, index) => {
    const aspect = visibleAspects[index];
    if (aspect === undefined) return;
    const visible = hit.previousElementSibling?.classList.contains("wheel-aspect") === true
      ? hit.previousElementSibling as SVGLineElement
      : null;
    hit.dataset["aspect"] = aspect.id;

    const showMeaning = (): void => {
      const list = detail.querySelector<HTMLDListElement>(".wheel-detail-list");
      if (list === null) return;
      const labels = [...list.querySelectorAll("dt")].map((term) => term.textContent?.trim() ?? "");
      if (!labels.includes("Points") || !labels.includes("Exact angle")) return;
      if (list.querySelector(".wheel-aspect-meaning-label") !== null) return;
      const term = document.createElement("dt");
      term.className = "wheel-aspect-meaning-label";
      term.textContent = "Meaning";
      const description = document.createElement("dd");
      description.className = "wheel-aspect-meaning";
      description.textContent = aspectMeanings[aspect.kind];
      list.append(term, description);
      visible?.classList.add("is-active");
    };

    const clearHighlight = (): void => { visible?.classList.remove("is-active"); };
    hit.addEventListener("mouseenter", showMeaning);
    hit.addEventListener("focus", showMeaning);
    hit.addEventListener("click", showMeaning);
    hit.addEventListener("mouseleave", clearHighlight);
    hit.addEventListener("blur", clearHighlight);
  });
};

const renderIntoCard = (card: HTMLElement, calculation: AstralCalculation): void => {
  card.querySelector(".chart-wheel")?.remove();
  const wheel = renderChartWheel(calculation);
  applyCanonicalWheelGlyphs(wheel);
  addAspectExplanations(wheel, calculation);
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
  const formattedChart = document.querySelector<HTMLElement>("#formattedChart");
  if (formattedChart === null) return null;
  formattedChart.classList.add("chart-wheel-host");

  const existing = document.querySelector<HTMLElement>("#fileChartWheelCard");
  if (existing !== null && !(existing instanceof HTMLDetailsElement)) existing.remove();

  const current = document.querySelector<HTMLDetailsElement>("#fileChartWheelCard");
  if (current !== null) {
    if (current.parentElement !== formattedChart) formattedChart.prepend(current);
    const body = current.querySelector<HTMLElement>(":scope > .chart-wheel-category-body");
    if (body !== null) return body;
    current.remove();
  }

  const category = document.createElement("details");
  category.id = "fileChartWheelCard";
  category.className = "chart-category chart-wheel-card chart-wheel-category";
  category.open = true;

  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.textContent = "Chart wheel";
  summary.append(title);

  const body = document.createElement("div");
  body.className = "chart-category-body chart-wheel-category-body";
  category.append(summary, body);
  formattedChart.prepend(category);
  return body;
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
