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
  if (reading.dataset["viewerTitleLocked"] === "true") return summary.textContent?.trim() ?? "Chart section";

  const original = reading.dataset["originalTitle"] ?? summary.textContent?.trim() ?? "Chart section";
  reading.dataset["originalTitle"] = original;
  const title = displayReadingTitle(original);
  if (summary.textContent !== title) summary.textContent = title;

  const link = element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
  if (link !== null && link.textContent !== title) link.textContent = title;

  const body = readingBody(reading);
  const description = readingDescription(original);
  if (body !== null && description !== null) {
    let explanation = body.querySelector<HTMLElement>(":scope > .chart-reading-explainer");
    if (explanation === null) {
      explanation = document.createElement("p");
      explanation.className = "chart-reading-explainer";
      explanation.textContent = description;
      body.prepend(explanation);
    } else if (explanation.textContent !== description) {
      explanation.textContent = description;
    }
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

const indexLinkItem = (href: string, title: string): HTMLLIElement => {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = href;
  link.textContent = title;
  item.append(link);
  return item;
};

const rebuildCompatibilityIndex = (buckets: readonly HTMLDetailsElement[]): void => {
  const categoryLink = element<HTMLAnchorElement>('#formattedChartIndex a[href="#chart-category-compatibilities"]');
  const root = categoryLink?.closest("li")?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (root === null) return;
  root.replaceChildren();

  for (const bucket of buckets) {
    const bucketTitle = bucket.querySelector<HTMLElement>(":scope > summary .compatibility-bucket-title")?.textContent?.trim() ?? "Compatibility";
    const bucketItem = indexLinkItem(`#${bucket.id}`, bucketTitle);
    const domainList = document.createElement("ul");

    for (const domain of bucket.querySelectorAll<HTMLDetailsElement>(":scope > .compatibility-bucket-body > details.compatibility-domain")) {
      const domainTitle = domain.querySelector<HTMLElement>(":scope > summary .compatibility-domain-title")?.textContent?.trim() ?? "Compatibility area";
      const domainItem = indexLinkItem(`#${domain.id}`, domainTitle);
      const readingList = document.createElement("ul");

      for (const reading of domain.querySelectorAll<HTMLDetailsElement>(":scope > .compatibility-domain-body > details.chart-reading")) {
        const title = readingSummary(reading)?.textContent?.trim() ?? "Reading";
        readingList.append(indexLinkItem(`#${reading.id}`, title));
      }

      if (readingList.children.length > 0) domainItem.append(readingList);
      domainList.append(domainItem);
    }

    if (domainList.children.length > 0) bucketItem.append(domainList);
    root.append(bucketItem);
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
    for (const domain of bucket.domains.values()) {
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
        domain.overview.dataset["viewerTitleLocked"] = "true";
        domainBody.append(domain.overview);
      }
      for (const { sign, reading } of domain.signs) {
        const summaryElement = readingSummary(reading);
        if (summaryElement !== null) summaryElement.textContent = sign;
        reading.dataset["viewerTitleLocked"] = "true";
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

const setIndexBranchExpanded = (
  toggle: HTMLButtonElement,
  children: HTMLUListElement,
  expanded: boolean,
): void => {
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.classList.toggle("expanded", expanded);
  children.hidden = !expanded;
};

const enhanceIndexItem = (item: HTMLLIElement): void => {
  const children = item.querySelector<HTMLUListElement>(":scope > ul");
  if (children === null) return;

  let row = item.querySelector<HTMLElement>(":scope > .formatted-index-row");
  if (row === null) {
    const link = item.querySelector<HTMLAnchorElement>(":scope > a");
    if (link === null) return;

    row = document.createElement("div");
    row.className = "formatted-index-row";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ghost formatted-index-branch-toggle";
    toggle.textContent = "›";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", `Show subsections of ${link.textContent?.trim() ?? "this section"}`);
    row.append(toggle, link);
    item.insertBefore(row, children);
    children.hidden = true;

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      setIndexBranchExpanded(toggle, children, expanded);
      toggle.setAttribute(
        "aria-label",
        `${expanded ? "Hide" : "Show"} subsections of ${link.textContent?.trim() ?? "this section"}`,
      );
    });
  }

  for (const child of children.querySelectorAll<HTMLLIElement>(":scope > li")) enhanceIndexItem(child);
};

const enhanceIndex = (): void => {
  const nav = element<HTMLElement>("#formattedChartIndex");
  const list = nav?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (nav === null || list === null) return;
  nav.dataset["nestedBranches"] = "true";
  for (const item of list.querySelectorAll<HTMLLIElement>(":scope > li")) enhanceIndexItem(item);
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
