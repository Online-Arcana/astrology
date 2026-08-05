import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [policy, auditUi, auditCore, progress, availability, paint, resume, entry] = await Promise.all([
  readFile("src/browser/maintenancePolicy.ts", "utf8"),
  readFile("src/browser/maintenanceAuditUi.ts", "utf8"),
  readFile("src/browser/maintenanceAudit.ts", "utf8"),
  readFile("src/browser/maintenanceProgress.ts", "utf8"),
  readFile("src/browser/maintenanceAvailability.ts", "utf8"),
  readFile("src/browser/maintenancePaint.ts", "utf8"),
  readFile("src/browser/maintenanceResume.ts", "utf8"),
  readFile("src/browser/browserTools.ts", "utf8"),
]);

const progressImport = entry.indexOf('import("./maintenanceProgress.js")');
const availabilityImport = entry.indexOf('import("./maintenanceAvailability.js")');
const paintImport = entry.indexOf('import("./maintenancePaint.js")');
const resumeImport = entry.indexOf('import("./maintenanceResume.js")');

const checks: readonly [boolean, string][] = [
  [/complete\.checked = false/u.test(policy), "maintenance regeneration must default to off"],
  [/event\.stopImmediatePropagation\(\)/u.test(policy), "sign-only clicks must not fall through to the regeneration handler"],
  [/assembleAstralFile/u.test(policy) && /No calculations or interpretations were regenerated/u.test(policy), "sign-only maintenance must reassemble and download without regeneration"],
  [!/BrowserRuntime|openAiKey/u.test(policy), "sign-only maintenance must not load the API generation runtime"],
  [!/selectRecommendedRegeneration/u.test(auditUi), "the maintenance audit must remain advisory"],
  [/maintenancePolicy\.js/u.test(entry), "the browser tools entry must load the explicit maintenance policy"],
  [!/localStorage/u.test(policy), "sign-only maintenance must use only the in-memory credential session"],
  [/auditOpenedInterpretations/u.test(resume) && /invalidUnitIds/u.test(resume), "recalculation must derive the exact missing or invalid units from the maintenance audit"],
  [/auditCache/u.test(auditCore) && /file\.crc\.sha256/u.test(auditCore) && /cachedAudit\(key\)/u.test(auditCore), "recalculation must reuse the audit already completed for the exact chart content"],
  [/maximumCachedAudits/u.test(auditCore) && /auditCache\.delete\(oldest\)/u.test(auditCore), "maintenance audit reuse must remain bounded"],
  [/dependentInvalidUnits/u.test(auditCore) && /invalid\.add\(synthesisId\)/u.test(auditCore), "an invalid upstream interpretation must also invalidate its system synthesis"],
  [/invalid\.add\("final-synthesis"\)/u.test(auditCore), "a rebuilt system field or synthesis must invalidate the final synthesis"],
  [/ChartGenerationCheckpoint/u.test(resume) && /units\[unit\.id\] = phaseResult/u.test(resume), "valid existing interpretations must become accepted recovery units"],
  [/this\.resume\(selected\.checkpoint/u.test(resume), "maintenance recalculation must resume only unfinished units through the normal runtime"],
  [/\.tab\[data-panel="createPanel"\]/u.test(resume) && /#chartForm/u.test(resume), "recalculation must return to the main Create chart screen"],
  [/form\.requestSubmit\(submitter\)/u.test(resume) && /form\.reportValidity\(\)/u.test(resume), "maintenance must use the original validated chart-form submission path"],
  [/guardQueuedSubmission/u.test(resume) && /#errorCard/u.test(resume) && /60_000/u.test(resume), "a failed pre-runtime hand-off must not leak into a later generation"],
  [/#progressCard/u.test(resume) && /scrollIntoView/u.test(resume), "the normal progress, stage, lane, ETA and billing interface must be brought into view"],
  [/requestAnimationFrame\(\(\) => requestAnimationFrame/u.test(paint), "maintenance must yield enough time for the browser to paint before recalculation begins"],
  [/maintenancePreparation/u.test(paint) && /Preparing the audited chart for recalculation/u.test(paint), "the original progress card must report maintenance preparation instead of appearing frozen"],
  [/preparationFailed/u.test(paint) && /openPanel/u.test(paint), "a failed preparation must return to the maintenance error instead of leaving a false progress state"],
  [/remainingAtStart/u.test(progress) && /total - \(selected\.remainingAtStart/u.test(progress), "maintenance ETA must start from accepted recovered work rather than zero"],
  [/seenProgress/u.test(progress) && /#errorCard/u.test(progress), "maintenance ETA state must clear after failure or an abandoned run"],
  [/#generateButton/u.test(availability) && /\.disabled !== true/u.test(availability), "maintenance recalculation must detect whether another generation is already active"],
  [/event\.stopImmediatePropagation\(\)/u.test(availability) && /Finish or stop the current chart generation/u.test(availability), "overlapping maintenance generation must be blocked before a checkpoint is queued"],
  [progressImport >= 0 && availabilityImport > progressImport && paintImport > availabilityImport && resumeImport > paintImport, "ETA, overlap and paint guards must initialise before the maintenance resume handler"],
  [/import\("\.\/maintenanceResume\.js"\)/u.test(entry), "browser tools must initialise full-interface maintenance resume before the reduced policy handler"],
];

console.log(`1..${checks.length}`);
checks.forEach(([condition, message], index) => {
  assert(condition, message);
  console.log(`ok ${index + 1} - ${message}`);
});
