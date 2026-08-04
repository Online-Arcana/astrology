import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [modules, pkg, flow, entry, build, page] = await Promise.all([
  readFile(".gitmodules", "utf8"),
  readFile("package.json", "utf8"),
  readFile("src/browser/packageFlow.ts", "utf8"),
  readFile("src/browser/browserTools.ts", "utf8"),
  readFile("scripts/build-pages.mjs", "utf8"),
  readFile("public/index.html", "utf8"),
]);

const checks: readonly [boolean, string][] = [
  [/\[submodule "vendor\/astral-packager"\][\s\S]*path = vendor\/astral-packager[\s\S]*kitty-crow\/astral-packager\.git/u.test(modules), "astral-packager must be declared as a submodule"],
  [/"astral-packager": "file:vendor\/astral-packager"/u.test(pkg), "astral-packager must be a package dependency"],
  [/vendor:packager/u.test(pkg) && /vendor:build[^\n]*vendor:packager/u.test(pkg), "vendor build must compile the packager before installation"],
  [/open as openPackage/u.test(flow) && /\bpack\b/u.test(flow) && /auditPwd/u.test(flow), "browser flow must use the packager's shared core API"],
  [/openPackage\(bytes, password\)/u.test(flow), "opening must use the packager decrypt/decompress/protobuf reconstruction path"],
  [/result\.id\.drop\(\)/u.test(flow), "opened package identity material must be explicitly dropped"],
  [/event\.stopImmediatePropagation\(\)/u.test(flow), "packaged files must be unpacked before the ordinary JSON file handler runs"],
  [/packageCompletedChart/u.test(flow) && /button\.click\(\)/u.test(flow), "newly completed charts must enter packaging automatically"],
  [/HTMLAnchorElement\.prototype\.click/u.test(flow) && /packageBlob/u.test(flow), "all final .astral downloads must pass through packaging"],
  [!/localStorage|sessionStorage|indexedDB|caches\./u.test(flow), "package passwords must never be persisted by the application"],
  [/password\.value = ""/u.test(flow) && /confirm\.value = ""/u.test(flow), "password fields must be cleared after use"],
  [/node:zlib/u.test(build) && /external: true/u.test(build), "browser bundle must leave the unreachable Node compression import external"],
  [/import\("\.\/packageFlow\.js"\)/u.test(entry), "browser tools must initialise packaged file handling"],
  [/id="astralFile"/u.test(page), "the browser page must retain the single .astral file input"],
];

let passed = 0;
for (const [condition, message] of checks) {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}
console.log(`1..${passed}`);
