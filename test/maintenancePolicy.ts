import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [policy, audit, resume, entry] = await Promise.all([
  readFile("src/browser/maintenancePolicy.ts", "utf8"),
  readFile("src/browser/maintenanceAuditUi.ts", "utf8"),
  readFile("src/browser/maintenanceResume.ts", "utf8"),
  readFile("src/browser/browserTools.ts", "utf8"),
]);

const checks: readonly [boolean, string][] = [
  [/complete\.checked = false/u.test(policy), "maintenance regeneration must default to off"],
  [/event\.stopImmediatePropagation\(\)/u.test(policy), "sign-only clicks must not fall through to the regeneration handler"],
  [/assembleAstralFile/u.test(policy) && /No calculations or interpretations were regenerated/u.test(policy), "sign-only maintenance must reassemble and download without regeneration"],
  [!/BrowserRuntime|openAiKey/u.test(policy), "sign-only maintenance must not load the API generation runtime"],
  [!/selectRecommendedRegeneration/u.test(audit), "the maintenance audit must remain advisory"],
  [/maintenancePolicy\.js/u.test(entry), "the browser tools entry must load the explicit maintenance policy"],
  [!/localStorage/u.test(policy), "sign-only maintenance must use only the in-memory credential session"],
  [/auditOpenedInterpretations/u.test(resume) && /invalidUnitIds/u.test(resume), "recalculation must derive the exact missing or invalid units from the maintenance audit"],
  [/ChartGenerationCheckpoint/u.test(resume) && /units\[unit\.id\] = phaseResult/u.test(resume), "valid existing interpretations must become accepted recovery units"],
  [/this\.resume\(selected\.checkpoint/u.test(resume), "maintenance recalculation must resume only unfinished units through the normal runtime"],
  [/\.tab\[data-panel="createPanel"\]/u.test(resume) && /#chartForm/u.test(resume), "recalculation must return to and submit the main Create chart screen"],
  [/#progressCard/u.test(resume) && /scrollIntoView/u.test(resume), "the normal progress, stage, lane, ETA and billing interface must be brought into view"],
  [/import\("\.\/maintenanceResume\.js"\)/u.test(entry), "browser tools must initialise full-interface maintenance resume before the reduced policy handler"],
];

console.log(`1..${checks.length}`);
checks.forEach(([condition, message], index) => {
  assert(condition, message);
  console.log(`ok ${index + 1} - ${message}`);
});
