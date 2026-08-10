const synthesisTitles = new Set([
  "How your chart fits together",
  "Final portrait",
  "Integrated chart synthesis",
  "Final personal portrait",
  "Your overall portrait",
]);

// "Final synthesis" was the previous customer-facing label. The synthesis now leads the chart as Overview.
const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const ensureCategory = (): { details: HTMLDetailsElement; body: HTMLElement } | null => {
  const host = element<HTMLElement>("#formattedChart");
  if (host === null) return null;
  let details = element<HTMLDetailsElement>("#chart-category-synthesis");
  if (details === null) {
    details = document.createElement("details");
    details.id = "chart-category-synthesis";
    details.className = "chart-category";
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = "Overview";
    const count = document.createElement("span");
    count.className = "chart-category-count";
    summary.append(title, count);
    const body = document.createElement("div");
    body.className = "chart-category-body";
    details.append(summary, body);
  }
  const title = details.querySelector<HTMLElement>(":scope > summary > span:not(.chart-category-count)");
  if (title !== null) title.textContent = "Overview";
  details.open = true;
  host.prepend(details);
  const body = details.querySelector<HTMLElement>(":scope > .chart-category-body");
  return body === null ? null : { details, body };
};

const ensureIndexItem = (): HTMLUListElement | null => {
  const index = element<HTMLElement>("#formattedChartIndex");
  const root = index?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (root === null) return null;
  let categoryLink = root.querySelector<HTMLAnchorElement>('a[href="#chart-category-synthesis"]');
  let item = categoryLink?.closest<HTMLLIElement>("li") ?? null;
  if (categoryLink === null || item === null) {
    item = document.createElement("li");
    categoryLink = document.createElement("a");
    categoryLink.href = "#chart-category-synthesis";
    categoryLink.textContent = "Overview";
    const readings = document.createElement("ul");
    item.append(categoryLink, readings);
  } else {
    categoryLink.textContent = "Overview";
  }
  root.prepend(item);
  let readings = item.querySelector<HTMLUListElement>(":scope > ul");
  if (readings === null) {
    readings = document.createElement("ul");
    item.append(readings);
  }
  return readings;
};

const updateCount = (details: HTMLDetailsElement, body: HTMLElement): void => {
  const count = details.querySelector<HTMLElement>(":scope > summary .chart-category-count");
  if (count === null) return;
  const groups = body.querySelectorAll(":scope > details.chart-reading-group").length;
  if (groups > 0) {
    const label = `${groups} group${groups === 1 ? "" : "s"}`;
    if (count.textContent !== label) count.textContent = label;
    return;
  }
  const total = body.querySelectorAll(":scope > details.chart-reading").length;
  const label = `${total} section${total === 1 ? "" : "s"}`;
  if (count.textContent !== label) count.textContent = label;
};

let correcting = false;
const correct = (): void => {
  if (correcting) return;
  const readings = [...document.querySelectorAll<HTMLDetailsElement>("#formattedChart details.chart-reading")]
    .filter((reading) => synthesisTitles.has(reading.querySelector(":scope > summary")?.textContent?.trim() ?? ""));
  if (readings.length === 0) return;
  const target = ensureCategory();
  const index = ensureIndexItem();
  if (target === null || index === null) return;

  correcting = true;
  try {
    for (const reading of readings) {
      if (!target.details.contains(reading)) target.body.append(reading);
      const link = element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
      const item = link?.closest("li") ?? null;
      if (item !== null && !index.contains(item)) index.append(item);
    }
    updateCount(target.details, target.body);
  } finally {
    correcting = false;
  }
};

const host = element<HTMLElement>("#formattedChart");
if (host !== null) {
  new MutationObserver(correct).observe(host, { childList: true, subtree: true });
  correct();
}
