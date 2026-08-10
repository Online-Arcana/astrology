import { displayReadingTitle } from "./readingHelp.js";

const categoryBodies = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>("#formattedChart > details.chart-category > .chart-category-body")];

const hasUngroupedReading = (body: HTMLElement): boolean =>
  body.querySelector(":scope > details.chart-reading") !== null;

const restoreCanonicalTitles = (body: HTMLElement): void => {
  if (!hasUngroupedReading(body)) return;
  for (const reading of body.querySelectorAll<HTMLDetailsElement>("details.chart-reading")) {
    const original = reading.dataset["originalTitle"];
    const summary = reading.querySelector<HTMLElement>(":scope > summary");
    if (original === undefined || summary === null) continue;
    const canonical = displayReadingTitle(original);
    if (summary.textContent !== canonical) summary.textContent = canonical;
    reading.dataset["viewerTitleLocked"] = "false";
  }
};

const restoreWhereNeeded = (): void => {
  for (const body of categoryBodies()) restoreCanonicalTitles(body);
};

const host = document.querySelector<HTMLElement>("#formattedChart");
if (host !== null) {
  // Register before the hierarchy observer. If a late reading arrives directly
  // under a category, restore canonical technical titles for classification.
  // The later customer-language pass translates the finished hierarchy back to
  // plain English and locks the visible labels again.
  new MutationObserver((records) => {
    const addedReading = records.some((record) => [...record.addedNodes].some((node) =>
      node instanceof Element
      && (node.matches("details.chart-reading") || node.querySelector("details.chart-reading") !== null)));
    if (addedReading) restoreWhereNeeded();
  }).observe(host, { childList: true, subtree: true });
  queueMicrotask(restoreWhereNeeded);
}
