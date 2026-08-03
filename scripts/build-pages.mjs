import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const publicDir = resolve("public");
const placeSource = resolve("vendor/places/packages/countries/dist/data");
const placeOutput = resolve(publicDir, "places/data");

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

await writeFile("public/.nojekyll", "", "utf8");

const files = ["public/index.html", "public/style.css", "public/app.js"];
for (const file of files) {
  const content = await readFile(file, "utf8");
  if (/Peterhead|\/home\/kitty|192\.168\.|OPENAI_API_KEY\s*=|SIGNATURE_KEY\s*=/u.test(content)) {
    throw new Error(`Public Pages asset failed privacy audit: ${file}`);
  }
}
