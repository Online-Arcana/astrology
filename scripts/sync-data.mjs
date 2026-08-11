import { access, cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const core = resolve("vendor/astral-core");
const source = resolve(core, "data/places");
const output = resolve("data/places");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args, cwd) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, { cwd, stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) resolveRun();
    else reject(new Error(`${command} ${args.join(" ")} failed (${signal ?? code})`));
  });
});

try {
  await access(source);
} catch {
  await run(npm, ["run", "vendor:places"], core);
  await run(process.execPath, ["scripts/data.mjs"], core);
}

await rm(output, { recursive: true, force: true });
await mkdir(resolve("data"), { recursive: true });
await cp(source, output, { recursive: true });
