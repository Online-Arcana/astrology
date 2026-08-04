import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { build } from "esbuild";

const publicDir = resolve("public");
const placeSource = resolve("vendor/places/packages/countries/dist/data");
const placeOutput = resolve(publicDir, "places/data");
const usabilityStylePath = resolve(publicDir, "usability.css");
const chartViewPath = resolve(publicDir, "chart-view.js");
const chartViewStylePath = resolve(publicDir, "chart-view.css");
const browserToolsPath = resolve(publicDir, "browser-tools.js");
const browserToolsStylePath = resolve(publicDir, "test-tools.css");
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">';

const finalCode = (name) => name.split("-").at(-1) ?? "";

const placeManifest = async () => {
  const countries = {};
  const states = {};
  for (const item of await readdir(placeSource, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const country = finalCode(item.name).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) continue;
    countries[country] = item.name;
    states[country] = {};
    const countryPath = resolve(placeSource, item.name);
    for (const region of await readdir(countryPath, { withFileTypes: true })) {
      if (!region.isDirectory()) continue;
      const code = finalCode(region.name).toUpperCase();
      if (!/^[A-Z0-9-]+$/.test(code)) continue;
      states[country][code] = region.name;
    }
  }
  return {
    schema: "astral-browser-places/1.0.0",
    countries,
    states,
  };
};

const matchingFiles = async (directory, extensions) => {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) {
      files.push(...await matchingFiles(path, extensions));
      continue;
    }
    if (item.isFile() && extensions.has(extname(item.name).toLowerCase())) files.push(path);
  }
  return files;
};

const htmlFiles = (directory) => matchingFiles(directory, new Set([".html"]));

const assetSource = (file, assetPath) => {
  const path = relative(dirname(file), assetPath).replaceAll("\\", "/");
  return path.startsWith(".") ? path : `./${path}`;
};

const scriptTag = (file, path) => `<script type="module" src="${assetSource(file, path)}"></script>`;
const styleTag = (file, path) => `<link rel="stylesheet" href="${assetSource(file, path)}">`;

const applyPageDefaults = async () => {
  const viewportPattern = /<meta\s+name=["']viewport["'][^>]*>/iu;
  const headPattern = /<head(?:\s[^>]*)?>/iu;
  const headClosePattern = /<\/head\s*>/iu;
  const bodyPattern = /<\/body\s*>/iu;
  const minuteTimePattern = /(<input\b[^>]*\bid=["']time["'][^>]*\bstep=["'])1(["'][^>]*>)/iu;
  const staleKeyExportPattern = /^\s*<script\b[^>]*\bsrc=["'][^"']*key-export\.js["'][^>]*><\/script>\s*$/gimu;
  for (const file of await htmlFiles(publicDir)) {
    const content = await readFile(file, "utf8");
    let updated = content.replace(staleKeyExportPattern, "");
    updated = viewportPattern.test(updated)
      ? updated.replace(viewportPattern, viewport)
      : updated.replace(headPattern, (head) => `${head}\n  ${viewport}`);
    updated = updated.replace(minuteTimePattern, (_match, before, after) => `${before}60${after}`);
    for (const [needle, path] of [
      ["usability.css", usabilityStylePath],
      ["chart-view.css", chartViewStylePath],
      ["test-tools.css", browserToolsStylePath],
    ]) {
      if (updated.includes(needle)) continue;
      if (!headClosePattern.test(updated)) throw new Error(`Public HTML page has no closing head tag: ${file}`);
      updated = updated.replace(headClosePattern, `  ${styleTag(file, path)}\n</head>`);
    }
    for (const [needle, path] of [
      ["chart-view.js", chartViewPath],
      ["browser-tools.js", browserToolsPath],
    ]) {
      if (updated.includes(needle)) continue;
      if (!bodyPattern.test(updated)) throw new Error(`Public HTML page has no closing body tag: ${file}`);
      updated = updated.replace(bodyPattern, `  ${scriptTag(file, path)}\n</body>`);
    }
    if (updated === content) continue;
    await writeFile(file, updated, "utf8");
  }
};

await mkdir(publicDir, { recursive: true });
await rm(resolve(publicDir, "places"), { recursive: true, force: true });
await rm(resolve(publicDir, "chunks"), { recursive: true, force: true });
await rm(resolve(publicDir, "key-export.js"), { force: true });
await mkdir(resolve(publicDir, "places"), { recursive: true });
await cp(placeSource, placeOutput, { recursive: true });
await writeFile(
  resolve(publicDir, "places/manifest.json"),
  `${JSON.stringify(await placeManifest())}\n`,
  "utf8",
);

const aliases = {
  "vendor/load.js": resolve("src/browser/vendor.ts"),
  "place/csc.js": resolve("src/browser/places.ts"),
};

await build({
  entryPoints: {
    app: "src/browser/app.ts",
    "browser-tools": "src/browser/browserTools.ts",
  },
  outdir: "public",
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  treeShaking: true,
  minify: false,
  sourcemap: false,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    global: "globalThis",
  },
  plugins: [{
    name: "astral-browser-runtime",
    setup(context) {
      context.onResolve({ filter: /(?:^|\/)vendor\/load\.js$/ }, () => ({ path: aliases["vendor/load.js"] }));
      context.onResolve({ filter: /(?:^|\/)place\/csc\.js$/ }, () => ({ path: aliases["place/csc.js"] }));
      // astral-packager shares one source graph between its Node CLI and browser
      // API. The guarded Node compression branch is unreachable in browsers,
      // but esbuild still needs its built-in import left external.
      context.onResolve({ filter: /^node:zlib$/u }, () => ({ path: "node:zlib", external: true }));
    },
  }],
  logLevel: "info",
});

await applyPageDefaults();
await writeFile("public/.nojekyll", "", "utf8");

const privateIpv4 = /(?:^|[^0-9])(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?:[^0-9]|$)/u;
const plaintextCredentialWrite = /localStorage\.setItem\(\s*["']astral\.(?:openai-key|signing-key)["']/u;
const files = await matchingFiles(publicDir, new Set([".html", ".css", ".js"]));
for (const file of files) {
  const content = await readFile(file, "utf8");
  const findings = [];

  if (/\/home\/[A-Za-z0-9._-]+/u.test(content)) findings.push("local home path");
  if (privateIpv4.test(content)) findings.push("private network address");
  if (/(?:OPENAI_API_KEY|SIGNATURE_KEY)\s*=/u.test(content)) findings.push("literal credential assignment");
  if (plaintextCredentialWrite.test(content)) findings.push("plaintext credential persistence");
  if (/id=["']cityQuery["'][^>]*\svalue=/u.test(content)) findings.push("prefilled city");

  if (findings.length > 0) {
    throw new Error(`Public Pages asset failed privacy audit (${findings.join(", ")}): ${file}`);
  }
}
