import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
  version?: unknown;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
};
const uiVersion = await readFile("src/browser/uiVersion.ts", "utf8");
const modules = await readFile(".gitmodules", "utf8");
const wheelAdapter = await readFile("src/browser/chartWheel.ts", "utf8");
const glyphAdapter = await readFile("src/browser/chartWheelGlyphs.ts", "utf8");
const sync = await readFile("scripts/sync-chart-wheel.mjs", "utf8");

assert(packageJson.version === "0.20.0", "browser UI 0.22 must not alter calculation/recovery compatibility version");
assert(/browserUiVersion = "0\.22\.0"/u.test(uiVersion), "canonical browser UI release must be 0.22.0");
assert(/vendor\/astral-chart-wheel/u.test(modules) && /Online-Arcana\/astral-chart-wheel\.git/u.test(modules), "0.22 must pin the shared chart wheel repository");
assert(packageJson.dependencies?.["astral-chart-wheel"] === "file:vendor/astral-chart-wheel", "shared chart wheel must be an explicit package dependency");
assert(/from "astral-chart-wheel"/u.test(wheelAdapter), "natal wheel rendering must come from the shared package");
assert(/from "astral-chart-wheel"/u.test(glyphAdapter), "canonical wheel glyph handling must come from the shared package");
assert(/assets\/astrology-glyphs/u.test(sync) && /chart-wheel\.css/u.test(sync), "legacy browser asset paths must be mirrored from the shared dependency");
assert(/release022\.js/u.test(String(packageJson.scripts?.["test"] ?? "")), "standard test suite must retain the browser UI 0.22 release guard");

console.log("1..1");
