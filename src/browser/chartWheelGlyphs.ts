const glyphBase = "./assets/astrology-glyphs/svg/misc";

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

/**
 * Replaces the chart-wheel prototype's temporary node composition with the
 * canonical dedicated Mean/True Node SVG assets now shipped by the viewer.
 * The South Node is the corresponding North Node mark rotated by 180 degrees.
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
};
