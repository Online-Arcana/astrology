import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("vendor/astral-core/data/places");
const output = resolve("data/places");

await rm(output, { recursive: true, force: true });
await mkdir(resolve("data"), { recursive: true });
await cp(source, output, { recursive: true });
