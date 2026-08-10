const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const synthesisTitles = new Set([
  "How your chart fits together",
  "Final portrait",
  "Integrated chart synthesis",
  "Final personal portrait",
]);

interface GroupMeta {
  id: string;
  title: string;
}

const slug = (value: string): string => value
  .normalize("NFKD")
  .replaceAll(/[^A-Za-z0-9]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "")
  .toLocaleLowerCase("en-GB") || "section";

const readingTitle = (reading: HTMLDetailsElement): string =>
  reading.querySelector<HTMLElement>(":scope > summary")?.textContent?.trim() ?? "Chart section";

const categoryBody = (category: HTMLDetailsElement): HTMLElement | null =>
  category.querySelector<HTMLElement>(":scope > .chart-category-body");

const categoryTitle = (category: HTMLDetailsElement): HTMLElement | null =>
  category.querySelector<HTMLElement>(":scope > summary > span:not(.chart-category-count)");

const categoryIndexItem = (categoryId: string): HTMLLIElement | null =>
  element<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(categoryId)}"]`)?.closest<HTMLLIElement>("li") ?? null;

const categoryIndexList = (categoryId: string): HTMLUListElement | null => {
  const item = categoryIndexItem(categoryId);
  if (item === null) return null;
  let list = item.querySelector<HTMLUListElement>(":scope > ul");
  if (list === null) {
    list = document.createElement("ul");
    item.append(list);
  }
  return list;
};

const makeIndexItem = (href: string, title: string): HTMLLIElement => {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = href;
  link.textContent = title;
  item.append(link);
  return item;
};

const ensureOverview = (): void => {
  const host = element<HTMLElement>("#formattedChart");
  const navRoot = element<HTMLUListElement>("#formattedChartIndex > ul");
  if (host === null || navRoot === null) return;

  const readings = [...host.querySelectorAll<HTMLDetailsElement>("details.chart-reading")]
    .filter((reading) => synthesisTitles.has(readingTitle(reading)));
  let category = element<HTMLDetailsElement>("#chart-category-synthesis");

  if (readings.length === 0) {
    const body = category === null ? null : categoryBody(category);
    if (category !== null && body !== null && body.querySelector("details.chart-reading") === null) {
      categoryIndexItem(category.id)?.remove();
      category.remove();
    }
    return;
  }

  if (category === null) {
    category = document.createElement("details");
    category.id = "chart-category-synthesis";
    category.className = "chart-category";
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = "Overview";
    const count = document.createElement("span");
    count.className = "chart-category-count";
    summary.append(title, count);
    const body = document.createElement("div");
    body.className = "chart-category-body";
    category.append(summary, body);
  }

  const body = categoryBody(category);
  if (body === null) return;
  for (const reading of readings) {
    if (!category.contains(reading)) body.append(reading);
  }
  const title = categoryTitle(category);
  if (title !== null && title.textContent !== "Overview") title.textContent = "Overview";
  category.open = true;
  if (host.firstElementChild !== category) host.prepend(category);

  let item = categoryIndexItem(category.id);
  if (item === null) {
    item = makeIndexItem(`#${category.id}`, "Overview");
    item.append(document.createElement("ul"));
  } else {
    const link = item.querySelector<HTMLAnchorElement>(":scope > a, :scope > .formatted-index-row > a");
    if (link !== null && link.textContent !== "Overview") link.textContent = "Overview";
  }
  if (navRoot.firstElementChild !== item) navRoot.prepend(item);
};

const houseGroup = (title: string): GroupMeta | null => {
  const groups: readonly [readonly string[], GroupMeta][] = [
    [["Self and identity", "Money, possessions and values", "Communication and everyday life"], { id: "identity-resources-everyday", title: "Identity, resources and everyday life" }],
    [["Home, family and roots", "Creativity, pleasure and romance", "Work, routines and wellbeing"], { id: "home-creativity-routines", title: "Home, creativity and daily routines" }],
    [["Partnerships and close relationships", "Intimacy, shared resources and change", "Beliefs, travel and higher learning"], { id: "partnerships-intimacy-worldview", title: "Partnerships, intimacy and worldview" }],
    [["Career, reputation and public life", "Friendships, community and future goals", "Inner life, retreat and hidden patterns"], { id: "career-community-inner-life", title: "Career, community and inner life" }],
  ];
  return groups.find(([titles]) => titles.includes(title))?.[1] ?? null;
};

const isAngleOrPoint = (title: string): boolean =>
  /\b(?:Ascendant|Descendant|Midheaven|Imum Coeli|Vertex|Antivertex|Node|Lilith|Part of Fortune|Part of Spirit|East Point)\b/iu.test(title);

const aspectGroup = (title: string): GroupMeta => {
  if (/(?:T-square|Grand trine|Grand cross|Yod|Mystic rectangle|Grand sextile|Thor's hammer|Kite)/iu.test(title)) {
    return { id: "patterns", title: "Aspect patterns" };
  }
  if (/\b(?:parallel|contra-?parallel|declination)\b/iu.test(title)) {
    return { id: "declination", title: "Declination aspects" };
  }
  const minor = /\b(?:quincunx|semi-sextile|semi-square|sesquiquadrate|quintile|biquintile)\b/iu.test(title);
  const points = isAngleOrPoint(title);
  if (minor && points) return { id: "minor-points", title: "Minor aspects to angles and calculated points" };
  if (minor) return { id: "minor-planets", title: "Minor planetary aspects" };
  if (points) return { id: "major-points", title: "Major aspects to angles and calculated points" };
  if (/\b(?:conjunct|opposite|trine|square|sextile)\b/iu.test(title)) return { id: "major-planets", title: "Major planetary aspects" };
  return { id: "other-aspects", title: "Other aspect readings" };
};

const groupFor = (categoryId: string, title: string): GroupMeta => {
  switch (categoryId) {
    case "chart-category-synthesis": return { id: "at-a-glance", title: "Your chart at a glance" };
    case "chart-category-general": return { id: "core-themes", title: "Core chart themes" };
    case "chart-category-relationships":
      if (/(?:Romance|sexuality|partnership)/iu.test(title)) return { id: "love-partnership", title: "Love, intimacy and partnership" };
      if (/(?:home|family|childhood|children)/iu.test(title)) return { id: "family-home", title: "Home, family and upbringing" };
      if (/(?:friendship|community|groups)/iu.test(title)) return { id: "friends-community", title: "Friends and community" };
      return { id: "relationships-connection", title: "Relationships and connection" };
    case "chart-category-work":
      if (/(?:career|vocation|public life|ambition)/iu.test(title)) return { id: "career-public", title: "Career and public life" };
      if (/(?:money|material|business|leadership)/iu.test(title)) return { id: "money-business", title: "Money, business and leadership" };
      return { id: "work-contribution", title: "Work and daily contribution" };
    case "chart-category-growth":
      if (/(?:wellbeing|daily rhythm)/iu.test(title)) return { id: "wellbeing", title: "Wellbeing and daily rhythm" };
      if (/(?:spirituality|meaning)/iu.test(title)) return { id: "spirituality", title: "Spirituality and meaning" };
      if (/(?:growth|opportunity|developmental)/iu.test(title)) return { id: "development", title: "Growth and development" };
      return { id: "challenge-change", title: "Challenges, change and inner patterns" };
    case "chart-category-points":
      if (/\b(?:Sun|Moon|Ascendant|Descendant|Midheaven|Imum Coeli)\b/iu.test(title)) return { id: "luminaries-angles", title: "Luminaries and angles" };
      if (/\b(?:Mercury|Venus|Mars)\b/iu.test(title)) return { id: "personal-planets", title: "Personal planets" };
      if (/\b(?:Jupiter|Saturn)\b/iu.test(title)) return { id: "social-planets", title: "Social planets" };
      if (/\b(?:Uranus|Neptune|Pluto)\b/iu.test(title)) return { id: "outer-planets", title: "Outer planets" };
      return { id: "nodes-points", title: "Nodes and calculated points" };
    case "chart-category-houses": return houseGroup(title) ?? { id: "other-houses", title: "Other house readings" };
    case "chart-category-aspects": return aspectGroup(title);
    case "chart-category-technical":
      if (/(?:Chart details|Planetary and calculated placements|House cusps)/iu.test(title)) return { id: "foundations", title: "Chart foundations and placements" };
      if (/(?:Lunar phase|rulers|dominant|balance)/iu.test(title)) return { id: "structure", title: "Chart structure and balance" };
      if (/(?:aspect|pattern)/iu.test(title)) return { id: "aspect-calculations", title: "Aspect calculations" };
      return { id: "other-technical", title: "Other technical data" };
    default: return { id: "readings", title: "Readings" };
  }
};

const makeGroup = (categoryId: string, meta: GroupMeta, readings: readonly HTMLDetailsElement[]): HTMLDetailsElement => {
  const details = document.createElement("details");
  details.className = "chart-reading-group";
  details.id = `chart-group-${slug(categoryId.replace(/^chart-category-/u, ""))}-${slug(meta.id)}`;
  if (categoryId === "chart-category-synthesis") details.open = true;
  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.className = "chart-reading-group-title";
  title.textContent = meta.title;
  const count = document.createElement("span");
  count.className = "chart-category-count";
  count.textContent = `${readings.length} section${readings.length === 1 ? "" : "s"}`;
  summary.append(title, count);
  const body = document.createElement("div");
  body.className = "chart-reading-group-body";
  body.append(...readings);
  details.append(summary, body);
  return details;
};

const expectedGroupLinks = (groups: readonly HTMLDetailsElement[]): string[] => groups.map((group) => `#${group.id}`);

const currentTopLinks = (root: HTMLUListElement): string[] => [...root.children].map((child) => {
  const item = child as HTMLLIElement;
  return item.querySelector<HTMLAnchorElement>(":scope > a, :scope > .formatted-index-row > a")?.getAttribute("href") ?? "";
});

const rebuildCategoryIndex = (category: HTMLDetailsElement, groups: readonly HTMLDetailsElement[]): void => {
  const root = categoryIndexList(category.id);
  if (root === null) return;
  const expected = expectedGroupLinks(groups);
  if (JSON.stringify(currentTopLinks(root)) === JSON.stringify(expected)) return;
  root.replaceChildren();
  for (const group of groups) {
    const title = group.querySelector<HTMLElement>(":scope > summary .chart-reading-group-title")?.textContent?.trim() ?? "Group";
    const item = makeIndexItem(`#${group.id}`, title);
    const sections = document.createElement("ul");
    for (const reading of group.querySelectorAll<HTMLDetailsElement>(":scope > .chart-reading-group-body > details.chart-reading")) {
      sections.append(makeIndexItem(`#${reading.id}`, readingTitle(reading)));
    }
    if (sections.children.length > 0) item.append(sections);
    root.append(item);
  }
};

const groupCategories = (): void => {
  for (const category of document.querySelectorAll<HTMLDetailsElement>("#formattedChart > details.chart-category")) {
    if (category.id === "chart-category-compatibilities") continue;
    const body = categoryBody(category);
    if (body === null) continue;
    const direct = [...body.querySelectorAll<HTMLDetailsElement>(":scope > details.chart-reading")];
    const existingGroups = [...body.querySelectorAll<HTMLDetailsElement>(":scope > details.chart-reading-group")];
    if (direct.length === 0 && existingGroups.length > 0) {
      rebuildCategoryIndex(category, existingGroups);
      continue;
    }
    const readings = [...body.querySelectorAll<HTMLDetailsElement>("details.chart-reading")];
    if (readings.length === 0) continue;
    const grouped = new Map<string, { meta: GroupMeta; readings: HTMLDetailsElement[] }>();
    for (const reading of readings) {
      const meta = groupFor(category.id, readingTitle(reading));
      const selected = grouped.get(meta.id) ?? { meta, readings: [] };
      selected.readings.push(reading);
      grouped.set(meta.id, selected);
    }
    const groups = [...grouped.values()].map(({ meta, readings: selected }) => makeGroup(category.id, meta, selected));
    body.replaceChildren(...groups);
    const count = category.querySelector<HTMLElement>(":scope > summary .chart-category-count");
    if (count !== null) count.textContent = `${groups.length} group${groups.length === 1 ? "" : "s"}`;
    rebuildCategoryIndex(category, groups);
  }
};

const setBranch = (toggle: HTMLButtonElement, list: HTMLUListElement, expanded: boolean): void => {
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.classList.toggle("expanded", expanded);
  list.hidden = !expanded;
};

const nestIndexItem = (item: HTMLLIElement): void => {
  const list = item.querySelector<HTMLUListElement>(":scope > ul");
  if (list === null) return;
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
    item.insertBefore(row, list);
    list.hidden = true;
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      setBranch(toggle, list, expanded);
      toggle.setAttribute("aria-label", `${expanded ? "Hide" : "Show"} subsections of ${link.textContent?.trim() ?? "this section"}`);
    });
  }
  for (const child of list.querySelectorAll<HTMLLIElement>(":scope > li")) nestIndexItem(child);
};

const openPath = (target: HTMLElement): void => {
  if (target instanceof HTMLDetailsElement) target.open = true;
  let parent = target.parentElement;
  while (parent !== null) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
};

const enhanceIndex = (): void => {
  const nav = element<HTMLElement>("#formattedChartIndex");
  const root = nav?.querySelector<HTMLUListElement>(":scope > ul") ?? null;
  if (nav === null || root === null) return;
  for (const item of root.querySelectorAll<HTMLLIElement>(":scope > li")) nestIndexItem(item);
  if (nav.dataset["hierarchyLinks"] !== "true") {
    nav.dataset["hierarchyLinks"] = "true";
    nav.addEventListener("click", (event) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
      const target = link === null || link === undefined ? null : document.querySelector<HTMLElement>(link.hash);
      if (target !== null) openPath(target);
    }, { capture: true });
  }
};

const installStyles = (): void => {
  if (element("#viewerHierarchyStyles") !== null) return;
  const style = document.createElement("style");
  style.id = "viewerHierarchyStyles";
  style.textContent = `
    .chart-reading-group{min-width:0;border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:1rem;overflow:clip;background:color-mix(in srgb,currentColor 2%,transparent)}
    .chart-reading-group+.chart-reading-group{margin-top:.7rem}
    .chart-reading-group>summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 1rem;cursor:pointer;font-weight:800;overflow-wrap:anywhere}
    .chart-reading-group>summary::-webkit-details-marker{display:none}.chart-reading-group>summary::after{content:"+";flex:0 0 auto;font-size:1.08rem}.chart-reading-group[open]>summary::after{content:"−"}
    .chart-reading-group-body{display:grid;gap:.6rem;padding:0 .65rem .65rem}
    .compatibility-sign-filter{margin-bottom:.8rem!important;padding:.95rem 1rem!important;border:1px solid color-mix(in srgb,var(--accent,#b69cff) 34%,currentColor 10%)!important;border-radius:1rem!important;background:color-mix(in srgb,var(--accent,#b69cff) 7%,transparent)!important}
    .compatibility-sign-filter select{width:100%;min-width:0;margin:0;padding:.7rem .8rem;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:.7rem;background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font:inherit}
    @media(max-width:640px){.chart-reading-group>summary{align-items:flex-start;padding:.82rem .85rem}.chart-reading-group-body{padding:0 .5rem .5rem}}
  `;
  document.head.append(style);
};

let running = false;
const run = (): void => {
  if (running) return;
  const host = element<HTMLElement>("#formattedChart");
  if (host === null || host.querySelector("details.chart-reading") === null) return;
  running = true;
  try {
    installStyles();
    ensureOverview();
    groupCategories();
    enhanceIndex();
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id.length === 0 ? null : document.getElementById(id);
    if (target instanceof HTMLElement) openPath(target);
  } finally {
    running = false;
  }
};

const host = element<HTMLElement>("#formattedChart");
if (host !== null) new MutationObserver(run).observe(host, { childList: true, subtree: true });
const view = element<HTMLElement>("#formattedView");
if (view !== null) new MutationObserver(run).observe(view, { childList: true, subtree: true });
queueMicrotask(run);
