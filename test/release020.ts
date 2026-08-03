import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
  version?: unknown;
  scripts?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
};
assert(packageJson.version === "0.20.0", "static browser frontend landmark must be version 0.20.0");
assert(packageJson.scripts?.["build:pages"] === "node scripts/build-pages.mjs", "Pages build command must remain available");
assert(typeof packageJson.devDependencies?.["esbuild"] === "string", "Pages build must retain esbuild");

const pages = await readFile(".github/workflows/pages.yml", "utf8");
assert(/actions\/deploy-pages@v4/u.test(pages), "Pages workflow must deploy the built public directory");
assert(!/SIGNATURE_KEY|OPENAI_API_KEY/u.test(pages), "Pages deployment must not inject private keys");

const html = await readFile("public/index.html", "utf8");
assert(/Formatted/u.test(html) && /Raw/u.test(html), "opened charts must provide formatted and raw tabs");
assert(/Preferred gender/u.test(html), "browser form must expose preferred gender metadata");
assert(/Ed25519 signing key bundle/u.test(html), "browser form must accept a client-only signing key");
assert(/OpenAI API key/u.test(html), "browser form must accept a client-only OpenAI key");
assert(!/id="cityQuery"[^>]*\svalue=/u.test(html), "browser form must not contain a preselected place");
assert(!/signOpened|Sign opened/u.test(html), "opened files must not expose signing controls");

const build = await readFile("scripts/build-pages.mjs", "utf8");
assert(/places\/manifest\.json/u.test(build), "Pages build must generate the static place manifest");
assert(/src\/browser\/places\.ts/u.test(build), "Pages build must replace the server-only place loader");
assert(/src\/browser\/vendor\.ts/u.test(build), "Pages build must replace dynamic vendor loading");
assert(/Public Pages asset failed privacy audit/u.test(build), "Pages build must retain the privacy gate");

const runtime = await readFile("src/browser/runtime.ts", "utf8");
const app = await readFile("src/browser/app.ts", "utf8");
assert(/generated\.file\.authority !== null/u.test(runtime), "browser generation must refuse to replace an existing authority");
assert(!/sign\(/u.test(app), "file-opening UI must not directly access the signing function");
assert(/encodeAstralFile\(file, true\)/u.test(app), "final browser files must be indented");

console.log("1..1");
