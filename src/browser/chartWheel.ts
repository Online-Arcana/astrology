import type { Aspect, PointId, Sign } from "../types/astro.js";
import type { AstralCalculation } from "../types/file.js";

const svgNamespace = "http://www.w3.org/2000/svg";
const size = 800;
const centre = size / 2;
const radii = {
  outer: 372,
  zodiacInner: 316,
  pointBase: 286,
  houseOuter: 254,
  aspect: 210,
} as const;

const signOrder = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const satisfies readonly Sign[];

const signGlyphs: Readonly<Record<Sign, string>> = {
  aries: "♈︎", taurus: "♉︎", gemini: "♊︎", cancer: "♋︎",
  leo: "♌︎", virgo: "♍︎", libra: "♎︎", scorpio: "♏︎",
  sagittarius: "♐︎", capricorn: "♑︎", aquarius: "♒︎", pisces: "♓︎",
};

const pointFallback: Readonly<Partial<Record<PointId, string>>> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀︎", mars: "♂︎",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  north_node_true: "T", south_node_true: "T", north_node_mean: "M", south_node_mean: "M",
  ascendant: "As", descendant: "Ds", midheaven: "Mc", imum_coeli: "IC",
  vertex: "Vx", antivertex: "AV", east_point: "Ep",
  part_of_fortune: "⊗", part_of_spirit: "Φ", lilith_mean: "⚸", lilith_true: "⚸",
};

const titleCase = (value: string): string => value
  .replaceAll("_", " ")
  .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-GB"));

const normalise = (degrees: number): number => ((degrees % 360) + 360) % 360;
const forwardDistance = (start: number, end: number): number => normalise(end - start);
const radians = (degrees: number): number => degrees * Math.PI / 180;

const svg = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(svgNamespace, name);

const screenAngle = (longitude: number, ascendant: number): number =>
  Math.PI - radians(normalise(longitude - ascendant));

interface WheelPointAnchor {
  x: number;
  y: number;
}

const polar = (longitude: number, radius: number, ascendant: number): WheelPointAnchor => {
  const angle = screenAngle(longitude, ascendant);
  return {
    x: centre + radius * Math.cos(angle),
    y: centre + radius * Math.sin(angle),
  };
};

const sectorPath = (
  start: number,
  end: number,
  inner: number,
  outer: number,
  ascendant: number,
): string => {
  const distance = Math.max(0.01, forwardDistance(start, end));
  const steps = Math.max(3, Math.ceil(distance / 3));
  const outerPoints: WheelPointAnchor[] = [];
  const innerPoints: WheelPointAnchor[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const longitude = normalise(start + distance * index / steps);
    outerPoints.push(polar(longitude, outer, ascendant));
    innerPoints.push(polar(longitude, inner, ascendant));
  }
  const first = outerPoints[0];
  if (first === undefined) return "";
  const commands = [`M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`];
  for (const point of outerPoints.slice(1)) commands.push(`L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`);
  for (const point of innerPoints.reverse()) commands.push(`L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`);
  commands.push("Z");
  return commands.join(" ");
};

const line = (
  parent: SVGElement,
  longitude: number,
  fromRadius: number,
  toRadius: number,
  ascendant: number,
  className: string,
): SVGLineElement => {
  const from = polar(longitude, fromRadius, ascendant);
  const to = polar(longitude, toRadius, ascendant);
  const element = svg("line");
  element.setAttribute("x1", String(from.x));
  element.setAttribute("y1", String(from.y));
  element.setAttribute("x2", String(to.x));
  element.setAttribute("y2", String(to.y));
  element.setAttribute("class", className);
  parent.append(element);
  return element;
};

const glyphAsset = (id: PointId): { path: string; rotation?: number; modifier?: string } | null => {
  const base = "./assets/astrology-glyphs/svg";
  if (["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].includes(id)) {
    return { path: `${base}/planets/${id}.svg` };
  }
  switch (id) {
    case "ascendant":
    case "descendant":
    case "midheaven":
    case "imum_coeli":
    case "vertex":
    case "east_point": return { path: `${base}/angles/${id}.svg` };
    case "antivertex": return { path: `${base}/angles/vertex.svg`, rotation: 180 };
    case "north_node_true": return { path: `${base}/misc/true_node.svg`, modifier: "N" };
    case "south_node_true": return { path: `${base}/misc/true_node.svg`, modifier: "S" };
    case "north_node_mean": return { path: `${base}/misc/mean_node.svg`, modifier: "N" };
    case "south_node_mean": return { path: `${base}/misc/mean_node.svg`, modifier: "S" };
    case "part_of_fortune": return { path: `${base}/points/lot_of_fortune.svg` };
    case "part_of_spirit": return { path: `${base}/points/lot_of_spirit.svg` };
    case "lilith_mean": return { path: `${base}/points/black_moon_lilith.svg`, modifier: "M" };
    case "lilith_true": return { path: `${base}/points/black_moon_lilith.svg`, modifier: "T" };
    default: return null;
  }
};

const signAsset = (sign: Sign): string => `./assets/astrology-glyphs/svg/zodiac/${sign}.svg`;

const addAssetGlyph = (
  parent: SVGGElement,
  path: string,
  fallback: string,
  x: number,
  y: number,
  glyphSize: number,
  rotation = 0,
  modifier?: string,
): void => {
  const fallbackText = svg("text");
  fallbackText.textContent = fallback;
  fallbackText.setAttribute("x", String(x));
  fallbackText.setAttribute("y", String(y + glyphSize * 0.32));
  fallbackText.setAttribute("text-anchor", "middle");
  fallbackText.setAttribute("class", "wheel-glyph-fallback");
  fallbackText.setAttribute("font-size", String(glyphSize));
  parent.append(fallbackText);

  const image = svg("image");
  image.setAttribute("href", path);
  image.setAttribute("x", String(x - glyphSize / 2));
  image.setAttribute("y", String(y - glyphSize / 2));
  image.setAttribute("width", String(glyphSize));
  image.setAttribute("height", String(glyphSize));
  image.setAttribute("class", "wheel-glyph-image");
  if (rotation !== 0) image.setAttribute("transform", `rotate(${rotation} ${x} ${y})`);
  image.addEventListener("load", () => { fallbackText.style.display = "none"; }, { once: true });
  image.addEventListener("error", () => { image.remove(); }, { once: true });
  parent.append(image);

  if (modifier !== undefined) {
    const marker = svg("text");
    marker.textContent = modifier;
    marker.setAttribute("x", String(x + glyphSize * 0.42));
    marker.setAttribute("y", String(y - glyphSize * 0.28));
    marker.setAttribute("class", "wheel-glyph-modifier");
    marker.setAttribute("font-size", String(Math.max(8, glyphSize * 0.32)));
    parent.append(marker);
  }
};

interface PlacedPoint {
  id: PointId;
  longitude: number;
  lane: number;
}

const pointLayout = (calculation: AstralCalculation): PlacedPoint[] => {
  const points = Object.entries(calculation.system.points)
    .flatMap(([rawId, point]) => point.position.value === null
      ? []
      : [{ id: rawId as PointId, longitude: point.position.value.longitudeDegrees }])
    .sort((left, right) => left.longitude - right.longitude || left.id.localeCompare(right.id));
  const lastByLane: (number | null)[] = [null, null, null, null, null];
  return points.map((point) => {
    let selected = 0;
    for (let lane = 0; lane < lastByLane.length; lane += 1) {
      const previous = lastByLane[lane];
      if (previous === undefined || previous === null || forwardDistance(previous, point.longitude) >= 6.5) {
        selected = lane;
        break;
      }
      selected = Math.min(lane + 1, lastByLane.length - 1);
    }
    lastByLane[selected] = point.longitude;
    return { ...point, lane: selected };
  });
};

const shortenSegment = (
  start: WheelPointAnchor,
  end: WheelPointAnchor,
  padding: number,
): { start: WheelPointAnchor; end: WheelPointAnchor } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { start, end };
  const inset = Math.min(padding, Math.max(0, length / 2 - 2));
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: start.x + ux * inset, y: start.y + uy * inset },
    end: { x: end.x - ux * inset, y: end.y - uy * inset },
  };
};

const extendSegment = (
  start: WheelPointAnchor,
  end: WheelPointAnchor,
  extension: number,
): { start: WheelPointAnchor; end: WheelPointAnchor } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { start, end };
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: start.x - ux * extension, y: start.y - uy * extension },
    end: { x: end.x + ux * extension, y: end.y + uy * extension },
  };
};

const aspectSegment = (
  aspect: Aspect,
  start: WheelPointAnchor,
  end: WheelPointAnchor,
): { start: WheelPointAnchor; end: WheelPointAnchor } =>
  aspect.kind === "conjunction" ? extendSegment(start, end, 18) : shortenSegment(start, end, 15);

const setSegment = (
  element: SVGLineElement,
  segment: { start: WheelPointAnchor; end: WheelPointAnchor },
): void => {
  element.setAttribute("x1", segment.start.x.toFixed(3));
  element.setAttribute("y1", segment.start.y.toFixed(3));
  element.setAttribute("x2", segment.end.x.toFixed(3));
  element.setAttribute("y2", segment.end.y.toFixed(3));
};

export const renderChartWheel = (calculation: AstralCalculation): HTMLElement => {
  const container = document.createElement("section");
  container.className = "chart-wheel";
  container.dataset["fingerprint"] = calculation.provenance.calculationFingerprint;

  const graphic = document.createElement("div");
  graphic.className = "chart-wheel-graphic";
  const root = svg("svg");
  root.setAttribute("viewBox", `0 0 ${size} ${size}`);
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", "Interactive deterministic natal chart wheel");
  graphic.append(root);
  container.append(graphic);

  const ascendantPosition = calculation.system.points.ascendant.position.value;
  const ascendant = ascendantPosition?.longitudeDegrees ?? 180;
  const timed = ascendantPosition !== null;

  const frame = svg("circle");
  frame.setAttribute("cx", String(centre));
  frame.setAttribute("cy", String(centre));
  frame.setAttribute("r", String(radii.outer));
  frame.setAttribute("class", "wheel-frame");
  root.append(frame);

  const zodiacGroup = svg("g");
  zodiacGroup.setAttribute("class", "wheel-zodiac");
  root.append(zodiacGroup);
  for (let index = 0; index < signOrder.length; index += 1) {
    const sign = signOrder[index];
    if (sign === undefined) continue;
    const start = index * 30;
    const end = start + 30;
    const sector = svg("path");
    sector.setAttribute("d", sectorPath(start, end, radii.zodiacInner, radii.outer, ascendant));
    sector.setAttribute("class", `wheel-sign wheel-sign-${sign}`);
    sector.setAttribute("tabindex", "0");
    sector.dataset["sign"] = sign;
    zodiacGroup.append(sector);

    const glyphPoint = polar(normalise(start + 15), (radii.zodiacInner + radii.outer) / 2, ascendant);
    const glyphGroup = svg("g");
    glyphGroup.setAttribute("class", "wheel-sign-glyph");
    addAssetGlyph(glyphGroup, signAsset(sign), signGlyphs[sign], glyphPoint.x, glyphPoint.y, 31);
    zodiacGroup.append(glyphGroup);
  }

  for (let longitude = 0; longitude < 360; longitude += 5) {
    line(root, longitude, longitude % 30 === 0 ? radii.outer - 14 : radii.outer - 7, radii.outer, ascendant,
      longitude % 30 === 0 ? "wheel-degree-tick major" : "wheel-degree-tick");
  }

  const houseChart = calculation.system.houses[calculation.settings.primaryHouseSystem];
  if (timed && houseChart.status !== "unavailable") {
    const houseGroup = svg("g");
    houseGroup.setAttribute("class", "wheel-houses");
    root.append(houseGroup);
    for (const house of Object.values(houseChart.houses)) {
      const cusp = house.cusp.value;
      const end = house.end.value;
      if (cusp === null || end === null) continue;
      const sector = svg("path");
      sector.setAttribute("d", sectorPath(cusp.longitudeDegrees, end.longitudeDegrees, radii.aspect, radii.zodiacInner, ascendant));
      sector.setAttribute("class", "wheel-house-sector");
      sector.setAttribute("tabindex", "0");
      sector.dataset["house"] = String(house.number);
      houseGroup.append(sector);
      line(houseGroup, cusp.longitudeDegrees, radii.aspect, radii.zodiacInner, ascendant,
        [1, 4, 7, 10].includes(house.number) ? "wheel-house-cusp angular" : "wheel-house-cusp");
      const middle = normalise(cusp.longitudeDegrees + forwardDistance(cusp.longitudeDegrees, end.longitudeDegrees) / 2);
      const labelPoint = polar(middle, 233, ascendant);
      const label = svg("text");
      label.textContent = String(house.number);
      label.setAttribute("x", String(labelPoint.x));
      label.setAttribute("y", String(labelPoint.y + 5));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "wheel-house-number");
      houseGroup.append(label);
    }
  }

  const placedPoints = pointLayout(calculation);
  const pointAnchors = new Map<PointId, WheelPointAnchor>();
  for (const placed of placedPoints) {
    const radius = radii.pointBase - placed.lane * 24;
    pointAnchors.set(placed.id, polar(placed.longitude, radius, ascendant));
  }

  const aspects = svg("g");
  aspects.setAttribute("class", "wheel-aspects");
  root.append(aspects);
  for (const aspect of calculation.system.aspects) {
    const startAnchor = pointAnchors.get(aspect.a);
    const endAnchor = pointAnchors.get(aspect.b);
    if (startAnchor === undefined || endAnchor === undefined) continue;
    const segment = aspectSegment(aspect, startAnchor, endAnchor);
    const visible = svg("line");
    setSegment(visible, segment);
    visible.setAttribute("class", `wheel-aspect wheel-aspect-${aspect.character} ${aspect.class}${aspect.kind === "conjunction" ? " wheel-aspect-conjunction-marker" : ""}`);
    visible.dataset["aspect"] = aspect.id;
    visible.dataset["aspectKind"] = aspect.kind;
    visible.dataset["endpointA"] = aspect.a;
    visible.dataset["endpointB"] = aspect.b;
    aspects.append(visible);

    const hit = svg("line");
    setSegment(hit, segment);
    hit.setAttribute("class", "wheel-aspect-hit");
    hit.setAttribute("tabindex", "0");
    hit.dataset["aspect"] = aspect.id;
    hit.dataset["aspectKind"] = aspect.kind;
    hit.dataset["endpointA"] = aspect.a;
    hit.dataset["endpointB"] = aspect.b;
    aspects.append(hit);
  }

  const pointGroup = svg("g");
  pointGroup.setAttribute("class", "wheel-points");
  root.append(pointGroup);
  for (const placed of placedPoints) {
    const point = calculation.system.points[placed.id];
    const position = point.position.value;
    const location = pointAnchors.get(placed.id);
    if (position === null || location === undefined) continue;
    const radius = radii.pointBase - placed.lane * 24;
    line(pointGroup, placed.longitude, radii.zodiacInner - 3, radius + 16, ascendant, "wheel-point-leader");
    line(pointGroup, placed.longitude, radii.zodiacInner - 10, radii.zodiacInner + 1, ascendant, "wheel-point-tick");
    const group = svg("g");
    group.setAttribute("class", "wheel-point");
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.dataset["point"] = placed.id;
    group.dataset["anchorX"] = location.x.toFixed(3);
    group.dataset["anchorY"] = location.y.toFixed(3);
    const asset = glyphAsset(placed.id);
    if (asset === null) {
      const fallback = svg("text");
      fallback.textContent = pointFallback[placed.id] ?? titleCase(placed.id).slice(0, 2);
      fallback.setAttribute("x", String(location.x));
      fallback.setAttribute("y", String(location.y + 8));
      fallback.setAttribute("text-anchor", "middle");
      fallback.setAttribute("class", "wheel-point-text");
      group.append(fallback);
    } else {
      addAssetGlyph(group, asset.path, pointFallback[placed.id] ?? "•", location.x, location.y, 29, asset.rotation ?? 0, asset.modifier);
    }
    pointGroup.append(group);
  }

  if (!timed) {
    const notice = svg("text");
    notice.textContent = "Birth time unknown · houses and angles are unavailable";
    notice.setAttribute("x", String(centre));
    notice.setAttribute("y", String(centre));
    notice.setAttribute("text-anchor", "middle");
    notice.setAttribute("class", "wheel-untimed-note");
    root.append(notice);
  }

  return container;
};
