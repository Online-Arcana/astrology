const synthesisTitles = new Set([
  "Integrated chart synthesis",
  "Final personal portrait",
]);

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
    title.textContent = "Final synthesis";
    const count = document.createElement("span");
    count.className = "chart-category-count";
    summary.append(title, count);
    const body = document.createElement("div");
    body.className = "chart-category-body";
    details.append(summary, body);
    const technical = element<HTMLDetailsElement>("#chart-category-technical");
    if (technical === null) host.append(details);
    else host.insertBefore(details, technical);
  }
  const body = details.querySelector<HTMLElement>(":scope > .chart-category-body");
  return body === null ? null : { details, body };
};

const ensureIndexItem = (): HTMLUListElement | null => {
  const index = element<HTMLElement>("#formattedChartIndex");
  const root = index?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (root === null) return null;
  let categoryLink = root.querySelector<HTMLAnchorElement>('a[href="#chart-category-synthesis"]');
  if (categoryLink === null) {
    const item = document.createElement("li");
    categoryLink = document.createElement("a");
    categoryLink.href = "#chart-category-synthesis";
    categoryLink.textContent = "Final synthesis";
    const readings = document.createElement("ul");
    item.append(categoryLink, readings);
    const technical = root.querySelector<HTMLAnchorElement>('a[href="#chart-category-technical"]')?.closest("li") ?? null;
    if (technical === null) root.append(item);
    else root.insertBefore(item, technical);
  }
  const item = categoryLink.closest("li");
  if (item === null) return null;
  let readings = item.querySelector<HTMLUListElement>(":scope > ul");
  if (readings === null) {
    readings = document.createElement("ul");
    item.append(readings);
  }
  return readings;
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
      if (reading.parentElement !== target.body) target.body.append(reading);
      const link = element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
      const item = link?.closest("li") ?? null;
      if (item !== null && item.parentElement !== index) index.append(item);
    }
    const count = target.details.querySelector<HTMLElement>(":scope > summary .chart-category-count");
    if (count !== null) {
      const total = target.body.querySelectorAll(":scope > details.chart-reading").length;
      const label = `${total} section${total === 1 ? "" : "s"}`;
      if (count.textContent !== label) count.textContent = label;
    }
  } finally {
    correcting = false;
  }
};

const host = element<HTMLElement>("#formattedChart");
if (host !== null) {
  new MutationObserver(correct).observe(host, { childList: true, subtree: true });
  correct();
}
