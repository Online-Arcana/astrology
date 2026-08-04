import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const page = await readFile("public/index.html", "utf8");
const formPersistence = await readFile("src/browser/formPersistence.ts", "utf8");
const signingActions = await readFile("src/browser/signingActions.ts", "utf8");
const legacyGuard = await readFile("src/browser/legacyGuard.ts", "utf8");
const vaultLifecycle = await readFile("src/browser/vaultLifecycle.ts", "utf8");
const safeguards = await readFile("public/usability.css", "utf8");
const chartView = await readFile("public/chart-view.js", "utf8");
const chartStyles = await readFile("public/chart-view.css", "utf8");
const toolStyles = await readFile("public/test-tools.css", "utf8");
const browserTools = await readFile("src/browser/testTools.ts", "utf8");
const credentialLabels = await readFile("src/browser/credentialLabels.ts", "utf8");
const synthesisCategory = await readFile("src/browser/synthesisCategory.ts", "utf8");
const vault = await readFile("src/browser/vault.ts", "utf8");
const vaultUi = await readFile("src/browser/vaultUi.ts", "utf8");
const keys = await readFile("src/browser/keys.ts", "utf8");
const build = await readFile("scripts/build-pages.mjs", "utf8");

const checks: readonly [condition: boolean, message: string][] = [
  [/astral\.chart-form/u.test(formPersistence), "non-secret chart form values remain saved in localStorage"],
  [!/openai-key|signing-key/u.test(formPersistence), "form persistence must not include credentials"],
  [!/localStorage\.(?:setItem|getItem)/u.test(keys), "credential module must not persist API or signing keys in plaintext localStorage"],
  [/originalRemoveItem\.call\(localStorage/u.test(legacyGuard), "legacy plaintext credentials must be removed immediately after capture"],
  [/Storage\.prototype\.setItem/u.test(legacyGuard) && /protectedKeys/u.test(legacyGuard), "legacy credential writes must be blocked"],
  [/indexedDB/u.test(vault) && /AES-GCM/u.test(vault), "credential vault must store AES-GCM ciphertext in IndexedDB"],
  [/extensions:\s*\{\s*prf/u.test(vault) && /userVerification:\s*"required"/u.test(vault), "credential vault must derive its encryption key through verified WebAuthn PRF"],
  [/#writes/u.test(vault) && /pending\.catch/u.test(vault), "encrypted credential updates must be serialised"],
  [/legacySnapshot/u.test(vaultUi) && /migrate/u.test(vaultUi), "vault UI must offer one-time migration of legacy plaintext credentials"],
  [/pagehide/u.test(vaultLifecycle) && /event\.persisted/u.test(vaultLifecycle), "navigation and browser cache restoration must clear decrypted credential memory"],
  [/timeInput\.step = "60"/u.test(formPersistence), "browser birth time must use minute precision"],
  [/signingIssuer/u.test(browserTools) && /signingPrivatePkcs8/u.test(browserTools) && /signingPublicRaw/u.test(browserTools), "signing bundle must be presented as three separate fields"],
  [/privatePkcs8/u.test(credentialLabels) && /publicRaw/u.test(credentialLabels), "visible signing labels must use canonical JSON field names"],
  [/showSigningKeyFields/u.test(browserTools) && /password-toggle/u.test(browserTools), "signing key fields must use an in-field reveal control"],
  [/copySigningKeyBundle/u.test(signingActions) && /downloadSigningKeyBundle/u.test(signingActions) && /importSigningKeyBundle/u.test(signingActions), "signing key must offer copy, download and import controls"],
  [/copyOpenAiKey/u.test(browserTools) && /downloadOpenAiKey/u.test(browserTools) && /importOpenAiKey/u.test(browserTools), "OpenAI key must offer copy, download and import controls"],
  [/canonicaliseCard/u.test(browserTools) && /Canonicalise or update this chart/u.test(browserTools), "browser test tool must offer chart canonicalisation and update"],
  [/preferredGender/u.test(browserTools) && /complete all missing or invalid fields/u.test(browserTools), "chart maintenance must support gender metadata and interpretation completion"],
  [/selectedSigningKey/u.test(browserTools) && /assembleAstralFile/u.test(browserTools), "chart maintenance must support signing a newly canonicalised copy"],
  [/formattedChartIndex/u.test(browserTools) && /chart-category/u.test(browserTools), "formatted charts must have a left index and collapsed categories"],
  [/chart-reading/u.test(browserTools) && /document\.createElement\("details"\)/u.test(browserTools), "every formatted reading must be individually collapsible"],
  [/Final synthesis/u.test(synthesisCategory) && /Integrated chart synthesis/u.test(synthesisCategory), "canonical synthesis titles must remain in the final synthesis category"],
  [/class="credentials"/u.test(page), "browser credentials must use a dedicated responsive container"],
  [/class="credential credential-openai"/u.test(page), "OpenAI credentials must have their own flex group"],
  [/class="credential credential-signing"/u.test(page), "signing credentials must have their own flex group"],
  [/\.credentials\s*\{[\s\S]*?display:\s*flex/u.test(safeguards), "desktop credentials must use flex layout"],
  [/\.credential-primary\s*\{[\s\S]*?display:\s*flex/u.test(safeguards), "credential fields and actions must use flex rows"],
  [/align-items:\s*flex-start/u.test(safeguards), "credential groups must not stretch shorter fields to the tallest group"],
  [/min-width:\s*0/u.test(safeguards) && /max-width:\s*100%/u.test(safeguards), "responsive controls must remain inside their containers"],
  [/overflow-x:\s*hidden/u.test(safeguards), "page-level horizontal overflow must be blocked"],
  [/technicalDetails/u.test(chartView) && /document\.createElement\("details"\)/u.test(chartView), "technical chart positions must be collapsed with native details controls"],
  [/host\.append\(\.\.\.collapsed\)/u.test(chartView), "technical positions must be moved below interpreted chart sections"],
  [/generationPercent/u.test(chartView) && /generationEta/u.test(chartView), "progress must show both percentage and estimated time remaining"],
  [/activeRecoveryKey/u.test(chartView) && /astral-browser/u.test(chartView), "active jobs must show their recovery key from browser recovery storage"],
  [/\.generation-status-meta/u.test(chartStyles) && /\.technical-group/u.test(chartStyles), "chart view enhancements must have responsive styling"],
  [/\.signing-key-fields/u.test(toolStyles) && /\.formatted-chart-index/u.test(toolStyles), "credential fields and chart index must have responsive styling"],
  [/test-tools\.css/u.test(build) && /browser-tools\.js/u.test(build), "Pages build must inject the secure maintenance tools into every HTML page"],
  [/splitting:\s*true/u.test(build) && /chunkNames/u.test(build), "Pages entry points must share one split ESM module graph"],
  [/plaintextCredentialWrite/u.test(build), "Pages build must reject plaintext credential persistence"],
  [/rm\(resolve\(publicDir, "key-export\.js"\)/u.test(build) && /staleKeyExportPattern/u.test(build), "removed plaintext credential helper must be deleted and stripped from stale HTML"],
  [!/\["key-export\.js",\s*keyExportPath\]/u.test(build), "removed plaintext credential helper must not be injected"],
  [/usability\.css/u.test(build), "Pages build must inject responsive safeguards into every HTML page"],
  [/chart-view\.css/u.test(build) && /chart-view\.js/u.test(build), "Pages build must inject chart view and progress enhancements"],
];

console.log(`1..${checks.length}`);
checks.forEach(([condition, message], index) => {
  assert(condition, message);
  console.log(`ok ${index + 1} - ${message}`);
});
