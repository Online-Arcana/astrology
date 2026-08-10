const glyphBase = "./assets/astrology-glyphs/svg/misc";
const pointGlyphBase = "./assets/astrology-glyphs/svg/points";
const svgNamespace = "http://www.w3.org/2000/svg";

interface CanonicalNodeGlyph {
  path: string;
  modifier: "N" | "S";
  fallback: "TN" | "TS" | "MN" | "MS";
}

const canonicalNodeGlyphs: Readonly<Record<string, CanonicalNodeGlyph>> = {
  north_node_true: { path: `${glyphBase}/true_node.svg`, modifier: "N", fallback: "TN" },
  south_node_true: { path: `${glyphBase}/true_node.svg`, modifier: "S", fallback: "TS" },
  north_node_mean: { path: `${glyphBase}/mean_node.svg`, modifier: "N", fallback: "MN" },
  south_node_mean: { path: `${glyphBase}/mean_node.svg`, modifier: "S", fallback: "MS" },
};

const applyNodeGlyph = (pointId: string, glyph: CanonicalNodeGlyph, wheel: HTMLElement): void => {
  const point = wheel.querySelector<SVGGElement>(`.wheel-point[data-point="${pointId}"]`);
  if (point === null) return;

  const fallback = point.querySelector<SVGTextElement>(".wheel-glyph-fallback, .wheel-point-text");
  if (fallback !== null) fallback.textContent = glyph.fallback;

  const image = point.querySelector<SVGImageElement>("image.wheel-glyph-image");
  if (image === null) return;
  image.setAttribute("href", glyph.path);
  image.removeAttribute("transform");

  point.querySelector(".wheel-glyph-modifier")?.remove();
  const x = Number(image.getAttribute("x") ?? 0);
  const y = Number(image.getAttribute("y") ?? 0);
  const width = Number(image.getAttribute("width") ?? 29);
  const height = Number(image.getAttribute("height") ?? 29);
  const centreX = x + width / 2;
  const centreY = y + height / 2;
  const marker = document.createElementNS(svgNamespace, "text");
  marker.textContent = glyph.modifier;
  marker.setAttribute("x", String(centreX + width * 0.42));
  marker.setAttribute("y", String(centreY - height * 0.28));
  marker.setAttribute("class", "wheel-glyph-modifier wheel-node-direction");
  marker.setAttribute("font-size", String(Math.max(8, width * 0.32)));
  point.append(marker);
};

const applySpiritGlyph = (wheel: HTMLElement): void => {
  const point = wheel.querySelector<SVGGElement>('.wheel-point[data-point="part_of_spirit"]');
  if (point === null) return;

  const fallback = point.querySelector<SVGTextElement>(".wheel-point-text");
  if (fallback === null) return;
  fallback.textContent = "Φ";

  const existing = point.querySelector<SVGImageElement>("image.wheel-glyph-image");
  if (existing !== null) {
    existing.setAttribute("href", `${pointGlyphBase}/lot_of_spirit.svg`);
    return;
  }

  const x = Number(fallback.getAttribute("x") ?? 0);
  const y = Number(fallback.getAttribute("y") ?? 0) - 8;
  const glyphSize = 29;
  const image = document.createElementNS(svgNamespace, "image");
  image.setAttribute("href", `${pointGlyphBase}/lot_of_spirit.svg`);
  image.setAttribute("x", String(x - glyphSize / 2));
  image.setAttribute("y", String(y - glyphSize / 2));
  image.setAttribute("width", String(glyphSize));
  image.setAttribute("height", String(glyphSize));
  image.setAttribute("class", "wheel-glyph-image");
  image.addEventListener("load", () => { fallback.style.display = "none"; }, { once: true });
  image.addEventListener("error", () => { image.remove(); }, { once: true });
  point.append(image);
};

/**
 * Applies the wheel's canonical point glyph conventions.
 * Mean/True is encoded by the node SVG shape; North/South is encoded by N/S.
 * Part of Spirit uses a distinct phi-style SVG rather than the Sun-like fallback.
 */
export const applyCanonicalWheelGlyphs = (wheel: HTMLElement): void => {
  for (const [pointId, glyph] of Object.entries(canonicalNodeGlyphs)) {
    applyNodeGlyph(pointId, glyph, wheel);
  }
  applySpiritGlyph(wheel);
};
