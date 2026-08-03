import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("public", { recursive: true });
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
