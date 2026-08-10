import { displayReadingTitle, readingDescription } from "./readingHelp.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const zodiacOrder = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

const readingSummary = (reading: HTMLDetailsElement): HTMLElement | null =>
  reading.querySelector<HTMLElement>(":scope > summary");

const readingBody = (reading: HTMLDetailsElement): HTMLElement | null =>
  reading.querySelector<HTMLElement>(":scope > .chart-reading-body");

const normaliseReading = (reading: HTMLDetailsElement): string => {
  const summary = readingSummary(reading);
  if (summary === null) return "Chart section";
  const original = reading.dataset["originalTitle"] ?? summary.textContent?.trim() ?? "Chart section";
  reading.dataset["originalTitle"] = original;
  const title = displayReadingTitle(original);
  if (summary.textContent !== title) summary.textContent = title;

  const link = element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
  if (link !== null) link.textContent = title;

  const body = readingBody(reading);
  const description = readingDescription(original);
  if (body !== null && description !== null) {
    let explanation = body.querySelector<HTMLElement>(":scope > .chart-reading-explainer");
    if (explanation === null) {
      explanation = document.createElement("p");
      explanation.className = "chart-reading-explainer";
      body.prepend(explanation);
    }
    explanation.textContent = description;
  }
  return title;
};

interface CompatibilityTitle {
  domain: string;
  sign: string | null;
}

interface CompatibilityReading {
  sign: string;
  reading: HTMLDetailsElement;
}

interface CompatibilityDomainGroup {
  domain: string;
  overview: HTMLDetailsElement | null;
  signs: CompatibilityReading[];
}

interface CompatibilityBucket {
  id: string;
  title: string;
  domains: Map<string, CompatibilityDomainGroup>;
}

const compatibilityTitle = (title: string): CompatibilityTitle | null => {
  const match = /^(.*?)\s+compatibility(?:\s+with\s+(.+))?$/iu.exec(title.trim());
  const domain = match?.[1]?.trim();
  if (domain === undefined || domain.length === 0) return null;
  return { domain, sign: match?.[2]?.trim() ?? null };
};

const compatibilitySignOrder = (left: string, right: string): number => {
  const leftIndex = zodiacOrder.findIndex((sign) => sign.toLocaleLowerCase("en-GB") === left.toLocaleLowerCase("en-GB"));
  const rightIndex = zodiacOrder.findIndex((sign) => sign.toLocaleLowerCase("en-GB") === right.toLocaleLowerCase("en-GB"));
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return left.localeCompare(right, "en-GB");
};

const domainName = (domain: string): string => {
  const normal = domain.toLocaleLowerCase("en-GB").replaceAll(/[_\s-]+/gu, " ").trim();
  const names: Readonly<Record<string, string>> = {
    overall: "Overall",
    romantic: "Romantic",
    sexual: "Sexual",
    emotional: "Emotional",
    communication: "Communication",
    intellectual: "Intellectual",
    friendship: "Friendship",
    business: "Business",
    domestic: "Home and domestic life",
    "long term": "Long-term",
    "conflict resolution": "Conflict resolution",
    spiritual: "Spiritual",
  };
  return names[normal] ?? `${normal[0]?.toLocaleUpperCase("en-GB") ?? ""}${normal.slice(1)}`;
};

const bucketFor = (domain: string): { id: string; title: string } => {
  const normal = domain.toLocaleLowerCase("en-GB").replaceAll(/[_\s-]+/gu, " ").trim();
  if (["romantic", "emotional", "domestic", "long term"].includes(normal)) {
    return { id: "relationships", title: "Relationships" };
  }
  if (normal === "sexual") return { id: "sexual", title: "Sexual" };
  if (["communication", "intellectual", "conflict resolution"].includes(normal)) {
    return { id: "communication", title: "Communication and understanding" };
  }
  if (normal === "friendship") return { id: "friendship", title: "Friendship" };
  if (normal === "business") return { id: "business", title: "Business" };
  if (normal === "spiritual") return { id: "spiritual", title: "Spiritual" };
  return { id: "overall", title: "Overall" };
};

const slug = (value: string): string => value
  .normalize("NFKD")
  .replaceAll(/[^A-Za-z0-9]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "")
  .toLocaleLowerCase("en-GB") || "section";

const rebuildCompatibilityIndex = (buckets: readonly HTMLDetailsElement[]): void => {
  const categoryLink = element<HTMLAnchorElement>('#formattedChartIndex a[href="#chart-category-compatibilities"]');
  const root = categoryLink?.closest("li")?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (root === null) return;
  root.replaceChildren();
  for (const bucket of buckets) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${bucket.id}`;
    link.textContent = bucket.querySelector(":scope > summary .compatibility-bucket-title")?.textContent?.trim() ?? "Compatibility";
    item.append(link);
    root.append(item);
  }
};

const enhanceCompatibilities = (): void => {
  const category = element<HTMLDetailsElement>("#chart-category-compatibilities");
  const body = category?.querySelector<HTMLElement>(":scope > .chart-category-body") ?? null;
  if (category === null || body === null || category.dataset["compatibilityEnhanced"] === "true") return;

  const readings = [...body.querySelectorAll<HTMLDetailsElement>(":scope > details.chart-reading")];
  const buckets = new Map<string, CompatibilityBucket>();
  const allSigns = new Set<string>();

  for (const reading of readings) {
    const parsed = compatibilityTitle(normaliseReading(reading));
    if (parsed === null) continue;
    const bucketMeta = bucketFor(parsed.domain);
    const bucket = buckets.get(bucketMeta.id) ?? { ...bucketMeta, domains: new Map<string, CompatibilityDomainGroup>() };
    const domain = domainName(parsed.domain);
    const selected = bucket.domains.get(domain) ?? { domain, overview: null, signs: [] };
    if (parsed.sign === null) selected.overview = reading;
    else {
      const sign = displayReadingTitle(parsed.sign);
      selected.signs.push({ sign, reading });
      allSigns.add(sign);
    }
    bucket.domains.set(domain, selected);
    buckets.set(bucket.id, bucket);
  }
  if (buckets.size === 0) return;

  const orderedBucketIds = ["overall", "relationships", "sexual", "communication", "friendship", "business", "spiritual"];
  const bucketElements: HTMLDetailsElement[] = [];
  const signReadings: CompatibilityReading[] = [];

  const filter = document.createElement("label");
  filter.className = "compatibility-sign-filter";
  const filterLabel = document.createElement("span");
  filterLabel.textContent = "Show compatibility with";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Filter compatibility readings by zodiac sign");
  select.append(new Option("All zodiac signs", ""));
  const sortedSigns = [...allSigns].sort(compatibilitySignOrder);
  for (const sign of sortedSigns) select.append(new Option(sign, sign.toLocaleLowerCase("en-GB")));
  filter.append(filterLabel, select);

  for (const bucketId of orderedBucketIds) {
    const bucket = buckets.get(bucketId);
    if (bucket === undefined) continue;

    const bucketDetails = document.createElement("details");
    bucketDetails.className = "compatibility-bucket";
    bucketDetails.id = `compatibility-bucket-${bucket.id}`;
    const bucketSummary = document.createElement("summary");
    const bucketTitle = document.createElement("span");
    bucketTitle.className = "compatibility-bucket-title";
    bucketTitle.textContent = bucket.title;
    const bucketCount = document.createElement("span");
    bucketCount.className = "chart-category-count";
    bucketCount.textContent = `${bucket.domains.size} ${bucket.domains.size === 1 ? "area" : "areas"}`;
    bucketSummary.append(bucketTitle, bucketCount);

    const bucketBody = document.createElement("div");
    bucketBody.className = "compatibility-bucket-body";
    const domains = [...bucket.domains.values()];
    for (const domain of domains) {
      domain.signs.sort((left, right) => compatibilitySignOrder(left.sign, right.sign));
      signReadings.push(...domain.signs);

      const domainDetails = document.createElement("details");
      domainDetails.className = "compatibility-domain";
      domainDetails.id = `compatibility-domain-${slug(`${bucket.id}-${domain.domain}`)}`;
      const domainSummary = document.createElement("summary");
      const domainTitle = document.createElement("span");
      domainTitle.className = "compatibility-domain-title";
      domainTitle.textContent = domain.domain;
      const domainCount = document.createElement("span");
      domainCount.className = "chart-category-count";
      domainCount.textContent = `${domain.signs.length} signs`;
      domainSummary.append(domainTitle, domainCount);

      const domainBody = document.createElement("div");
      domainBody.className = "compatibility-domain-body";
      if (domain.overview !== null) {
        const summaryElement = readingSummary(domain.overview);
        if (summaryElement !== null) summaryElement.textContent = "Overview";
        domainBody.append(domain.overview);
      }
      for (const { sign, reading } of domain.signs) {
        const summaryElement = readingSummary(reading);
        if (summaryElement !== null) summaryElement.textContent = sign;
        reading.dataset["compatibilitySign"] = sign.toLocaleLowerCase("en-GB");
        domainBody.append(reading);
      }

      domainDetails.append(domainSummary, domainBody);
      bucketBody.append(domainDetails);
    }

    bucketDetails.append(bucketSummary, bucketBody);
    bucketElements.push(bucketDetails);
  }

  select.addEventListener("change", () => {
    const selected = select.value;
    for (const { sign, reading } of signReadings) {
      reading.hidden = selected.length > 0 && sign.toLocaleLowerCase("en-GB") !== selected;
    }
    category.dataset["compatibilityFilter"] = selected;
  });

  body.replaceChildren(filter, ...bucketElements);
  category.dataset["compatibilityEnhanced"] = "true";
  const categoryCount = category.querySelector<HTMLElement>(":scope > summary .chart-category-count");
  if (categoryCount !== null) categoryCount.textContent = `${bucketElements.length} groups`;
  rebuildCompatibilityIndex(bucketElements);
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
