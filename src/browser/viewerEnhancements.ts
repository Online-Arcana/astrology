import { readingDescription, stripZodiacPrefix } from "./readingHelp.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const zodiacOrder = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

const replacements: readonly [RegExp, string][] = [
  [/^life\s+/iu, ""],
  [/^aspect\s+/iu, ""],
  [/^point\s+/iu, ""],
  [/^pattern\s+/iu, ""],
  [/^eclipse\s+/iu, ""],
  [/\brulership dignity\b/iu, "Rulership and dignity"],
  [/\bchildren And Nurturing\b/u, "Children and nurturing"],
  [/\bcommitted Partnerships\b/u, "Committed partnerships"],
  [/\bcommunity And Groups\b/u, "Community and groups"],
  [/\bhome And Family\b/u, "Home and family"],
  [/\bchildhood Patterns\b/u, "Childhood patterns"],
  [/\bunconscious Patterns\b/u, "Unconscious patterns"],
  [/\bnorth node mean south node mean\b/iu, "Mean lunar nodes"],
  [/\bnorth node true south node true\b/iu, "True lunar nodes"],
  [/\bantivertex vertex\b/iu, "Vertex–Antivertex"],
  [/\bascendant descendant\b/iu, "Ascendant–Descendant"],
  [/\bimum coeli midheaven\b/iu, "Imum Coeli–Midheaven"],
];

const humanTitle = (raw: string): string => {
  let value = stripZodiacPrefix(raw)
    .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll(/[_\.]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement).trim();
  if (value.length === 0) return "Chart section";
  return `${value[0]?.toLocaleUpperCase("en-GB") ?? ""}${value.slice(1)}`;
};

const readingSummary = (reading: HTMLDetailsElement): HTMLElement | null =>
  reading.querySelector<HTMLElement>(":scope > summary");

const readingBody = (reading: HTMLDetailsElement): HTMLElement | null =>
  reading.querySelector<HTMLElement>(":scope > .chart-reading-body");

const normaliseReading = (reading: HTMLDetailsElement): string => {
  const summary = readingSummary(reading);
  if (summary === null) return "Chart section";
  const original = summary.textContent?.trim() ?? "Chart section";
  const title = humanTitle(original);
  if (summary.textContent !== title) summary.textContent = title;

  const link = element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
  if (link !== null) link.textContent = title;

  const body = readingBody(reading);
  const description = readingDescription(title);
  if (body !== null && description !== null && body.querySelector(":scope > .chart-reading-explainer") === null) {
    const explanation = document.createElement("p");
    explanation.className = "chart-reading-explainer";
    explanation.textContent = description;
    body.prepend(explanation);
  }
  return title;
};

interface CompatibilityTitle {
  domain: string;
  sign: string | null;
}

const compatibilityTitle = (title: string): CompatibilityTitle | null => {
  const match = /^(.*?)\s+compatibility(?:\s+with\s+(.+))?$/iu.exec(title.trim());
  const domain = match?.[1]?.trim();
  if (domain === undefined || domain.length === 0) return null;
  return { domain: humanTitle(domain), sign: match?.[2]?.trim() ?? null };
};

const compatibilitySignOrder = (left: string, right: string): number => {
  const leftIndex = zodiacOrder.findIndex((sign) => sign.toLocaleLowerCase("en-GB") === left.toLocaleLowerCase("en-GB"));
  const rightIndex = zodiacOrder.findIndex((sign) => sign.toLocaleLowerCase("en-GB") === right.toLocaleLowerCase("en-GB"));
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return left.localeCompare(right, "en-GB");
};

const rebuildCompatibilityIndex = (domains: readonly HTMLDetailsElement[]): void => {
  const categoryLink = element<HTMLAnchorElement>('#formattedChartIndex a[href="#chart-category-compatibilities"]');
  const root = categoryLink?.closest("li")?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (root === null) return;
  root.replaceChildren();
  for (const domain of domains) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${domain.id}`;
    link.textContent = domain.querySelector(":scope > summary .compatibility-domain-title")?.textContent?.trim() ?? "Compatibility";
    item.append(link);
    root.append(item);
  }
};

const enhanceCompatibilities = (): void => {
  const category = element<HTMLDetailsElement>("#chart-category-compatibilities");
  const body = category?.querySelector<HTMLElement>(":scope > .chart-category-body") ?? null;
  if (category === null || body === null || category.dataset["compatibilityEnhanced"] === "true") return;

  const readings = [...body.querySelectorAll<HTMLDetailsElement>(":scope > details.chart-reading")];
  const grouped = new Map<string, { overview: HTMLDetailsElement | null; signs: { sign: string; reading: HTMLDetailsElement }[] }>();
  for (const reading of readings) {
    const parsed = compatibilityTitle(normaliseReading(reading));
    if (parsed === null) continue;
    const selected = grouped.get(parsed.domain) ?? { overview: null, signs: [] };
    if (parsed.sign === null) selected.overview = reading;
    else selected.signs.push({ sign: humanTitle(parsed.sign), reading });
    grouped.set(parsed.domain, selected);
  }
  if (grouped.size === 0) return;

  const domainElements: HTMLDetailsElement[] = [];
  for (const [domain, values] of grouped) {
    values.signs.sort((left, right) => compatibilitySignOrder(left.sign, right.sign));
    const details = document.createElement("details");
    details.className = "compatibility-domain";
    details.id = `compatibility-domain-${domain.toLocaleLowerCase("en-GB").replaceAll(/[^a-z0-9]+/gu, "-").replaceAll(/^-+|-+$/gu, "")}`;

    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.className = "compatibility-domain-title";
    title.textContent = `${domain} compatibility`;
    const count = document.createElement("span");
    count.className = "chart-category-count";
    count.textContent = `${values.signs.length} signs`;
    summary.append(title, count);

    const domainBody = document.createElement("div");
    domainBody.className = "compatibility-domain-body";

    if (values.signs.length > 0) {
      const filter = document.createElement("label");
      filter.className = "compatibility-sign-filter";
      const text = document.createElement("span");
      text.textContent = "Filter by zodiac sign";
      const select = document.createElement("select");
      select.append(new Option("All signs", ""));
      for (const { sign } of values.signs) select.append(new Option(sign, sign.toLocaleLowerCase("en-GB")));
      filter.append(text, select);
      domainBody.append(filter);
      select.addEventListener("change", () => {
        const selected = select.value;
        for (const { sign, reading } of values.signs) {
          reading.hidden = selected.length > 0 && sign.toLocaleLowerCase("en-GB") !== selected;
          if (!reading.hidden && selected.length > 0) reading.open = true;
        }
      });
    }

    if (values.overview !== null) {
      const summaryElement = readingSummary(values.overview);
      if (summaryElement !== null) summaryElement.textContent = "Overview";
      domainBody.append(values.overview);
    }
    for (const { sign, reading } of values.signs) {
      const summaryElement = readingSummary(reading);
      if (summaryElement !== null) summaryElement.textContent = sign;
      reading.dataset["compatibilitySign"] = sign.toLocaleLowerCase("en-GB");
      domainBody.append(reading);
    }

    details.append(summary, domainBody);
    domainElements.push(details);
  }

  body.replaceChildren(...domainElements);
  category.dataset["compatibilityEnhanced"] = "true";
  const categoryCount = category.querySelector<HTMLElement>(":scope > summary .chart-category-count");
  if (categoryCount !== null) categoryCount.textContent = `${domainElements.length} domain${domainElements.length === 1 ? "" : "s"}`;
  rebuildCompatibilityIndex(domainElements);
};

const enhanceIndex = (): void => {
  const view = element<HTMLElement>("#formattedView");
  const nav = element<HTMLElement>("#formattedChartIndex");
  if (view === null || nav === null || nav.dataset["collapsible"] === "true") return;
  const heading = nav.querySelector<HTMLElement>(":scope > h3");
  const list = nav.querySelector<HTMLUListElement>(":scope > ul");
  if (heading === null || list === null) return;

  const header = document.createElement("div");
  header.className = "formatted-index-header";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ghost formatted-index-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "formattedChartIndexContents");
  const title = document.createElement("span");
  title.textContent = "Chart index";
  const action = document.createElement("span");
  action.className = "formatted-index-toggle-action";
  action.textContent = "Show";
  toggle.append(title, action);
  header.append(toggle);

  const contents = document.createElement("div");
  contents.id = "formattedChartIndexContents";
  contents.className = "formatted-chart-index-contents";
  contents.hidden = true;
  contents.append(list);
  heading.remove();
  nav.prepend(header, contents);
  nav.dataset["collapsible"] = "true";
  view.classList.add("index-collapsed");

  const setExpanded = (expanded: boolean): void => {
    toggle.setAttribute("aria-expanded", String(expanded));
    action.textContent = expanded ? "Hide" : "Show";
    contents.hidden = !expanded;
    view.classList.toggle("index-collapsed", !expanded);
  };
  toggle.addEventListener("click", () => setExpanded(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href^='#']") : null;
    if (link !== null && matchMedia("(max-width: 980px)").matches) setExpanded(false);
  });
};

let enhancing = false;
const enhance = (): void => {
  if (enhancing) return;
  const host = element<HTMLElement>("#formattedChart");
  if (host === null || host.querySelector("details.chart-reading") === null) return;
  enhancing = true;
  try {
    for (const reading of host.querySelectorAll<HTMLDetailsElement>("details.chart-reading")) normaliseReading(reading);
    enhanceCompatibilities();
    enhanceIndex();
  } finally {
    enhancing = false;
  }
};

const host = element<HTMLElement>("#formattedChart");
if (host !== null) {
  new MutationObserver(() => enhance()).observe(host, { childList: true, subtree: true });
}
const view = element<HTMLElement>("#formattedView");
if (view !== null) {
  new MutationObserver(() => enhanceIndex()).observe(view, { childList: true, subtree: true });
}
queueMicrotask(enhance);
