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

const chartDetails = (): HTMLDetailsElement[] => host === null
  ? []
  : [...host.querySelectorAll<HTMLDetailsElement>(collapsibleSelector)];

const collapseInitialChartState = (): void => {
  const protectedDetails = protectedHashPath();
  for (const details of chartDetails()) {
    if (!protectedDetails.has(details)) details.open = false;
  }
};

const structuralAddition = (record: MutationRecord): boolean => [...record.addedNodes].some((node) => {
  if (!(node instanceof Element)) return false;
  if (node.matches(collapsibleSelector)) return true;
  return node.querySelector(collapsibleSelector) !== null;
});

const bulkButton = (className: string): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `ghost viewer-bulk-toggle ${className}`;
  button.textContent = "Expand all";
  return button;
};

const indexToggles = (): HTMLButtonElement[] => formattedView === null
  ? []
  : [...formattedView.querySelectorAll<HTMLButtonElement>(
    "#formattedChartIndex .formatted-index-branch-toggle",
  )];

const syncIndexBulkControl = (): void => {
  const button = formattedView?.querySelector<HTMLButtonElement>("#viewerIndexBulkToggle") ?? null;
  if (button === null) return;
  const toggles = indexToggles();
  const allExpanded = toggles.length > 0
    && toggles.every((toggle) => toggle.getAttribute("aria-expanded") === "true");
  button.disabled = toggles.length === 0;
  button.textContent = allExpanded ? "Collapse all" : "Expand all";
  button.setAttribute("aria-label", `${allExpanded ? "Collapse" : "Expand"} all Chart index branches`);
};

const ensureIndexBulkControl = (): void => {
  const nav = formattedView?.querySelector<HTMLElement>("#formattedChartIndex") ?? null;
  if (nav === null) return;
  let controls = nav.querySelector<HTMLElement>(":scope > .viewer-index-bulk-controls");
  if (controls === null) {
    controls = document.createElement("div");
    controls.className = "viewer-bulk-controls viewer-index-bulk-controls";
    const button = bulkButton("viewer-index-bulk-toggle");
    button.id = "viewerIndexBulkToggle";
    button.addEventListener("click", () => {
      const toggles = indexToggles();
      const expand = !toggles.every((toggle) => toggle.getAttribute("aria-expanded") === "true");
      for (const toggle of toggles) {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        if (expanded !== expand) toggle.click();
      }
      syncIndexBulkControl();
    });
    controls.append(button);
    const list = nav.querySelector<HTMLUListElement>(":scope > ul");
    if (list === null) nav.append(controls);
    else nav.insertBefore(controls, list);
  }
  syncIndexBulkControl();
};

const syncChartBulkControl = (): void => {
  const button = host?.querySelector<HTMLButtonElement>(":scope > .viewer-chart-bulk-controls #viewerChartBulkToggle") ?? null;
  if (button === null) return;
  const details = chartDetails();
  const allExpanded = details.length > 0 && details.every((item) => item.open);
  button.disabled = details.length === 0;
  button.textContent = allExpanded ? "Collapse all" : "Expand all";
  button.setAttribute("aria-label", `${allExpanded ? "Collapse" : "Expand"} all chart sections`);
};

const ensureChartBulkControl = (): void => {
  if (host === null) return;
  let controls = host.querySelector<HTMLElement>(":scope > .viewer-chart-bulk-controls");
  if (controls === null) {
    controls = document.createElement("div");
    controls.className = "viewer-bulk-controls viewer-chart-bulk-controls";
    const button = bulkButton("viewer-chart-bulk-toggle");
    button.id = "viewerChartBulkToggle";
    button.addEventListener("click", () => {
      const details = chartDetails();
      const expand = !details.every((item) => item.open);
      for (const item of details) item.open = expand;
      syncChartBulkControl();
    });
    controls.append(button);
    host.append(controls);
  }
  syncChartBulkControl();
};

const ensureBulkControls = (): void => {
  ensureIndexBulkControl();
  ensureChartBulkControl();
};

if (formattedView !== null) {
  formattedView.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
      "#formattedChartIndex .formatted-index-row > a[href^='#']",
    );
    if (link !== null && link !== undefined) {
      const row = link.closest<HTMLElement>(".formatted-index-row");
      const item = row?.parentElement;
      const children = item?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
      const toggle = row?.querySelector<HTMLButtonElement>(":scope > .formatted-index-branch-toggle") ?? null;
      if (children !== null && toggle !== null) {
        event.preventDefault();
        event.stopPropagation();
        toggle.click();
        queueMicrotask(syncIndexBulkControl);
        return;
      }
    }

    if ((event.target as Element | null)?.closest("#formattedChartIndex .formatted-index-branch-toggle") !== null) {
      queueMicrotask(syncIndexBulkControl);
    }
  }, { capture: true });

  let controlTimer = 0;
  const scheduleControls = (): void => {
    window.clearTimeout(controlTimer);
    controlTimer = window.setTimeout(ensureBulkControls, 0);
  };
  new MutationObserver(scheduleControls).observe(formattedView, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded"],
  });
  scheduleControls();
}

if (host !== null) {
  let timer = 0;
  const scheduleCollapse = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      collapseInitialChartState();
      ensureBulkControls();
    }, 40);
  };

  new MutationObserver((records) => {
    if (records.some((record) => record.target === host || structuralAddition(record))) scheduleCollapse();
  }).observe(host, { childList: true, subtree: true });

  let chartStateTimer = 0;
  new MutationObserver(() => {
    window.clearTimeout(chartStateTimer);
    chartStateTimer = window.setTimeout(syncChartBulkControl, 0);
  }).observe(host, { attributes: true, attributeFilter: ["open"], subtree: true });

  scheduleCollapse();
}
