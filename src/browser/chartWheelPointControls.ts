import { setChartWheelPointVisibility } from "astral-chart-wheel";
import type { PointId } from "../types/astro.js";

const pointNames: Readonly<Partial<Record<PointId, string>>> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  north_node_true: "True North Node",
  south_node_true: "True South Node",
  north_node_mean: "Mean North Node",
  south_node_mean: "Mean South Node",
  ascendant: "Ascendant",
  descendant: "Descendant",
  midheaven: "Midheaven",
  imum_coeli: "Imum Coeli",
  vertex: "Vertex",
  antivertex: "Antivertex",
  east_point: "East Point",
  part_of_fortune: "Part of Fortune",
  part_of_spirit: "Part of Spirit",
  lilith_mean: "Mean Black Moon Lilith",
  lilith_true: "True Black Moon Lilith",
};

const titleCase = (value: string): string => value
  .replaceAll("_", " ")
  .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-GB"));

const renderedPointIds = (wheel: HTMLElement): PointId[] => {
  const result: PointId[] = [];
  const seen = new Set<PointId>();
  for (const point of wheel.querySelectorAll<SVGGElement>(".wheel-point[data-point]")) {
    const raw = point.dataset["point"];
    if (raw === undefined) continue;
    const id = raw as PointId;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

/**
 * Adds visibility controls without changing any renderer geometry. All points
 * begin enabled, so the pre-existing chart output is unchanged until a user
 * explicitly hides a glyph.
 */
export const addChartWheelPointControls = (wheel: HTMLElement): void => {
  const pointIds = renderedPointIds(wheel);
  if (pointIds.length === 0) return;

  const controls = document.createElement("fieldset");
  controls.className = "wheel-aspect-controls wheel-point-controls";
  controls.style.gridArea = "auto";
  controls.style.gridColumn = "1 / -1";
  controls.style.position = "relative";
  controls.style.top = "auto";
  controls.style.maxHeight = "none";

  const legend = document.createElement("legend");
  legend.textContent = "Chart glyphs";

  const groups = document.createElement("div");
  groups.className = "wheel-aspect-groups";

  const group = document.createElement("details");
  group.className = "wheel-aspect-group";

  const summary = document.createElement("summary");
  summary.className = "wheel-aspect-group-summary";

  const parent = document.createElement("input");
  parent.type = "checkbox";
  parent.checked = true;
  parent.className = "wheel-aspect-group-checkbox";
  parent.setAttribute("aria-label", "Toggle all chart glyphs");
  parent.addEventListener("click", (event) => { event.stopPropagation(); });

  const heading = document.createElement("span");
  heading.className = "wheel-aspect-group-copy";
  const name = document.createElement("strong");
  name.textContent = "Glyph visibility";
  const category = document.createElement("small");
  category.textContent = "Show or hide rendered chart points";
  heading.append(name, category);

  const count = document.createElement("span");
  count.className = "wheel-aspect-group-count";
  count.textContent = String(pointIds.length);

  const children = document.createElement("div");
  children.className = "wheel-aspect-children";
  const checkboxes = new Map<PointId, HTMLInputElement>();

  const updateParent = (): void => {
    const enabled = [...checkboxes.values()].filter((checkbox) => checkbox.checked).length;
    parent.checked = enabled === checkboxes.size;
    parent.indeterminate = enabled > 0 && enabled < checkboxes.size;
  };

  const apply = (pointId: PointId): void => {
    const checkbox = checkboxes.get(pointId);
    if (checkbox === undefined) return;
    setChartWheelPointVisibility(wheel, pointId, checkbox.checked);
    updateParent();
  };

  for (const pointId of pointIds) {
    const label = document.createElement("label");
    label.className = "wheel-aspect-child";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset["pointId"] = pointId;
    checkbox.addEventListener("change", () => { apply(pointId); });
    checkboxes.set(pointId, checkbox);

    const copy = document.createElement("span");
    copy.className = "wheel-aspect-child-copy";
    const pointName = document.createElement("strong");
    pointName.textContent = pointNames[pointId] ?? titleCase(pointId);
    copy.append(pointName);
    label.append(checkbox, copy);
    children.append(label);
  }

  parent.addEventListener("change", () => {
    for (const pointId of pointIds) {
      const checkbox = checkboxes.get(pointId);
      if (checkbox === undefined) continue;
      checkbox.checked = parent.checked;
      setChartWheelPointVisibility(wheel, pointId, parent.checked);
    }
    updateParent();
  });

  summary.append(parent, heading, count);
  group.append(summary, children);
  groups.append(group);
  controls.append(legend, groups);
  wheel.append(controls);
};
