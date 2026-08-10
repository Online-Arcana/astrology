import { readFile } from "node:fs/promises";
import { customerReadingDescription, customerReadingTitle } from "../src/browser/customerReadingHelp.js";
import { displayReadingTitle, readingDescription, stripZodiacPrefix } from "../src/browser/readingHelp.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

await test("viewer removes redundant zodiac prefixes", () => {
  equal(stripZodiacPrefix("tropical lunar phase"), "lunar phase", "tropical prefix");
  equal(stripZodiacPrefix("sidereal chart balance"), "chart balance", "sidereal prefix");
});

await test("houses use plain-English life-area titles", () => {
  equal(displayReadingTitle("tropical house 1"), "Self and identity", "House 1 title");
  equal(displayReadingTitle("tropical house 8"), "Intimacy, shared resources and change", "House 8 title");
  equal(displayReadingTitle("tropical house 12"), "Inner life, retreat and hidden patterns", "House 12 title");
  assert(readingDescription("tropical house 8")?.startsWith("House 8 covers intimacy") === true, "House 8 must explain its life area");
});

await test("canonical aspect names remain available internally", () => {
  equal(
    displayReadingTitle("tropical aspect part of spirit vertex trine"),
    "Part of Spirit trine Vertex",
    "Part of Spirit aspect",
  );
  equal(
    displayReadingTitle("tropical aspect north node mean uranus conjunction"),
    "North Node conjunct Uranus",
    "North Node aspect",
  );
  equal(
    displayReadingTitle("tropical aspect imum coeli moon sesquiquadrate"),
    "Imum Coeli sesquiquadrate Moon",
    "Imum Coeli aspect",
  );
});

await test("customer aspect titles explain meaning instead of exposing jargon", () => {
  equal(
    customerReadingTitle("tropical aspect part of spirit vertex trine"),
    "Purpose and inner direction + Significant encounters: natural strengths and easy flow",
    "plain trine title",
  );
  equal(
    customerReadingTitle("tropical aspect north node mean uranus conjunction"),
    "Growth direction + Uranus: strongly combined influences",
    "plain conjunction title",
  );
  equal(
    customerReadingTitle("tropical aspect imum coeli moon sesquiquadrate"),
    "Home and private foundations + Moon: persistent pressure",
    "plain persistent-pressure title",
  );
  const title = customerReadingTitle("tropical aspect imum coeli moon sesquiquadrate");
  const description = customerReadingDescription("tropical aspect imum coeli moon sesquiquadrate") ?? "";
  assert(!/tropical|sidereal|sesquiquadrate|imum coeli/iu.test(`${title} ${description}`), "customer aspect copy must not expose internal or obscure technical naming");
});

await test("customer pattern titles explain the pattern instead of naming it", () => {
  equal(customerReadingTitle("tropical pattern t square"), "Focused pressure that needs an outlet", "T-square display");
  equal(customerReadingTitle("tropical pattern grand trine"), "Strong natural flow across the chart", "grand-trine display");
});

await test("life-section machine labels are customer-facing", () => {
  equal(displayReadingTitle("tropical life children And Nurturing"), "Children and nurturing", "children title");
  equal(displayReadingTitle("tropical life money And Material Security"), "Money and material security", "money title");
  assert(readingDescription("tropical life children And Nurturing")?.includes("care, nurturing") === true, "children section must explain what it covers");
});

await test("overview leads the chart and owns synthesis readings", async () => {
  const source = await readFile("src/browser/viewerHierarchy.ts", "utf8");
  const synthesis = await readFile("src/browser/synthesisCategory.ts", "utf8");
  const customer = await readFile("src/browser/customerLanguagePass.ts", "utf8");
  assert(/title\.textContent = "Overview"/u.test(synthesis), "synthesis category must be renamed Overview");
  assert(/host\.prepend\(details\)/u.test(synthesis), "Overview must be moved to the beginning of the chart");
  assert(/navRoot\.prepend\(item\)/u.test(source), "Overview must be moved to the beginning of the index");
  assert(/Integrated chart synthesis/u.test(source) && /Final personal portrait/u.test(source), "Overview must recognise canonical synthesis readings");
  assert(/"chart-category-synthesis": "Overview"/u.test(customer), "customer presentation must preserve the Overview label");
});

await test("every ordinary category is organised as category group section", async () => {
  const source = await readFile("src/browser/viewerHierarchy.ts", "utf8");
  assert(/chart-reading-group/u.test(source), "ordinary categories must create explicit reading groups");
  assert(/rebuildCategoryIndex/u.test(source), "group hierarchy must also be reflected in the index");
  assert(/categoryIndexList\(category\.id\)/u.test(source), "grouped index must remain nested below its category");
  assert(/\.chart-reading-group\{/u.test(source), "reading groups must have customer-facing styling");
});

await test("large aspect collections are divided into stable meaning groups", async () => {
  const hierarchy = await readFile("src/browser/viewerHierarchy.ts", "utf8");
  const customer = await readFile("src/browser/customerLanguagePass.ts", "utf8");
  for (const id of ["patterns", "conjunctions", "oppositions", "trines", "squares", "sextiles", "quincunxes", "semi-sextiles", "semi-squares", "sesquiquadrates", "creative-minor", "declination"]) {
    assert(hierarchy.includes(`"${id}"`), `aspect hierarchy must include ${id}`);
  }
  for (const label of [
    "Big-picture interaction patterns",
    "Strongly combined influences",
    "Balancing opposite pulls",
    "Natural strengths and easy flow",
    "Pressure, friction and growth",
    "Supportive opportunities",
    "Adjustment and compromise",
    "Subtle connections",
    "Low-level friction",
    "Persistent pressure",
    "Creative talents and unusual strengths",
    "Parallel and contrasting influences",
  ]) {
    assert(customer.includes(label), `customer aspect group must expose ${label}`);
  }
});

await test("customer categories and point groups use meaning-first labels", async () => {
  const customer = await readFile("src/browser/customerLanguagePass.ts", "utf8");
  assert(/"chart-category-points": "Personality and life direction"/u.test(customer), "point category must use a meaning-first label");
  assert(/"chart-category-houses": "Life areas"/u.test(customer), "houses must be presented as life areas");
  assert(/"chart-category-aspects": "How your chart factors work together"/u.test(customer), "aspects category must explain what it contains");
  assert(/"chart-group-points-personal-planets": "Thinking, relating and taking action"/u.test(customer), "personal planets group must describe its meaning");
  assert(/"chart-group-points-nodes-points": "Life direction and significant turning points"/u.test(customer), "technical points group must describe its meaning");
});

await test("compatibility viewer has group domain section hierarchy and a styled sign filter", async () => {
  const source = await readFile("src/browser/viewerEnhancements.ts", "utf8");
  const hierarchy = await readFile("src/browser/viewerHierarchy.ts", "utf8");
  assert(/title: "Relationships"/u.test(source), "compatibility must have a Relationships group");
  assert(/title: "Sexual"/u.test(source), "compatibility must have a Sexual group");
  assert(/title: "Business"/u.test(source), "compatibility must have a Business group");
  assert(/Show compatibility with/u.test(source) && /All zodiac signs/u.test(source), "compatibility must provide one sign filter");
  assert(/compatibility-bucket/u.test(source) && /compatibility-domain/u.test(source), "compatibility must retain group and domain tiers");
  assert(/domainList/u.test(source) && /readingList/u.test(source), "compatibility index must expose group, domain and reading tiers");
  assert(/\.compatibility-sign-filter\{/u.test(hierarchy) && /\.compatibility-sign-filter select/u.test(hierarchy), "compatibility filter must be visibly styled");
});

await test("chart index stays visible on the left with nested branches collapsed", async () => {
  const source = await readFile("src/browser/viewerEnhancements.ts", "utf8");
  const styles = await readFile("public/viewer-enhancements.css", "utf8");
  assert(/formatted-index-branch-toggle/u.test(source), "index branches must have their own disclosure controls");
  assert(/children\.hidden = true/u.test(source), "nested index children must start collapsed");
  assert(source.includes('toggle.setAttribute("aria-expanded", "false")'), "nested disclosure controls must start collapsed for assistive technology");
  assert(!/formattedChartIndexContents/u.test(source), "the whole chart index must not be wrapped in a collapsed container");
  assert(/> \.formatted-chart-index[\s\S]*?grid-column:\s*1/u.test(styles), "desktop index must occupy the left column");
  assert(/> #formattedChart[\s\S]*?grid-column:\s*2/u.test(styles), "formatted chart content must occupy the right column");
  assert(!/index-collapsed/u.test(styles), "viewer must not collapse the whole index column");
});

await test("nested index links open their complete details path", async () => {
  const source = await readFile("src/browser/viewerHierarchy.ts", "utf8");
  assert(/openPath/u.test(source), "nested navigation must open ancestor details");
  assert(/parent instanceof HTMLDetailsElement/u.test(source), "nested navigation must open intermediate groups before scrolling");
});

await test("late regrouping preserves canonical classification without exposing it", async () => {
  const guard = await readFile("src/browser/viewerRegroupGuard.ts", "utf8");
  const customer = await readFile("src/browser/customerLanguagePass.ts", "utf8");
  assert(/data-original-title|originalTitle/u.test(guard), "regroup guard must use the stored canonical title");
  assert(/viewerTitleLocked.*false/u.test(guard), "regroup guard must temporarily unlock titles for classification");
  assert(/viewerTitleLocked.*true/u.test(customer), "customer pass must lock the final visible wording");
});

await test("viewer observers remain scoped to formatted chart UI", async () => {
  const source = await readFile("src/browser/viewerEnhancements.ts", "utf8");
  const hierarchy = await readFile("src/browser/viewerHierarchy.ts", "utf8");
  const customer = await readFile("src/browser/customerLanguagePass.ts", "utf8");
  const guard = await readFile("src/browser/viewerRegroupGuard.ts", "utf8");
  assert(!/observe\(document\.body/u.test(source) && !/observe\(document\.body/u.test(hierarchy) && !/observe\(document\.body/u.test(customer) && !/observe\(document\.body/u.test(guard), "viewer must not install a page-wide observer");
  assert(/#formattedChart/u.test(source) && /#formattedView/u.test(source), "viewer observers must stay scoped to formatted-chart containers");
});

console.log(`1..${passed}`);
