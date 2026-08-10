import { access, readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

interface ManifestItem {
  category: string;
  slug: string;
  label: string;
  file: string;
}

interface Manifest {
  item_count: number;
  items: ManifestItem[];
}

const loadManifest = async (): Promise<Manifest> =>
  JSON.parse(await readFile("public/assets/astrology-glyphs/manifest.json", "utf8")) as Manifest;

await test("imported glyph pack is complete and every manifest SVG exists", async () => {
  const manifest = await loadManifest();
  assert(manifest.item_count === 70, "viewer glyph pack must retain all 70 imported manifest items");
  assert(manifest.items.length === manifest.item_count, "manifest item_count must match the item array");

  const categories = new Set(manifest.items.map((item) => item.category));
  for (const category of ["zodiac", "planets", "points", "angles", "aspects", "misc"]) {
    assert(categories.has(category), `glyph manifest must retain ${category}`);
  }

  for (const item of manifest.items) {
    assert(item.file.startsWith("svg/") && item.file.endsWith(".svg"), `${item.slug} must point to an SVG asset`);
    await access(`public/assets/astrology-glyphs/${item.file}`);
  }
});

await test("core customer symbols are available in the imported pack", async () => {
  const manifest = await loadManifest();
  const slugs = new Set(manifest.items.map((item) => item.slug));
  for (const slug of [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
    "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "east_point",
    "north_node", "south_node", "mean_node", "true_node", "black_moon_lilith", "lot_of_fortune",
    "conjunction", "opposition", "trine", "square", "sextile", "quincunx", "semi_sextile", "semi_square", "sesquiquadrate",
    "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
  ]) {
    assert(slugs.has(slug), `glyph pack must include ${slug}`);
  }
});

await test("glyph renderer loads after stable customer presentation", async () => {
  const browserTools = await readFile("src/browser/browserTools.ts", "utf8");
  const languageIndex = browserTools.indexOf('await import("./customerLanguagePass.js")');
  const stateIndex = browserTools.indexOf('await import("./viewerInitialState.js")');
  const glyphIndex = browserTools.indexOf('await import("./viewerGlyphs.js")');
  assert(languageIndex >= 0 && stateIndex > languageIndex && glyphIndex > stateIndex, "glyph enhancement must run after customer language and disclosure state");
});

await test("glyphs are derived from canonical chart semantics rather than translated copy", async () => {
  const source = await readFile("src/browser/viewerGlyphs.ts", "utf8");
  assert(source.includes('reading.dataset["originalTitle"]'), "glyph extraction must read the preserved canonical title");
  assert(source.includes("semanticSlugs(source)"), "canonical title must be parsed into semantic glyph slugs");
  assert(source.includes('phrases: ["midheaven"]'), "Midheaven must have a semantic mapping");
  assert(source.includes('phrases: ["pluto"]'), "Pluto must have a semantic mapping");
  assert(source.includes('phrases: ["ascendant"]'), "Ascendant must have a semantic mapping");
  assert(source.includes('phrases: ["virgo"]'), "Virgo must have a semantic mapping");
});

await test("SVG traces inherit typography colour through CSS masking", async () => {
  const source = await readFile("src/browser/viewerGlyphs.ts", "utf8");
  const styles = await readFile("public/viewer-glyphs.css", "utf8");
  assert(source.includes("--astrology-glyph-url"), "renderer must pass SVG files to CSS as mask URLs");
  assert(!source.includes('document.createElement("img")'), "viewer must not render fixed-colour SVGs as ordinary images");
  assert(/\.astrology-glyph[\s\S]*?background-color:\s*currentColor/u.test(styles), "glyph trace must be painted with currentColor");
  assert(/mask-image:\s*var\(--astrology-glyph-url\)/u.test(styles), "glyph must use the SVG as a CSS mask");
  assert(/width:\s*1\.02em/u.test(styles) && /height:\s*1\.02em/u.test(styles), "inline glyphs must scale with the surrounding title text");
});

await test("title and index glyph clusters remain textless and decorative", async () => {
  const source = await readFile("src/browser/viewerGlyphs.ts", "utf8");
  assert(source.includes('cluster.setAttribute("aria-hidden", "true")'), "symbol clusters must be hidden from assistive technology because plain-English text remains primary");
  assert(source.includes("syncSummaryGlyphs(summary, entries)"), "actual chart headings must receive glyph clusters");
  assert(source.includes("syncIndexGlyphs(reading, entries)"), "matching index entries must receive the same glyph shorthand");
  assert(source.includes("chart-symbol-title-text"), "visible title text must remain a dedicated plain-English label");
});

await test("right-hand legend explains only symbols used by the current chart", async () => {
  const source = await readFile("src/browser/viewerGlyphs.ts", "utf8");
  const styles = await readFile("public/viewer-glyphs.css", "utf8");
  assert(source.includes('heading.textContent = "Chart symbols"'), "viewer must expose a Chart symbols legend");
  assert(source.includes("const used = new Map<string, GlyphManifestItem>()"), "legend must be derived from glyphs actually used in the rendered chart");
  assert(source.includes("meaningFor(entry)"), "every legend row must explain the symbol rather than showing a glyph alone");
  assert(/grid-template-columns:\s*minmax\(15rem, 19rem\)\s+minmax\(0, 1fr\)\s+minmax\(14rem, 18rem\)/u.test(styles), "wide viewer must reserve a third column for the symbol legend");
  assert(/\.chart-symbol-legend[\s\S]*?position:\s*sticky/u.test(styles), "desktop legend must remain available as a quick-reference panel");
  assert(/> \.chart-symbol-legend[\s\S]*?grid-column:\s*3/u.test(styles), "legend must render on the right-hand side on wide screens");
});

await test("viewer deliberately selects standard planetary variants without discarding alternatives", async () => {
  const source = await readFile("src/browser/viewerGlyphs.ts", "utf8");
  const manifest = await loadManifest();
  assert(source.includes('uranus: "uranus"') && source.includes('neptune: "neptune"') && source.includes('pluto: "pluto"'), "customer viewer must explicitly select standard Uranus, Neptune and Pluto forms");
  const slugs = new Set(manifest.items.map((item) => item.slug));
  assert(slugs.has("uranus_alt") && slugs.has("neptune_alt") && slugs.has("pluto_form_two") && slugs.has("pluto_form_five"), "alternate imported forms must remain available for other applications");
});

console.log(`1..${passed}`);
