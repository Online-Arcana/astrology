import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

await test("viewer state pass loads after hierarchy and customer language", async () => {
  const browserTools = await readFile("src/browser/browserTools.ts", "utf8");
  const hierarchyIndex = browserTools.indexOf('await import("./viewerHierarchy.js")');
  const languageIndex = browserTools.indexOf('await import("./customerLanguagePass.js")');
  const stateIndex = browserTools.indexOf('await import("./viewerInitialState.js")');
  assert(hierarchyIndex >= 0 && languageIndex > hierarchyIndex && stateIndex > languageIndex, "initial collapse state must run after hierarchy and customer presentation");
});

await test("newly rendered chart details default to collapsed", async () => {
  const source = await readFile("src/browser/viewerInitialState.ts", "utf8");
  for (const selector of [
    "details.chart-category",
    "details.chart-reading-group",
    "details.chart-reading",
    "details.compatibility-bucket",
    "details.compatibility-domain",
  ]) {
    assert(source.includes(selector), `initial state must cover ${selector}`);
  }
  assert(/details\.open = false/u.test(source), "initial state must explicitly close details controls");
  assert(/protectedHashPath/u.test(source), "deep links must be protected from initial collapsing");
  assert(/MutationObserver/u.test(source) && /structuralAddition/u.test(source), "new chart structures must trigger the initial-state pass");
});

await test("index branch labels toggle the same disclosure as their arrows", async () => {
  const source = await readFile("src/browser/viewerInitialState.ts", "utf8");
  assert(/#formattedChartIndex \.formatted-index-row > a\[href\^='#'\]/u.test(source), "branch label clicks must be delegated from the formatted viewer");
  assert(/formatted-index-branch-toggle/u.test(source), "branch labels must resolve their existing disclosure control");
  assert(/event\.preventDefault\(\)/u.test(source), "branch label disclosure must not navigate the main chart");
  assert(/event\.stopPropagation\(\)/u.test(source), "branch label disclosure must not reach the legacy navigation handler");
  assert(/toggle\.click\(\)/u.test(source), "branch labels must use the exact same toggle behaviour as the disclosure arrow");
});

await test("closed details and hidden index branches are actually hidden", async () => {
  const styles = await readFile("public/viewer-state-fixes.css", "utf8");
  assert(/\.formatted-chart-index \[hidden\][\s\S]*?display:\s*none\s*!important/u.test(styles), "hidden index branches must override grid display rules");
  assert(/\.chart-category:not\(\[open\]\) > \.chart-category-body/u.test(styles), "closed categories must hide their bodies");
  assert(/\.chart-reading-group:not\(\[open\]\) > \.chart-reading-group-body/u.test(styles), "closed groups must hide their bodies");
  assert(/\.chart-reading:not\(\[open\]\) > \.chart-reading-body/u.test(styles), "closed sections must hide their bodies");
  assert(/\.compatibility-bucket:not\(\[open\]\) > \.compatibility-bucket-body/u.test(styles), "closed compatibility groups must hide their bodies");
  assert(/\.compatibility-domain:not\(\[open\]\) > \.compatibility-domain-body/u.test(styles), "closed compatibility domains must hide their bodies");
});

await test("compatibility sign filter has high-contrast customer styling", async () => {
  const styles = await readFile("public/viewer-state-fixes.css", "utf8");
  assert(/\.compatibility-sign-filter > span[\s\S]*?color:\s*#f5f1ff\s*!important/u.test(styles), "filter label must use high-contrast text");
  assert(/\.compatibility-sign-filter select[\s\S]*?background:\s*#130f26\s*!important/u.test(styles), "filter select must have a distinct dark field");
  assert(/\.compatibility-sign-filter select[\s\S]*?color:\s*#ffffff\s*!important/u.test(styles), "selected sign must be bright and readable");
  assert(/\.compatibility-sign-filter select option[\s\S]*?background:\s*#130f26/u.test(styles), "dropdown options must keep a dark background");
  assert(/\.compatibility-sign-filter select option[\s\S]*?color:\s*#ffffff/u.test(styles), "dropdown options must keep bright text");
});

console.log(`1..${passed}`);
