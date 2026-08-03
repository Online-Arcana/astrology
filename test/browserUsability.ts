import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const page = await readFile("public/index.html", "utf8");
const controls = await readFile("public/key-export.js", "utf8");
const safeguards = await readFile("public/usability.css", "utf8");
const chartView = await readFile("public/chart-view.js", "utf8");
const chartStyles = await readFile("public/chart-view.css", "utf8");
const build = await readFile("scripts/build-pages.mjs", "utf8");

const checks: readonly [condition: boolean, message: string][] = [
  [/astral\.chart-form/u.test(controls), "chart form values must be saved in localStorage"],
  [/document\.addEventListener\("submit"/u.test(controls), "generation submit must save current credentials and form data"],
  [/astral\.openai-key/u.test(controls), "OpenAI key must be saved when generation starts"],
  [/timeInput\.step = "60"/u.test(controls), "browser birth time must use minute precision"],
  [/showSigningKeyBundle/u.test(controls) && /password-toggle/u.test(controls), "signing bundle visibility must use an in-field eye control"],
  [!/action\("showSigningKeyBundle"/u.test(controls), "signing bundle visibility must not be a separate action button"],
  [/class="credentials"/u.test(page), "browser credentials must use a dedicated responsive container"],
  [/class="credential credential-openai"/u.test(page), "OpenAI credentials must have their own flex group"],
  [/class="credential credential-signing"/u.test(page), "signing credentials must have their own flex group"],
  [/\.credentials\s*\{[\s\S]*?display:\s*flex/u.test(safeguards), "desktop credentials must use flex layout"],
  [/\.credential-primary\s*\{[\s\S]*?display:\s*flex/u.test(safeguards), "credential fields and actions must use flex rows"],
  [/align-items:\s*flex-start/u.test(safeguards), "credential groups must not stretch shorter fields to the tallest group"],
  [/min-width:\s*0/u.test(safeguards), "responsive controls must be allowed to shrink inside their containers"],
  [/max-width:\s*100%/u.test(safeguards), "responsive controls must never exceed their containers"],
  [/overflow-x:\s*hidden/u.test(safeguards), "page-level horizontal overflow must be blocked"],
  [/technicalDetails/u.test(chartView) && /document\.createElement\("details"\)/u.test(chartView), "technical chart positions must be collapsed with native details controls"],
  [/host\.append\(\.\.\.collapsed\)/u.test(chartView), "technical positions must be moved below interpreted chart sections"],
  [/generationPercent/u.test(chartView) && /generationEta/u.test(chartView), "progress must show both percentage and estimated time remaining"],
  [/activeRecoveryKey/u.test(chartView) && /astral-browser/u.test(chartView), "active jobs must show their recovery key from browser recovery storage"],
  [/\.generation-status-meta/u.test(chartStyles) && /\.technical-group/u.test(chartStyles), "chart view enhancements must have responsive styling"],
  [/usability\.css/u.test(build), "Pages build must inject responsive safeguards into every HTML page"],
  [/chart-view\.css/u.test(build) && /chart-view\.js/u.test(build), "Pages build must inject chart view and progress enhancements"],
];

console.log(`1..${checks.length}`);
checks.forEach(([condition, message], index) => {
  assert(condition, message);
  console.log(`ok ${index + 1} - ${message}`);
});
