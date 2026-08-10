import type { Aspect, AspectKind, PointId, Sign, SignPosition } from "../types/astro.js";
import type { AstralCalculation, AstralFile } from "../types/file.js";
import { renderChartWheel } from "./chartWheel.js";
import { applyCanonicalWheelGlyphs } from "./chartWheelGlyphs.js";

const stylesheetId = "astralChartWheelStyles";
if (document.getElementById(stylesheetId) === null) {
  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = "./chart-wheel.css";
  document.head.append(link);
}

const isCalculation = (value: unknown): value is AstralCalculation => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as { schema?: unknown }).schema === "astral-calculation/1.1.0";
};

const isAstralWithCalculation = (value: unknown): value is Pick<AstralFile, "astral-calculation"> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return isCalculation((value as { "astral-calculation"?: unknown })["astral-calculation"]);
};

const aspectMeanings: Readonly<Record<AspectKind, string>> = {
  conjunction: "The two points act together and intensify one another. Their themes are difficult to separate in this part of the chart.",
  opposition: "The two points pull from opposite sides. The aspect asks for balance, awareness and integration between them.",
  trine: "The two points tend to work together easily. Their themes reinforce one another with relatively little friction.",
  square: "The two points create friction and pressure. The tension can be demanding, but it can also drive action and development.",
  sextile: "The two points support one another through an opportunity that becomes stronger when it is actively used.",
  quincunx: "The two points do not fit together naturally. Repeated adjustment and compromise are usually needed between their themes.",
  semisextile: "The connection is subtle and adjacent. The two themes can support one another, but usually require conscious attention.",
  semisquare: "A low-level but persistent tension links the two points, often creating irritation that pushes for adjustment or action.",
  sesquiquadrate: "The two points create sustained internal pressure. The tension is less obvious than a square but can become difficult to ignore.",
  quintile: "The two points are linked through creative or specialised potential that can be developed deliberately.",
  biquintile: "The two points form a strong creative or inventive connection, often expressed through refinement, technique or unusual problem-solving.",
};

const aspectLabels: Readonly<Record<AspectKind, string>> = {
  conjunction: "Conjunction",
  opposition: "Opposition",
  trine: "Trine",
  square: "Square",
  sextile: "Sextile",
  quincunx: "Quincunx",
  semisextile: "Semi-sextile",
  semisquare: "Semi-square",
  sesquiquadrate: "Sesquiquadrate",
  quintile: "Quintile",
  biquintile: "Biquintile",
};

const aspectGlyphs: Readonly<Record<AspectKind, string>> = {
  conjunction: "☌",
  opposition: "☍",
  trine: "△",
  square: "□",
  sextile: "⚹",
  quincunx: "⚻",
  semisextile: "⚺",
  semisquare: "∠",
  sesquiquadrate: "⚼",
  quintile: "Q",
  biquintile: "bQ",
};

const aspectOrder = [
  "conjunction", "opposition", "trine", "square", "sextile",
  "quincunx", "semisextile", "semisquare", "sesquiquadrate", "quintile", "biquintile",
] as const satisfies readonly AspectKind[];

const signOrder = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const satisfies readonly Sign[];

const coreAspectPoints = new Set<PointId>([
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
]);

const pointNames: Readonly<Partial<Record<PointId, string>>> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
  north_node_true: "True North Node", south_node_true: "True South Node",
  north_node_mean: "Mean North Node", south_node_mean: "Mean South Node",
  ascendant: "Ascendant", descendant: "Descendant", midheaven: "Midheaven", imum_coeli: "Imum Coeli",
  vertex: "Vertex", antivertex: "Antivertex", east_point: "East Point",
  part_of_fortune: "Part of Fortune", part_of_spirit: "Part of Spirit",
  lilith_mean: "Mean Black Moon Lilith", lilith_true: "True Black Moon Lilith",
};

const titleCase = (value: string): string => value
  .replaceAll("_", " ")
  .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-GB"));

const formatPosition = (position: SignPosition): string =>
  `${titleCase(position.sign)} ${position.degree}° ${String(position.minute).padStart(2, "0")}′ ${String(position.second).padStart(2, "0")}″`;

const cardShell = (id: string, heading: string): HTMLElement => {
  const card = document.createElement("section");
  card.id = id;
  card.className = "card chart-wheel-card";

  const header = document.createElement("div");
  header.className = "section-heading";
  const title = document.createElement("h2");
  title.textContent = heading;
  header.append(title);

  card.append(header);
  return card;
};

interface WheelAspectEntry {
  aspect: Aspect;
  visible: SVGLineElement | null;
  hit: SVGLineElement;
}

const wheelAspectEntries = (wheel: HTMLElement, calculation: AstralCalculation): WheelAspectEntry[] => {
  const drawableAspects = calculation.system.aspects.filter((aspect) =>
    calculation.system.points[aspect.a].position.value !== null
    && calculation.system.points[aspect.b].position.value !== null);
  const hitLines = [...wheel.querySelectorAll<SVGLineElement>(".wheel-aspect-hit")];

  return hitLines.flatMap((hit, index) => {
    const aspect = drawableAspects[index];
    if (aspect === undefined) return [];
    const previous = hit.previousElementSibling;
    const visible = previous instanceof SVGLineElement && previous.classList.contains("wheel-aspect")
      ? previous
      : null;
    hit.dataset["aspect"] = aspect.id;
    hit.dataset["aspectKind"] = aspect.kind;
    visible?.setAttribute("data-aspect", aspect.id);
    visible?.setAttribute("data-aspect-kind", aspect.kind);
    return [{ aspect, visible, hit }];
  });
};

const setLineCoordinates = (
  line: SVGLineElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void => {
  line.setAttribute("x1", x1.toFixed(3));
  line.setAttribute("y1", y1.toFixed(3));
  line.setAttribute("x2", x2.toFixed(3));
  line.setAttribute("y2", y2.toFixed(3));
};

const prepareConjunctionGeometry = (entries: readonly WheelAspectEntry[]): void => {
  const centre = 400;
  let conjunctionIndex = 0;
  for (const { aspect, visible, hit } of entries) {
    if (aspect.kind !== "conjunction") continue;
    const source = visible ?? hit;
    const x1 = Number(source.getAttribute("x1") ?? centre);
    const y1 = Number(source.getAttribute("y1") ?? centre);
    const x2 = Number(source.getAttribute("x2") ?? centre);
    const y2 = Number(source.getAttribute("y2") ?? centre);
    const middleX = (x1 + x2) / 2;
    const middleY = (y1 + y2) / 2;
    let dx = middleX - centre;
    let dy = middleY - centre;
    let length = Math.hypot(dx, dy);
    if (length < 1) {
      dx = 1;
      dy = 0;
      length = 1;
    }
    const unitX = dx / length;
    const unitY = dy / length;
    const perpendicularX = -unitY;
    const perpendicularY = unitX;
    const offset = ((conjunctionIndex % 5) - 2) * 3.5;
    conjunctionIndex += 1;
    const innerRadius = 164;
    const outerRadius = 205;
    const startX = centre + unitX * innerRadius + perpendicularX * offset;
    const startY = centre + unitY * innerRadius + perpendicularY * offset;
    const endX = centre + unitX * outerRadius + perpendicularX * offset;
    const endY = centre + unitY * outerRadius + perpendicularY * offset;
    for (const line of [visible, hit]) {
      if (line !== null) setLineCoordinates(line, startX, startY, endX, endY);
    }
    visible?.classList.add("wheel-aspect-conjunction-marker");
  }
};

const defaultAspectVisible = (aspect: Aspect): boolean =>
  aspect.class === "major" && coreAspectPoints.has(aspect.a) && coreAspectPoints.has(aspect.b);

const setAspectVisibility = (entry: WheelAspectEntry, enabled: boolean): void => {
  for (const element of [entry.visible, entry.hit]) {
    if (element === null) continue;
    element.style.display = enabled ? "" : "none";
    element.setAttribute("aria-hidden", String(!enabled));
  }
  entry.hit.setAttribute("tabindex", enabled ? "0" : "-1");
  if (!enabled) {
    entry.visible?.classList.remove("is-active", "wheel-tooltip-active");
    entry.hit.classList.remove("is-active", "wheel-tooltip-active");
  }
};

const addAspectControls = (wheel: HTMLElement, entries: readonly WheelAspectEntry[]): void => {
  if (entries.length === 0) return;

  const presentKinds = aspectOrder.filter((kind) => entries.some(({ aspect }) => aspect.kind === kind));
  const childCheckboxes = new Map<string, HTMLInputElement>();
  const parentCheckboxes = new Map<AspectKind, HTMLInputElement>();

  const controls = document.createElement("fieldset");
  controls.className = "wheel-aspect-controls";
  const legend = document.createElement("legend");
  legend.textContent = "Aspect lines";

  const actions = document.createElement("div");
  actions.className = "wheel-aspect-actions";
  const makeAction = (text: string, ariaLabel: string, run: () => void): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost wheel-aspect-control-button";
    button.textContent = text;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", run);
    return button;
  };

  const groups = document.createElement("div");
  groups.className = "wheel-aspect-groups";

  const updateParents = (): void => {
    for (const kind of presentKinds) {
      const children = entries
        .filter(({ aspect }) => aspect.kind === kind)
        .map(({ aspect }) => childCheckboxes.get(aspect.id))
        .filter((checkbox): checkbox is HTMLInputElement => checkbox !== undefined);
      const checked = children.filter((checkbox) => checkbox.checked).length;
      const parent = parentCheckboxes.get(kind);
      if (parent === undefined) continue;
      parent.checked = checked > 0 && checked === children.length;
      parent.indeterminate = checked > 0 && checked < children.length;
    }
  };

  const apply = (): void => {
    for (const entry of entries) {
      setAspectVisibility(entry, childCheckboxes.get(entry.aspect.id)?.checked === true);
    }
    updateParents();
  };

  const setSelection = (enabled: (aspect: Aspect) => boolean): void => {
    for (const { aspect } of entries) {
      const checkbox = childCheckboxes.get(aspect.id);
      if (checkbox !== undefined) checkbox.checked = enabled(aspect);
    }
    apply();
  };

  actions.append(
    makeAction("Default", "Restore default aspect lines", () => setSelection(defaultAspectVisible)),
    makeAction("None", "Hide all aspect lines", () => setSelection(() => false)),
    makeAction("All", "Show all aspect lines", () => setSelection(() => true)),
  );

  for (const kind of presentKinds) {
    const kindEntries = entries.filter(({ aspect }) => aspect.kind === kind);
    const group = document.createElement("details");
    group.className = "wheel-aspect-group";

    const summary = document.createElement("summary");
    summary.className = "wheel-aspect-group-summary";
    const parent = document.createElement("input");
    parent.type = "checkbox";
    parent.className = "wheel-aspect-group-checkbox";
    parent.dataset["aspectKind"] = kind;
    parent.setAttribute("aria-label", `Toggle all ${aspectLabels[kind].toLocaleLowerCase("en-GB")} aspects`);
    parent.addEventListener("click", (event) => { event.stopPropagation(); });
    parent.addEventListener("change", () => {
      for (const { aspect } of kindEntries) {
        const child = childCheckboxes.get(aspect.id);
        if (child !== undefined) child.checked = parent.checked;
      }
      apply();
    });
    parentCheckboxes.set(kind, parent);

    const heading = document.createElement("span");
    heading.className = "wheel-aspect-group-copy";
    const name = document.createElement("strong");
    name.textContent = `${aspectGlyphs[kind]} ${aspectLabels[kind]}`;
    const category = document.createElement("small");
    category.textContent = kindEntries[0]?.aspect.class === "major" ? "Major" : "Minor";
    heading.append(name, category);

    const count = document.createElement("span");
    count.className = "wheel-aspect-group-count";
    count.textContent = String(kindEntries.length);
    summary.append(parent, heading, count);

    const children = document.createElement("div");
    children.className = "wheel-aspect-children";
    for (const entry of kindEntries) {
      const { aspect } = entry;
      const label = document.createElement("label");
      label.className = "wheel-aspect-child";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = defaultAspectVisible(aspect);
      checkbox.dataset["aspectId"] = aspect.id;
      checkbox.addEventListener("change", apply);
      childCheckboxes.set(aspect.id, checkbox);

      const copy = document.createElement("span");
      copy.className = "wheel-aspect-child-copy";
      const relationship = document.createElement("strong");
      relationship.textContent = `${pointNames[aspect.a] ?? titleCase(aspect.a)} ${aspectGlyphs[aspect.kind]} ${pointNames[aspect.b] ?? titleCase(aspect.b)}`;
      const meta = document.createElement("small");
      meta.textContent = `orb ${aspect.orbDegrees.toFixed(2)}° · strength ${aspect.strength.toFixed(2)}`;
      copy.append(relationship, meta);
      label.append(checkbox, copy);
      children.append(label);
    }

    group.append(summary, children);
    groups.append(group);
  }

  controls.append(legend, actions, groups);
  wheel.prepend(controls);
  apply();
};

interface TooltipContent {
  title: string;
  rows: readonly [string, string][];
  aspect?: Aspect;
}

let tooltipCounter = 0;

const tooltipContent = (
  target: Element,
  calculation: AstralCalculation,
  aspectById: ReadonlyMap<string, Aspect>,
): TooltipContent | null => {
  const aspectId = target.getAttribute("data-aspect");
  if (aspectId !== null) {
    const aspect = aspectById.get(aspectId);
    if (aspect === undefined) return null;
    return {
      title: `${aspectGlyphs[aspect.kind]} ${pointNames[aspect.a] ?? titleCase(aspect.a)} ${aspectLabels[aspect.kind].toLocaleLowerCase("en-GB")} ${pointNames[aspect.b] ?? titleCase(aspect.b)}`,
      rows: [
        ["Exact angle", `${aspect.exactAngleDegrees.toFixed(2)}°`],
        ["Actual angle", `${aspect.actualAngleDegrees.toFixed(2)}°`],
        ["Orb", `${aspect.orbDegrees.toFixed(2)}° of ${aspect.allowedOrbDegrees.toFixed(2)}°`],
        ["Phase", titleCase(aspect.phase)],
        ["Strength", aspect.strength.toFixed(2)],
        ["Meaning", aspectMeanings[aspect.kind]],
      ],
      aspect,
    };
  }

  const pointId = target.getAttribute("data-point") as PointId | null;
  if (pointId !== null) {
    const point = calculation.system.points[pointId];
    const position = point?.position.value ?? null;
    if (point === undefined || position === null) return null;
    const house = point.houses[calculation.settings.primaryHouseSystem].value;
    const relatedAspects = calculation.system.aspects.filter(({ a, b }) => a === pointId || b === pointId);
    return {
      title: pointNames[pointId] ?? titleCase(pointId),
      rows: [
        ["Position", formatPosition(position)],
        ["House", house === null ? "Unavailable" : String(house.house)],
        ["Motion", titleCase(point.motion)],
        ["Aspects", String(relatedAspects.length)],
      ],
    };
  }

  const sign = target.getAttribute("data-sign") as Sign | null;
  if (sign !== null) {
    const index = signOrder.indexOf(sign);
    if (index < 0) return null;
    const points = Object.values(calculation.system.points)
      .filter((point) => point.position.value?.sign === sign)
      .map((point) => pointNames[point.id] ?? titleCase(point.id));
    const cusps = Object.values(calculation.system.houses[calculation.settings.primaryHouseSystem].houses)
      .filter((house) => house.cusp.value?.sign === sign)
      .map((house) => String(house.number));
    return {
      title: titleCase(sign),
      rows: [
        ["Longitude", `${index * 30}°–${index * 30 + 30}°`],
        ["Points", points.length === 0 ? "None" : points.join(", ")],
        ["House cusps", cusps.length === 0 ? "None" : cusps.join(", ")],
      ],
    };
  }

  const houseValue = target.getAttribute("data-house");
  if (houseValue !== null) {
    const number = Number(houseValue);
    const house = Object.values(calculation.system.houses[calculation.settings.primaryHouseSystem].houses)
      .find((candidate) => candidate.number === number);
    if (house === undefined || house.cusp.value === null || house.end.value === null) return null;
    return {
      title: `House ${house.number}`,
      rows: [
        ["Cusp", formatPosition(house.cusp.value)],
        ["End", formatPosition(house.end.value)],
        ["Occupants", house.occupants.length === 0 ? "None" : house.occupants.map((id) => pointNames[id] ?? titleCase(id)).join(", ")],
        ["Intercepted signs", house.interceptedSigns.length === 0 ? "None" : house.interceptedSigns.map(titleCase).join(", ")],
        ["Traditional ruler", house.rulerTraditional.value === null ? "Unavailable" : pointNames[house.rulerTraditional.value] ?? titleCase(house.rulerTraditional.value)],
      ],
    };
  }

  return null;
};

const addWheelTooltip = (
  wheel: HTMLElement,
  calculation: AstralCalculation,
  entries: readonly WheelAspectEntry[],
): void => {
  wheel.querySelector(".wheel-detail")?.remove();
  wheel.classList.add("wheel-tooltip-mode");

  const aspectById = new Map(entries.map(({ aspect }) => [aspect.id, aspect] as const));
  const tooltip = document.createElement("div");
  tooltip.className = "wheel-tooltip";
  tooltip.id = `chartWheelTooltip${++tooltipCounter}`;
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  wheel.append(tooltip);

  let current: Element | null = null;
  let pinned: Element | null = null;

  const clearHighlight = (): void => {
    for (const active of wheel.querySelectorAll(".wheel-tooltip-active, .wheel-tooltip-endpoint")) {
      active.classList.remove("wheel-tooltip-active", "wheel-tooltip-endpoint");
    }
  };

  const highlight = (target: Element, content: TooltipContent): void => {
    clearHighlight();
    target.classList.add("wheel-tooltip-active");
    if (content.aspect === undefined) return;
    const entry = entries.find(({ aspect }) => aspect.id === content.aspect?.id);
    entry?.visible?.classList.add("wheel-tooltip-active");
    wheel.querySelector(`.wheel-point[data-point="${content.aspect.a}"]`)?.classList.add("wheel-tooltip-endpoint");
    wheel.querySelector(`.wheel-point[data-point="${content.aspect.b}"]`)?.classList.add("wheel-tooltip-endpoint");
  };

  const render = (content: TooltipContent): void => {
    tooltip.replaceChildren();
    const title = document.createElement("strong");
    title.className = "wheel-tooltip-title";
    title.textContent = content.title;
    const list = document.createElement("dl");
    list.className = "wheel-tooltip-list";
    for (const [label, value] of content.rows) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      list.append(term, description);
    }
    tooltip.append(title, list);
  };

  const place = (x: number, y: number): void => {
    tooltip.hidden = false;
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    const bounds = tooltip.getBoundingClientRect();
    const gap = 12;
    const margin = 8;
    let left = x + gap;
    let top = y + gap;
    if (left + bounds.width + margin > window.innerWidth) left = x - bounds.width - gap;
    if (top + bounds.height + margin > window.innerHeight) top = y - bounds.height - gap;
    left = Math.max(margin, Math.min(left, window.innerWidth - bounds.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - bounds.height - margin));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const anchor = (target: Element): { x: number; y: number } => {
    const bounds = target.getBoundingClientRect();
    return { x: bounds.right, y: bounds.top + bounds.height / 2 };
  };

  const show = (target: Element, position?: { x: number; y: number }): void => {
    const content = tooltipContent(target, calculation, aspectById);
    if (content === null) return;
    if (current !== null && current !== target) current.removeAttribute("aria-describedby");
    current = target;
    current.setAttribute("aria-describedby", tooltip.id);
    render(content);
    highlight(target, content);
    const point = position ?? anchor(target);
    place(point.x, point.y);
  };

  const hide = (): void => {
    current?.removeAttribute("aria-describedby");
    current = null;
    tooltip.hidden = true;
    clearHighlight();
  };

  const targets = [...wheel.querySelectorAll(
    ".wheel-sign[data-sign], .wheel-house-sector[data-house], .wheel-point[data-point], .wheel-aspect-hit[data-aspect]",
  )];

  for (const target of targets) {
    target.addEventListener("pointerenter", (event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType === "touch" || pinned !== null) return;
      show(target, { x: pointer.clientX, y: pointer.clientY });
    });
    target.addEventListener("pointermove", (event) => {
      if (pinned !== null || current !== target || tooltip.hidden) return;
      const pointer = event as PointerEvent;
      place(pointer.clientX, pointer.clientY);
    });
    target.addEventListener("pointerleave", () => {
      if (pinned === null) hide();
    });
    target.addEventListener("focus", () => {
      if (pinned === null) show(target);
    });
    target.addEventListener("blur", () => {
      if (pinned === null) hide();
    });
    target.addEventListener("click", () => {
      if (pinned === target) {
        pinned = null;
        hide();
        return;
      }
      pinned = target;
      show(target);
    });
  }

  wheel.addEventListener("click", () => {
    pinned = null;
    hide();
  });
  wheel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      pinned = null;
      hide();
    }
  });

  const outsidePointer = (event: PointerEvent): void => {
    if (!wheel.isConnected) {
      document.removeEventListener("pointerdown", outsidePointer, true);
      return;
    }
    if (pinned === null || !(event.target instanceof Node) || wheel.contains(event.target)) return;
    pinned = null;
    hide();
  };
  document.addEventListener("pointerdown", outsidePointer, true);
};

const renderIntoCard = (card: HTMLElement, calculation: AstralCalculation): void => {
  card.querySelector(".chart-wheel")?.remove();
  const wheel = renderChartWheel(calculation);
  applyCanonicalWheelGlyphs(wheel);
  const entries = wheelAspectEntries(wheel, calculation);
  prepareConjunctionGeometry(entries);
  addAspectControls(wheel, entries);
  addWheelTooltip(wheel, calculation, entries);
  card.append(wheel);
};

const ensureLiveCard = (): HTMLElement | null => {
  const createPanel = document.querySelector<HTMLElement>("#createPanel");
  if (createPanel === null) return null;
  const existing = createPanel.querySelector<HTMLElement>("#liveChartWheelCard");
  if (existing !== null) return existing;
  const card = cardShell("liveChartWheelCard", "Your chart wheel");
  const progress = createPanel.querySelector<HTMLElement>("#progressCard");
  if (progress === null) createPanel.append(card);
  else progress.insertAdjacentElement("afterend", card);
  return card;
};

const showLiveCalculation = (calculation: AstralCalculation): void => {
  const card = ensureLiveCard();
  if (card === null) return;
  renderIntoCard(card, calculation);
  card.classList.remove("hidden");
};

const viewerCard = (): HTMLElement | null => {
  const formattedChart = document.querySelector<HTMLElement>("#formattedChart");
  if (formattedChart === null) return null;
  formattedChart.classList.add("chart-wheel-host");

  const existing = document.querySelector<HTMLElement>("#fileChartWheelCard");
  if (existing !== null && !(existing instanceof HTMLDetailsElement)) existing.remove();

  const current = document.querySelector<HTMLDetailsElement>("#fileChartWheelCard");
  if (current !== null) {
    if (current.parentElement !== formattedChart) formattedChart.prepend(current);
    const body = current.querySelector<HTMLElement>(":scope > .chart-wheel-category-body");
    if (body !== null) return body;
    current.remove();
  }

  const category = document.createElement("details");
  category.id = "fileChartWheelCard";
  category.className = "chart-category chart-wheel-card chart-wheel-category";
  category.open = true;

  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.textContent = "Chart wheel";
  summary.append(title);

  const body = document.createElement("div");
  body.className = "chart-category-body chart-wheel-category-body";
  category.append(summary, body);
  formattedChart.prepend(category);
  return body;
};

export const mountViewerChartWheel = (calculation: AstralCalculation): void => {
  const card = viewerCard();
  if (card === null) return;
  renderIntoCard(card, calculation);
  lastViewerFingerprint = calculation.provenance.calculationFingerprint;
};

let lastViewerFingerprint: string | null = null;
let syncingViewerWheel = false;

const viewerWheelPresent = (): boolean =>
  document.querySelector("#fileChartWheelCard .chart-wheel svg") !== null;

const syncViewerWheel = (): void => {
  if (syncingViewerWheel) return;
  const raw = document.querySelector<HTMLElement>("#rawChart")?.textContent?.trim() ?? "";
  if (raw.length === 0) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isAstralWithCalculation(parsed)) return;

  const calculation = parsed["astral-calculation"];
  const fingerprint = calculation.provenance.calculationFingerprint;
  if (fingerprint === lastViewerFingerprint && viewerWheelPresent()) return;

  syncingViewerWheel = true;
  try {
    mountViewerChartWheel(calculation);
  } finally {
    syncingViewerWheel = false;
  }
};

window.addEventListener("astral:calculation", (event) => {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (isCalculation(detail)) showLiveCalculation(detail);
});

const rawChart = document.querySelector<HTMLElement>("#rawChart");
if (rawChart !== null) {
  new MutationObserver(syncViewerWheel).observe(rawChart, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const formattedChart = document.querySelector<HTMLElement>("#formattedChart");
if (formattedChart !== null) {
  new MutationObserver(syncViewerWheel).observe(formattedChart, {
    childList: true,
    subtree: false,
  });
}

window.addEventListener("pageshow", syncViewerWheel);
queueMicrotask(syncViewerWheel);
