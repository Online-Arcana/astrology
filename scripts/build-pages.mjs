import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { build } from "esbuild";

const publicDir = resolve("public");
const placeSource = resolve("vendor/places/packages/countries/dist/data");
const placeOutput = resolve(publicDir, "places/data");
const keyExportPath = resolve(publicDir, "key-export.js");
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

const htmlFiles = async (directory) => {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) {
      files.push(...await htmlFiles(path));
      continue;
    }
    if (item.isFile() && item.name.toLowerCase().endsWith(".html")) files.push(path);
  }
  return files;
};

const keyExportTag = (file) => {
  const path = relative(dirname(file), keyExportPath).replaceAll("\\", "/");
  const source = path.startsWith(".") ? path : `./${path}`;
  return `<script type="module" src="${source}"></script>`;
};

const applyPageDefaults = async () => {
  const viewportPattern = /<meta\s+name=["']viewport["'][^>]*>/iu;
  const headPattern = /<head(?:\s[^>]*)?>/iu;
  const bodyPattern = /<\/body\s*>/iu;
  for (const file of await htmlFiles(publicDir)) {
    const content = await readFile(file, "utf8");
    let updated = viewportPattern.test(content)
      ? content.replace(viewportPattern, viewport)
      : content.replace(headPattern, (head) => `${head}\n  ${viewport}`);
    if (!updated.includes("key-export.js")) {
      if (!bodyPattern.test(updated)) throw new Error(`Public HTML page has no closing body tag: ${file}`);
      updated = updated.replace(bodyPattern, `  ${keyExportTag(file)}\n</body>`);
    }
    if (updated === content) continue;
    await writeFile(file, updated, "utf8");
  }
};

await mkdir(publicDir, { recursive: true });
await rm(resolve(publicDir, "places"), { recursive: true, force: true });
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
  entryPoints: ["src/browser/app.ts"],
  outfile: "public/app.js",
  bundle: true,
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
    },
  }],
  logLevel: "info",
});

await applyPageDefaults();
await writeFile("public/.nojekyll", "", "utf8");

const privateIpv4 = /(?:^|[^0-9])(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?:[^0-9]|$)/u;
const files = [...await htmlFiles(publicDir), "public/style.css", "public/app.js", "public/key-export.js"];
for (const file of files) {
  const content = await readFile(file, "utf8");
  const findings = [];

  if (/\/home\/[A-Za-z0-9._-]+/u.test(content)) {
    findings.push("local home path");
  }
  if (privateIpv4.test(content)) {
    findings.push("private network address");
  }
  if (/(?:OPENAI_API_KEY|SIGNATURE_KEY)\s*=/u.test(content)) {
    findings.push("literal credential assignment");
  }
  if (/id=["']cityQuery["'][^>]*\svalue=/u.test(content)) {
    findings.push("prefilled city");
  }

  if (findings.length > 0) {
    throw new Error(`Public Pages asset failed privacy audit (${findings.join(", ")}): ${file}`);
  }
}
