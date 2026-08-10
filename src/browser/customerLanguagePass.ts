import { customerReadingDescription, customerReadingTitle } from "./customerReadingHelp.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const categoryLabels: Readonly<Record<string, string>> = {
  "chart-category-synthesis": "Overview",
  "chart-category-general": "Life themes",
  "chart-category-relationships": "Relationships, family and intimacy",
  "chart-category-work": "Work, money and public life",
  "chart-category-growth": "Growth, wellbeing and meaning",
  "chart-category-points": "Personality and life direction",
  "chart-category-houses": "Life areas",
  "chart-category-aspects": "How your chart factors work together",
  "chart-category-compatibilities": "Compatibility",
  "chart-category-technical": "Chart details and calculations",
};

const groupLabels: Readonly<Record<string, string>> = {
  "chart-group-synthesis-at-a-glance": "Your chart at a glance",
  "chart-group-general-core-themes": "Core themes",
  "chart-group-relationships-love-partnership": "Love, intimacy and partnership",
  "chart-group-relationships-family-home": "Home, family and upbringing",
  "chart-group-relationships-friends-community": "Friends and community",
  "chart-group-relationships-relationships-connection": "Relationships and connection",
  "chart-group-work-career-public": "Career and public life",
  "chart-group-work-money-business": "Money, business and leadership",
  "chart-group-work-work-contribution": "Work and daily contribution",
  "chart-group-growth-development": "Growth and development",
  "chart-group-growth-challenge-change": "Challenges, change and inner patterns",
  "chart-group-growth-wellbeing": "Wellbeing and daily rhythm",
  "chart-group-growth-spirituality": "Spirituality and meaning",
  "chart-group-points-luminaries-angles": "Identity, emotions and direction",
  "chart-group-points-personal-planets": "Thinking, relating and taking action",
  "chart-group-points-social-planets": "Growth, responsibility and maturity",
  "chart-group-points-outer-planets": "Change, ideals and transformation",
  "chart-group-points-nodes-points": "Life direction and significant turning points",
  "chart-group-houses-identity-resources-everyday": "Identity, resources and everyday life",
  "chart-group-houses-home-creativity-routines": "Home, creativity and daily routines",
  "chart-group-houses-partnerships-intimacy-worldview": "Partnerships, intimacy and worldview",
  "chart-group-houses-career-community-inner-life": "Career, community and inner life",
  "chart-group-houses-other-houses": "Other life areas",
  "chart-group-aspects-patterns": "Big-picture interaction patterns",
  "chart-group-aspects-conjunctions": "Strongly combined influences",
  "chart-group-aspects-oppositions": "Balancing opposite pulls",
  "chart-group-aspects-trines": "Natural strengths and easy flow",
  "chart-group-aspects-squares": "Pressure, friction and growth",
  "chart-group-aspects-sextiles": "Supportive opportunities",
  "chart-group-aspects-quincunxes": "Adjustment and compromise",
  "chart-group-aspects-semi-sextiles": "Subtle connections",
  "chart-group-aspects-semi-squares": "Low-level friction",
  "chart-group-aspects-sesquiquadrates": "Persistent pressure",
  "chart-group-aspects-creative-minor": "Creative talents and unusual strengths",
  "chart-group-aspects-declination": "Parallel and contrasting influences",
  "chart-group-aspects-other-aspects": "Other connections",
  "chart-group-technical-foundations": "Chart foundations and placements",
  "chart-group-technical-structure": "Overall structure and balance",
  "chart-group-technical-aspect-calculations": "How chart factors connect",
  "chart-group-technical-other-technical": "Other chart calculations",
};

const exactSectionLabels: Readonly<Record<string, string>> = {
  "Chart details": "Birth chart settings",
  "Planetary and calculated placements": "Where each chart factor is placed",
  "Lunar phase calculation": "Sun–Moon phase at birth",
  "Chart rulers and dominant features": "Strongest recurring influences",
  "Element, modality and polarity balance": "Overall balance of elements and qualities",
  "Major aspect calculations": "Main connections between chart factors",
  "Minor aspect calculations": "Subtle connections between chart factors",
  "Declination aspect calculations": "Parallel and contrasting influences",
  "Calculated aspect patterns": "Larger interaction patterns",
  "Eclipse calculations": "Eclipse background",
  "Overall chart interpretation": "Main themes",
  "Ascendant: outward style and approach": "How you come across to others",
  "Integrated chart synthesis": "How your chart fits together",
  "Final personal portrait": "Your overall portrait",
  "House cusps, rulers and occupants": "How each life area is structured",
};

const updateIndexToggleLabel = (link: HTMLAnchorElement): void => {
  const item = link.closest<HTMLLIElement>("li");
  const toggle = item?.querySelector<HTMLButtonElement>(":scope > .formatted-index-row > .formatted-index-branch-toggle") ?? null;
  if (toggle === null) return;
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-label", `${expanded ? "Hide" : "Show"} subsections of ${link.textContent?.trim() ?? "this section"}`);
};

const setIndexLabel = (href: string, title: string): void => {
  const link = element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(href)}"]`);
  if (link === null) return;
  if (link.textContent !== title) link.textContent = title;
  updateIndexToggleLabel(link);
};

const plainCategories = (): void => {
  for (const category of document.querySelectorAll<HTMLDetailsElement>("#formattedChart > details.chart-category")) {
    const label = categoryLabels[category.id];
    if (label === undefined) continue;
    const title = category.querySelector<HTMLElement>(":scope > summary > span:not(.chart-category-count)");
    if (title !== null && title.textContent !== label) title.textContent = label;
    setIndexLabel(category.id, label);
  }
};

const plainGroups = (): void => {
  for (const group of document.querySelectorAll<HTMLDetailsElement>("#formattedChart details.chart-reading-group")) {
    const label = groupLabels[group.id];
    if (label === undefined) continue;
    const title = group.querySelector<HTMLElement>(":scope > summary .chart-reading-group-title");
    if (title !== null && title.textContent !== label) title.textContent = label;
    setIndexLabel(group.id, label);
  }
};

const plainReadings = (): void => {
  for (const reading of document.querySelectorAll<HTMLDetailsElement>("#formattedChart details.chart-reading")) {
    if (reading.closest("#chart-category-compatibilities") !== null) continue;
    const summary = reading.querySelector<HTMLElement>(":scope > summary");
    const body = reading.querySelector<HTMLElement>(":scope > .chart-reading-body");
    if (summary === null) continue;

    const original = reading.dataset["originalTitle"] ?? summary.textContent?.trim() ?? "Chart section";
    reading.dataset["originalTitle"] = original;
    const generated = customerReadingTitle(original);
    const title = exactSectionLabels[generated] ?? exactSectionLabels[summary.textContent?.trim() ?? ""] ?? generated;
    if (summary.textContent !== title) summary.textContent = title;
    setIndexLabel(reading.id, title);

    const description = customerReadingDescription(original);
    if (body !== null && description !== null) {
      let explanation = body.querySelector<HTMLElement>(":scope > .chart-reading-explainer");
      if (explanation === null) {
        explanation = document.createElement("p");
        explanation.className = "chart-reading-explainer";
        body.prepend(explanation);
      }
      if (explanation.textContent !== description) explanation.textContent = description;
    }

    // The canonical title remains in data-original-title. Do not lock the
    // rendered title: the technical enhancement pass may need to restore it
    // briefly before regrouping late-arriving sections, after which this pass
    // translates it back to customer language.
    reading.dataset["viewerTitleLocked"] = "false";
  }
};

let running = false;
const applyCustomerLanguage = (): void => {
  if (running) return;
  const host = element<HTMLElement>("#formattedChart");
  if (host === null || host.querySelector("details.chart-reading") === null) return;
  running = true;
  try {
    plainCategories();
    plainGroups();
    plainReadings();
  } finally {
    running = false;
  }
};

const host = element<HTMLElement>("#formattedChart");
if (host !== null) new MutationObserver(applyCustomerLanguage).observe(host, { childList: true, subtree: true });
const view = element<HTMLElement>("#formattedView");
if (view !== null) new MutationObserver(applyCustomerLanguage).observe(view, { childList: true, subtree: true });
queueMicrotask(applyCustomerLanguage);
