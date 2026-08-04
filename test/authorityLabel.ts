import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [label, entry] = await Promise.all([
  readFile("src/browser/authorityLabel.ts", "utf8"),
  readFile("src/browser/browserTools.ts", "utf8"),
]);

const checks: readonly [boolean, string][] = [
  [/loadSigningKey\(\)/u.test(label), "authority recognition must read the current shared signing key"],
  [/validateAstralFile\(value\)/u.test(label), "authority recognition must validate the opened file before relabelling it"],
  [/validation\.authority !== "trusted"[\s\S]*validation\.authority !== "valid_untrusted"/u.test(label), "only valid authority states may be recognised"],
  [/value\.authority\.keyId !== currentKeyId/u.test(label), "authority recognition must compare the exact Ed25519 key ID"],
  [/Made by this browser key/u.test(label) && /badge good/u.test(label), "matching files must receive the local-authority badge"],
  [/import\("\.\/authorityLabel\.js"\)/u.test(entry), "browser tools must initialise current-key authority recognition"],
];

let passed = 0;
for (const [condition, message] of checks) {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}
console.log(`1..${passed}`);
