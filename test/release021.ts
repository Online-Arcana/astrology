import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
  version?: unknown;
  scripts?: Record<string, unknown>;
};
const runtime = await readFile("src/browser/runtime.ts", "utf8");
const uiVersion = await readFile("src/browser/uiVersion.ts", "utf8");
const browserTools = await readFile("src/browser/browserTools.ts", "utf8");
const pagesBuild = await readFile("scripts/build-pages.mjs", "utf8");

assert(packageJson.version === "0.20.0", "browser UI releases must not silently change the core package/runtime compatibility release");
assert(/browserVersion = "0\.20\.0"/u.test(runtime), "browser recovery compatibility must remain on 0.20.0 until its format changes");
assert(/export const browserUiVersion = "0\.\d+\.0"/u.test(uiVersion), "browser presentation must retain an independent UI release identity");
assert(/Browser UI \$\{browserUiVersion\} · \$\{browserUiBuild\}/u.test(uiVersion), "visible UI identity must include release and build identity");
assert(/__ASTRAL_UI_BUILD_SHA__/u.test(uiVersion), "browser UI must consume its build identity");
assert(/import "\.\/uiVersion\.js"/u.test(browserTools), "browser tools must initialise the canonical UI identity");
assert(/process\.env\.GITHUB_SHA/u.test(pagesBuild), "Pages build must source its deployed identity from the GitHub commit SHA");
assert(/"__ASTRAL_UI_BUILD_SHA__": JSON\.stringify\(uiBuildSha\)/u.test(pagesBuild), "Pages build must inject the commit identity into the browser bundle");
assert(/release021\.js/u.test(String(packageJson.scripts?.["test"] ?? "")), "standard test suite must retain the browser UI 0.21 feature guard");

// 0.21 established the presentation boundary accumulated after the original
// 0.20 static frontend. Later UI versions must preserve these capabilities.
await Promise.all([
  readFile("src/browser/vaultUi.ts", "utf8"),
  readFile("src/browser/packageFlow.ts", "utf8"),
  readFile("src/browser/viewerHierarchy.ts", "utf8"),
  readFile("src/browser/chartWheelBootstrap.ts", "utf8"),
  readFile("src/browser/randomChartTest.ts", "utf8"),
]);

console.log("1..1");
