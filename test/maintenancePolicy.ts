import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = await readFile("src/browser/maintenancePolicy.ts", "utf8");
const audit = await readFile("src/browser/maintenanceAuditUi.ts", "utf8");
const entry = await readFile("src/browser/browserTools.ts", "utf8");

const checks: readonly [boolean, string][] = [
  [/complete\.checked = false/u.test(policy), "maintenance regeneration must default to off"],
  [/event\.stopImmediatePropagation\(\)/u.test(policy), "sign-only clicks must not fall through to the regeneration handler"],
  [/assembleAstralFile/u.test(policy) && /No calculations or interpretations were regenerated/u.test(policy), "sign-only maintenance must reassemble and download without regeneration"],
  [!/BrowserRuntime|openAiKey/u.test(policy), "sign-only maintenance must not load the API generation runtime"],
  [!/selectRecommendedRegeneration/u.test(audit), "the maintenance audit must remain advisory"],
  [/maintenancePolicy\.js/u.test(entry), "the browser tools entry must load the explicit maintenance policy"],
  [!/localStorage/u.test(policy), "sign-only maintenance must use only the in-memory credential session"],
];

console.log(`1..${checks.length}`);
checks.forEach(([condition, message], index) => {
  assert(condition, message);
  console.log(`ok ${index + 1} - ${message}`);
});
