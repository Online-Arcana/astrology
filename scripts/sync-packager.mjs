import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("vendor/astral-packager/dist");
const runtime = resolve("dist/packager-runtime");
await rm(runtime, { recursive: true, force: true });
await mkdir(runtime, { recursive: true });
await cp(source, runtime, { recursive: true });
await writeFile(resolve("dist/packager.js"), 'export * from "./packager-runtime/index.js";\n', "utf8");
await writeFile(resolve("dist/packager.d.ts"), await readFile(resolve(source, "index.d.ts"), "utf8"), "utf8");
