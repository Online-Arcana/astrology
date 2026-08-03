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

console.log("1..1");
