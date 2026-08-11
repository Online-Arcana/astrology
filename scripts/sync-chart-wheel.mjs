import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const sharedRoot = resolve("vendor/astral-chart-wheel");
const publicRoot = resolve("public");
const publicAssets = resolve(publicRoot, "assets");
const glyphTarget = resolve(publicAssets, "astrology-glyphs");

await mkdir(publicAssets, { recursive: true });
await rm(glyphTarget, { recursive: true, force: true });
await cp(resolve(sharedRoot, "assets/astrology-glyphs"), glyphTarget, { recursive: true });
await cp(resolve(sharedRoot, "styles/chart-wheel.css"), resolve(publicRoot, "chart-wheel.css"));
