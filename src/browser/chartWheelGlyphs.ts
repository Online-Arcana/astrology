const glyphBase = "./assets/astrology-glyphs/svg/misc";
const pointGlyphBase = "./assets/astrology-glyphs/svg/points";
const svgNamespace = "http://www.w3.org/2000/svg";

interface CanonicalNodeGlyph {
  path: string;
  rotation: 0 | 180;
}

const canonicalNodeGlyphs: Readonly<Record<string, CanonicalNodeGlyph>> = {
  north_node_true: { path: `${glyphBase}/true_node.svg`, rotation: 0 },
  south_node_true: { path: `${glyphBase}/true_node.svg`, rotation: 180 },
  north_node_mean: { path: `${glyphBase}/mean_node.svg`, rotation: 0 },
  south_node_mean: { path: `${glyphBase}/mean_node.svg`, rotation: 180 },
};

const rotateImage = (image: SVGImageElement, rotation: 0 | 180): void => {
  if (rotation === 0) {
    image.removeAttribute("transform");
    return;
  }
  const x = Number(image.getAttribute("x") ?? 0);
  const y = Number(image.getAttribute("y") ?? 0);
  const width = Number(image.getAttribute("width") ?? 0);
  const height = Number(image.getAttribute("height") ?? 0);
  const centreX = x + width / 2;
  const centreY = y + height / 2;
  image.setAttribute("transform", `rotate(${rotation} ${centreX} ${centreY})`);
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
 * Replaces temporary chart-wheel glyphs with canonical dedicated assets.
 * Mean/True Nodes use their dedicated SVGs, with South Nodes rotated 180°.
 * Part of Spirit uses a distinct phi-style SVG rather than the Sun-like ⊙ fallback.
 */
export const applyCanonicalWheelGlyphs = (wheel: HTMLElement): void => {
  for (const [pointId, glyph] of Object.entries(canonicalNodeGlyphs)) {
    const point = wheel.querySelector<SVGGElement>(`.wheel-point[data-point="${pointId}"]`);
    if (point === null) continue;
    const image = point.querySelector<SVGImageElement>("image.wheel-glyph-image");
    if (image === null) continue;
    image.setAttribute("href", glyph.path);
    rotateImage(image, glyph.rotation);
    point.querySelector(".wheel-glyph-modifier")?.remove();
  }

  applySpiritGlyph(wheel);
};
