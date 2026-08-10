const stylesheetId = "viewerStateFixesStylesheet";

if (document.getElementById(stylesheetId) === null) {
  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = "./viewer-state-fixes.css";
  document.head.append(link);
}

const host = document.querySelector<HTMLElement>("#formattedChart");
const formattedView = document.querySelector<HTMLElement>("#formattedView");

const collapsibleSelector = [
  "details.chart-category",
  "details.chart-reading-group",
  "details.chart-reading",
  "details.compatibility-bucket",
  "details.compatibility-domain",
].join(", ");

const protectedHashPath = (): Set<HTMLDetailsElement> => {
  const protectedDetails = new Set<HTMLDetailsElement>();
  const id = decodeURIComponent(location.hash.slice(1));
  if (id.length === 0) return protectedDetails;
  const target = document.getElementById(id);
  if (target === null || host === null || !host.contains(target)) return protectedDetails;

  if (target instanceof HTMLDetailsElement) protectedDetails.add(target);
  let parent = target.parentElement;
  while (parent !== null && host.contains(parent)) {
    if (parent instanceof HTMLDetailsElement) protectedDetails.add(parent);
    parent = parent.parentElement;
  }
  return protectedDetails;
};

const collapseInitialChartState = (): void => {
  if (host === null) return;
  const protectedDetails = protectedHashPath();
  for (const details of host.querySelectorAll<HTMLDetailsElement>(collapsibleSelector)) {
    if (!protectedDetails.has(details)) details.open = false;
  }
};

const structuralAddition = (record: MutationRecord): boolean => [...record.addedNodes].some((node) => {
  if (!(node instanceof Element)) return false;
  if (node.matches(collapsibleSelector)) return true;
  return node.querySelector(collapsibleSelector) !== null;
});

if (formattedView !== null) {
  formattedView.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
      "#formattedChartIndex .formatted-index-row > a[href^='#']",
    );
    if (link === null || link === undefined) return;

    const row = link.closest<HTMLElement>(".formatted-index-row");
    const item = row?.parentElement;
    const children = item?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
    const toggle = row?.querySelector<HTMLButtonElement>(":scope > .formatted-index-branch-toggle") ?? null;
    if (children === null || toggle === null) return;

    event.preventDefault();
    event.stopPropagation();
    toggle.click();
  }, { capture: true });
}

if (host !== null) {
  let timer = 0;
  const scheduleCollapse = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(collapseInitialChartState, 40);
  };

  new MutationObserver((records) => {
    if (records.some((record) => record.target === host || structuralAddition(record))) scheduleCollapse();
  }).observe(host, { childList: true, subtree: true });

  scheduleCollapse();
}
