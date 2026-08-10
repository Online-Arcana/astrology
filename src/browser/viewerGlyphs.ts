const stylesheetId = "viewerGlyphsStylesheet";

if (document.getElementById(stylesheetId) === null) {
  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = "./viewer-glyphs.css";
  document.head.append(link);
}

type GlyphCategory = "zodiac" | "planets" | "points" | "angles" | "aspects" | "misc";

interface GlyphManifestItem {
  category: GlyphCategory;
  slug: string;
  label: string;
  file: string;
}

interface SemanticAlias {
  slug: string;
  phrases: readonly string[];
}

interface SemanticMatch {
  slug: string;
  start: number;
  end: number;
  length: number;
}

const glyphBase = "./assets/astrology-glyphs/";
const manifestUrl = `${glyphBase}manifest.json`;
const validCategories = new Set<GlyphCategory>(["zodiac", "planets", "points", "angles", "aspects", "misc"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const glyphCategory = (value: unknown): GlyphCategory | null => {
  if (typeof value !== "string") return null;
  return validCategories.has(value as GlyphCategory) ? value as GlyphCategory : null;
};

const manifestItem = (value: unknown): GlyphManifestItem | null => {
  if (!isRecord(value)) return null;
  const category = glyphCategory(value["category"]);
  const slug = value["slug"];
  const label = value["label"];
  const file = value["file"];
  if (category === null || typeof slug !== "string" || typeof label !== "string" || typeof file !== "string") return null;
  if (!file.startsWith("svg/") || !file.endsWith(".svg") || file.includes("..")) return null;
  return { category, slug, label, file };
};

let manifestPromise: Promise<readonly GlyphManifestItem[]> | null = null;
const loadManifest = (): Promise<readonly GlyphManifestItem[]> => {
  manifestPromise ??= (async () => {
    try {
      const response = await fetch(manifestUrl, { cache: "force-cache" });
      if (!response.ok) return [];
      const parsed: unknown = await response.json();
      if (!isRecord(parsed) || !Array.isArray(parsed["items"])) return [];
      return parsed["items"].map(manifestItem).filter((item): item is GlyphManifestItem => item !== null);
    } catch {
      // The formatted chart remains fully usable when decorative glyph assets are unavailable.
      return [];
    }
  })();
  return manifestPromise;
};

// The manifest contains several historical/astronomical variants. The client viewer deliberately
// uses the common astrological form while keeping every imported variant available for other outputs.
const preferredViewerVariants: Readonly<Record<string, string>> = {
  uranus: "uranus",
  neptune: "neptune",
  pluto: "pluto",
  eris: "eris_form_one",
};

const semanticAliases: readonly SemanticAlias[] = [
  { slug: "mean_node", phrases: ["north node mean", "mean north node"] },
  { slug: "true_node", phrases: ["north node true", "true north node"] },
  { slug: "north_node", phrases: ["north node", "ascending node"] },
  { slug: "south_node", phrases: ["south node", "descending node"] },
  { slug: "black_moon_lilith", phrases: ["black moon lilith", "lilith true", "lilith mean", "lilith"] },
  { slug: "lot_of_fortune", phrases: ["part of fortune", "lot of fortune"] },
  { slug: "equatorial_ascendant", phrases: ["equatorial ascendant"] },
  { slug: "ascendant", phrases: ["ascendant"] },
  { slug: "descendant", phrases: ["descendant"] },
  { slug: "midheaven", phrases: ["midheaven"] },
  { slug: "imum_coeli", phrases: ["imum coeli"] },
  { slug: "east_point", phrases: ["east point"] },
  { slug: "vertex", phrases: ["vertex"] },
  { slug: "sun", phrases: ["sun"] },
  { slug: "moon", phrases: ["moon"] },
  { slug: "mercury", phrases: ["mercury"] },
  { slug: "venus", phrases: ["venus"] },
  { slug: "earth", phrases: ["earth"] },
  { slug: "mars", phrases: ["mars"] },
  { slug: "jupiter", phrases: ["jupiter"] },
  { slug: "saturn", phrases: ["saturn"] },
  { slug: preferredViewerVariants["uranus"] ?? "uranus", phrases: ["uranus"] },
  { slug: preferredViewerVariants["neptune"] ?? "neptune", phrases: ["neptune"] },
  { slug: preferredViewerVariants["pluto"] ?? "pluto", phrases: ["pluto"] },
  { slug: "ceres", phrases: ["ceres"] },
  { slug: "pallas", phrases: ["pallas"] },
  { slug: "juno", phrases: ["juno"] },
  { slug: "vesta", phrases: ["vesta"] },
  { slug: "chiron", phrases: ["chiron"] },
  { slug: "transpluto", phrases: ["transpluto"] },
  { slug: "proserpina", phrases: ["proserpina"] },
  { slug: "astraea", phrases: ["astraea"] },
  { slug: "hygiea", phrases: ["hygiea"] },
  { slug: "pholus", phrases: ["pholus"] },
  { slug: preferredViewerVariants["eris"] ?? "eris_form_one", phrases: ["eris"] },
  { slug: "sedna", phrases: ["sedna"] },
  { slug: "occultation", phrases: ["occultation"] },
  { slug: "lunar_eclipse", phrases: ["lunar eclipse"] },
  { slug: "solar_eclipse", phrases: ["solar eclipse"] },
  { slug: "conjunction", phrases: ["conjunction", "conjunct"] },
  { slug: "opposition", phrases: ["opposition", "opposite"] },
  { slug: "semi_sextile", phrases: ["semi sextile", "semisextile"] },
  { slug: "sextile", phrases: ["sextile"] },
  { slug: "quincunx", phrases: ["quincunx"] },
  { slug: "sesquiquadrate", phrases: ["sesquiquadrate"] },
  { slug: "semi_square", phrases: ["semi square", "semisquare"] },
  { slug: "square", phrases: ["square"] },
  { slug: "trine", phrases: ["trine"] },
  { slug: "contra_parallel", phrases: ["contra parallel", "contraparallel"] },
  { slug: "parallel", phrases: ["parallel"] },
  { slug: "retrograde", phrases: ["retrograde"] },
  { slug: "aries", phrases: ["aries"] },
  { slug: "taurus", phrases: ["taurus"] },
  { slug: "gemini", phrases: ["gemini"] },
  { slug: "cancer", phrases: ["cancer"] },
  { slug: "leo", phrases: ["leo"] },
  { slug: "virgo", phrases: ["virgo"] },
  { slug: "libra", phrases: ["libra"] },
  { slug: "scorpio", phrases: ["scorpio"] },
  { slug: "sagittarius", phrases: ["sagittarius"] },
  { slug: "capricorn", phrases: ["capricorn"] },
  { slug: "aquarius", phrases: ["aquarius"] },
  { slug: "pisces", phrases: ["pisces"] },
];

const aspectSlugs = new Set([
  "conjunction", "opposition", "sextile", "semi_sextile", "quincunx",
  "sesquiquadrate", "square", "trine", "semi_square", "parallel", "contra_parallel",
]);

const normaliseSemanticText = (value: string): string => value
  .toLocaleLowerCase("en-GB")
  .replaceAll(/[_./:–—-]+/gu, " ")
  .replaceAll(/[()[\]{}]+/gu, " ")
  .replaceAll(/\s+/gu, " ")
  .trim();

const phraseRange = (source: string, phrase: string): { start: number; end: number } | null => {
  const position = ` ${source} `.indexOf(` ${phrase} `);
  if (position < 0) return null;
  return { start: position, end: position + phrase.length };
};

const semanticSlugs = (rawTitle: string): readonly string[] => {
  const source = normaliseSemanticText(rawTitle.replace(/^\s*(?:tropical|sidereal)\s+/iu, ""));
  if (source.length === 0) return [];

  const matches: SemanticMatch[] = [];
  for (const alias of semanticAliases) {
    for (const phrase of alias.phrases) {
      const range = phraseRange(source, phrase);
      if (range === null) continue;
      matches.push({ slug: alias.slug, start: range.start, end: range.end, length: phrase.length });
      break;
    }
  }
  matches.sort((left, right) => left.start - right.start || right.length - left.length);

  const accepted: SemanticMatch[] = [];
  const usedSlugs = new Set<string>();
  for (const match of matches) {
    if (usedSlugs.has(match.slug)) continue;
    if (accepted.some((existing) => match.start < existing.end && match.end > existing.start)) continue;
    accepted.push(match);
    usedSlugs.add(match.slug);
  }

  const relation = accepted.find((match) => aspectSlugs.has(match.slug));
  const factors = accepted.filter((match) => !aspectSlugs.has(match.slug));
  if ((source.startsWith("aspect ") || source.includes(" aspect ")) && relation !== undefined && factors.length >= 2) {
    return [factors[0]?.slug ?? relation.slug, relation.slug, ...factors.slice(1).map((match) => match.slug)];
  }
  return accepted.map((match) => match.slug);
};

const categoryNames: Readonly<Record<GlyphCategory, string>> = {
  zodiac: "Zodiac signs",
  planets: "Planets",
  points: "Points",
  angles: "Angles",
  aspects: "Aspects",
  misc: "Other symbols",
};

const categoryOrder: readonly GlyphCategory[] = ["zodiac", "planets", "points", "angles", "aspects", "misc"];

const meanings: Readonly<Record<string, string>> = {
  sun: "identity, vitality and conscious direction",
  moon: "emotions, needs and instinctive responses",
  mercury: "thinking, communication and learning",
  venus: "affection, relating and values",
  earth: "the Earth reference point",
  mars: "drive, assertion and action",
  jupiter: "growth, confidence and opportunity",
  saturn: "structure, responsibility and limits",
  uranus: "change, independence and disruption",
  neptune: "imagination, ideals and dissolution",
  pluto: "transformation, intensity and power",
  north_node: "growth direction",
  south_node: "familiar patterns and defaults",
  mean_node: "the averaged North Node calculation",
  true_node: "the oscillating True North Node calculation",
  black_moon_lilith: "autonomy, instinct and taboo",
  lot_of_fortune: "ease, fulfilment and natural support",
  ascendant: "outward style and first approach",
  descendant: "close relationships and one-to-one encounters",
  midheaven: "career, reputation and public direction",
  imum_coeli: "home, roots and private foundations",
  equatorial_ascendant: "the equatorial Ascendant point",
  east_point: "personal presence and first impressions",
  vertex: "significant encounters and turning points",
  conjunction: "strongly combined influences",
  opposition: "balancing opposite pulls",
  trine: "natural strengths and easy flow",
  square: "pressure, friction and growth",
  sextile: "supportive opportunities",
  semi_sextile: "a subtle connection",
  quincunx: "adjustment and compromise",
  semi_square: "low-level friction",
  sesquiquadrate: "persistent pressure",
  parallel: "parallel declination",
  contra_parallel: "contrasting declination",
  retrograde: "apparent backward motion from Earth",
};

const meaningFor = (entry: GlyphManifestItem): string => meanings[entry.slug] ?? (() => {
  switch (entry.category) {
    case "zodiac": return "zodiac sign";
    case "planets": return "planetary or astronomical body";
    case "points": return "astrological point";
    case "angles": return "chart angle or calculated point";
    case "aspects": return "relationship between chart factors";
    case "misc": return "chart notation";
  }
})();

const glyphAssetPath = (entry: GlyphManifestItem): string => `${glyphBase}${entry.file}`;

const glyphElement = (entry: GlyphManifestItem): HTMLSpanElement => {
  const glyph = document.createElement("span");
  glyph.className = "astrology-glyph";
  glyph.dataset["glyphSlug"] = entry.slug;
  glyph.setAttribute("aria-hidden", "true");
  glyph.style.setProperty("--astrology-glyph-url", `url("${glyphAssetPath(entry)}")`);
  return glyph;
};

const glyphCluster = (entries: readonly GlyphManifestItem[]): HTMLSpanElement => {
  const cluster = document.createElement("span");
  cluster.className = "chart-symbol-cluster";
  cluster.dataset["glyphSignature"] = entries.map((entry) => entry.slug).join("|");
  cluster.setAttribute("aria-hidden", "true");
  cluster.append(...entries.map(glyphElement));
  return cluster;
};

const summaryText = (summary: HTMLElement): string =>
  summary.querySelector<HTMLElement>(":scope > .chart-symbol-titleline > .chart-symbol-title-text")?.textContent?.trim()
  ?? summary.textContent?.trim()
  ?? "Chart section";

const syncSummaryGlyphs = (summary: HTMLElement, entries: readonly GlyphManifestItem[]): void => {
  let titleline = summary.querySelector<HTMLElement>(":scope > .chart-symbol-titleline");
  const existing = titleline?.querySelector<HTMLElement>(":scope > .chart-symbol-cluster") ?? null;
  const signature = entries.map((entry) => entry.slug).join("|");

  if (entries.length === 0) {
    existing?.remove();
    titleline?.removeAttribute("data-glyph-signature");
    return;
  }
  if (existing?.dataset["glyphSignature"] === signature) return;

  if (titleline === null) {
    const title = summaryText(summary);
    titleline = document.createElement("span");
    titleline.className = "chart-symbol-titleline";
    const titleText = document.createElement("span");
    titleText.className = "chart-symbol-title-text";
    titleText.textContent = title;
    titleline.append(titleText);
    summary.replaceChildren(titleline);
  }

  existing?.remove();
  titleline.append(glyphCluster(entries));
  titleline.dataset["glyphSignature"] = signature;
};

const syncIndexGlyphs = (reading: HTMLDetailsElement, entries: readonly GlyphManifestItem[]): void => {
  if (reading.id.length === 0) return;
  const link = document.querySelector<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
  if (link === null) return;
  const existing = link.querySelector<HTMLElement>(":scope > .chart-symbol-cluster");
  const signature = entries.map((entry) => entry.slug).join("|");
  if (entries.length === 0) {
    existing?.remove();
    return;
  }
  if (existing?.dataset["glyphSignature"] === signature) return;
  existing?.remove();
  link.append(glyphCluster(entries));
};

const entriesForReading = (
  reading: HTMLDetailsElement,
  bySlug: ReadonlyMap<string, GlyphManifestItem>,
): readonly GlyphManifestItem[] => {
  const summary = reading.querySelector<HTMLElement>(":scope > summary");
  if (summary === null) return [];
  const source = reading.dataset["originalTitle"]?.trim() || summaryText(summary);
  const entries: GlyphManifestItem[] = [];
  for (const slug of semanticSlugs(source)) {
    const entry = bySlug.get(slug);
    if (entry !== undefined) entries.push(entry);
  }
  return entries;
};

const legendRow = (entry: GlyphManifestItem): HTMLDivElement => {
  const row = document.createElement("div");
  row.className = "chart-symbol-legend-row";
  row.append(glyphElement(entry));

  const copy = document.createElement("div");
  copy.className = "chart-symbol-legend-copy";
  const label = document.createElement("strong");
  label.textContent = entry.label;
  const meaning = document.createElement("small");
  meaning.textContent = meaningFor(entry);
  copy.append(label, meaning);
  row.append(copy);
  return row;
};

const syncLegend = (
  formattedView: HTMLElement,
  entries: readonly GlyphManifestItem[],
): void => {
  const sorted = [...entries].sort((left, right) => {
    const categoryDifference = categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category);
    return categoryDifference !== 0 ? categoryDifference : left.label.localeCompare(right.label, "en-GB");
  });
  const signature = sorted.map((entry) => entry.slug).join("|");
  let aside = formattedView.querySelector<HTMLElement>(":scope > #chartSymbolLegend");

  if (sorted.length === 0) {
    aside?.remove();
    formattedView.classList.remove("has-symbol-legend");
    return;
  }
  formattedView.classList.add("has-symbol-legend");
  if (aside?.dataset["glyphSignature"] === signature) return;

  const previousOpen = aside?.querySelector<HTMLDetailsElement>(":scope > details")?.open;
  if (aside === null) {
    aside = document.createElement("aside");
    aside.id = "chartSymbolLegend";
    aside.className = "chart-symbol-legend";
    formattedView.append(aside);
  }

  const details = document.createElement("details");
  details.className = "chart-symbol-legend-details";
  details.open = previousOpen ?? !window.matchMedia("(max-width: 1219px)").matches;

  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "chart-symbol-legend-heading";
  heading.textContent = "Chart symbols";
  const count = document.createElement("span");
  count.className = "chart-symbol-legend-count";
  count.textContent = `${sorted.length} used`;
  summary.append(heading, count);

  const body = document.createElement("div");
  body.className = "chart-symbol-legend-body";
  const intro = document.createElement("p");
  intro.className = "chart-symbol-legend-intro";
  intro.textContent = "A quick guide to the symbols used in this chart. Plain-English titles remain the primary labels.";
  body.append(intro);

  for (const category of categoryOrder) {
    const groupEntries = sorted.filter((entry) => entry.category === category);
    if (groupEntries.length === 0) continue;
    const section = document.createElement("section");
    section.className = "chart-symbol-legend-group";
    const groupHeading = document.createElement("h4");
    groupHeading.textContent = categoryNames[category];
    section.append(groupHeading, ...groupEntries.map(legendRow));
    body.append(section);
  }

  details.append(summary, body);
  aside.replaceChildren(details);
  aside.dataset["glyphSignature"] = signature;
};

let applying = false;
const applyViewerGlyphs = async (): Promise<void> => {
  if (applying) return;
  const formattedView = document.querySelector<HTMLElement>("#formattedView");
  const host = document.querySelector<HTMLElement>("#formattedChart");
  if (formattedView === null || host === null) return;

  applying = true;
  try {
    const manifest = await loadManifest();
    const bySlug = new Map(manifest.map((entry) => [entry.slug, entry] as const));
    const used = new Map<string, GlyphManifestItem>();

    for (const reading of host.querySelectorAll<HTMLDetailsElement>("details.chart-reading")) {
      const summary = reading.querySelector<HTMLElement>(":scope > summary");
      if (summary === null) continue;
      const entries = entriesForReading(reading, bySlug);
      syncSummaryGlyphs(summary, entries);
      syncIndexGlyphs(reading, entries);
      for (const entry of entries) used.set(entry.slug, entry);
    }

    syncLegend(formattedView, [...used.values()]);
  } finally {
    applying = false;
  }
};

const formattedView = document.querySelector<HTMLElement>("#formattedView");
if (formattedView !== null) {
  let timer = 0;
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void applyViewerGlyphs(), 0);
  };
  new MutationObserver(schedule).observe(formattedView, { childList: true, subtree: true });
  schedule();
}
