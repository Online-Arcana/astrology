import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [modules, pkg, flow, authority, entry, build, page] = await Promise.all([
  readFile(".gitmodules", "utf8"),
  readFile("package.json", "utf8"),
  readFile("src/browser/packageFlow.ts", "utf8"),
  readFile("src/browser/authorityUi.ts", "utf8"),
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
  [/automaticGenerationPackage/u.test(flow) && /button\.click\(\)/u.test(flow), "newly completed charts must enter packaging automatically"],
  [/HTMLAnchorElement\.prototype\.click/u.test(flow) && /packageBlob/u.test(flow), "all final .astral downloads must pass through packaging"],
  [!/observe\(document\.body/u.test(flow), "packaging must not install a page-wide mutation observer"],
  [/attributeFilter: \["class"\]/u.test(flow), "automatic packaging may observe only the completion card class"],
  [!/localStorage|sessionStorage|indexedDB|caches\./u.test(flow), "package passwords must never be persisted by the application"],
  [/password\.value = ""/u.test(flow) && /confirm\.value = ""/u.test(flow), "password fields must be cleared after use"],
  [/setConfirmVisible\(ui, mode === "pack"\)/u.test(flow) && /confirmLabel\.style\.display/u.test(flow), "opening must hide and disable the creation-only confirmation field"],
  [/revealMarkup/u.test(flow) && /setReveal/u.test(flow) && /setConfirmVisible\(ui, !shown\)/u.test(flow), "creation passwords must have reveal SVGs and remove confirmation while revealed"],
  [/showAudit/u.test(flow) && /Password strength/u.test(flow) && /Passwords match\./u.test(flow), "creation must show live password scoring and match feedback"],
  [/liveSigningKey/u.test(authority) && /#signingKey/u.test(authority) && /loadSigningKey/u.test(authority), "authority comparison must use the live signing bundle"],
  [/does not identify which tool created it/u.test(authority) && /No signing key is currently loaded/u.test(authority), "verified signatures must not be labelled as created elsewhere without evidence"],
  [/node:zlib/u.test(build) && /external: true/u.test(build), "browser bundle must leave the unreachable Node compression import external"],
  [/import\("\.\/packageFlow\.js"\)/u.test(entry) && /import\("\.\/authorityUi\.js"\)/u.test(entry), "browser tools must initialise packaged file and authority handling"],
  [/id="astralFile"/u.test(page), "the browser page must retain the single .astral file input"],
];

let passed = 0;
for (const [condition, message] of checks) {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}
console.log(`1..${passed}`);
