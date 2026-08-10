import { readFile } from "node:fs/promises";
import { correctionSummary, unitLabel } from "../src/browser/labels.js";
import { browserStaticRoot } from "../src/browser/places.js";
import { preferredGenderOf } from "../src/types/base.js";
import { parseCalculationRequest } from "../src/interface/request.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

await test("compatibility lanes have distinct customer labels", () => {
  equal(unitLabel("tropical.compatibility.romantic.capricorn"), "Romantic compatibility with Capricorn", "Capricorn label");
  equal(unitLabel("tropical.compatibility.romantic.aquarius"), "Romantic compatibility with Aquarius", "Aquarius label");
  equal(unitLabel("tropical.compatibility.romantic.pisces"), "Romantic compatibility with Pisces", "Pisces label");
  equal(unitLabel("tropical.compatibility.sexual.cancer"), "Intimacy compatibility with Cancer", "Cancer intimacy label");
});

await test("audit repair wording does not claim incomplete output", () => {
  equal(
    correctionSummary(4),
    "4 interpretations are being corrected by the small model. Accepted work remains safe.",
    "repair summary",
  );
});

await test("preferred gender is optional and legacy metadata defaults to male", () => {
  equal(preferredGenderOf({}), "male", "legacy default");
  equal(preferredGenderOf({ preferredGender: "female" }), "female", "female preference");
  equal(preferredGenderOf({ preferredGender: "non-binary" }), "non-binary", "non-binary preference");
  const request = parseCalculationRequest({
    birth: {
      date: "2000-01-01",
      time: "12:00:00",
      timeAccuracy: "exact",
      placeId: "fixture:place",
      preferredGender: "non-binary",
    },
  }, {
    primaryZodiac: "tropical",
    interpretationMode: "tropical",
    ayanamsha: "lahiri",
  });
  equal(request.birth.preferredGender, "non-binary", "parsed preference");
});

await test("split browser chunks resolve static place assets from the Pages root", () => {
  equal(
    browserStaticRoot("https://kitty-crow.github.io/astrology/chunks/chunk-ABC.js").href,
    "https://kitty-crow.github.io/astrology/",
    "split chunk asset root",
  );
  equal(
    browserStaticRoot("https://kitty-crow.github.io/astrology/app.js").href,
    "https://kitty-crow.github.io/astrology/",
    "direct entry asset root",
  );
});

await test("public frontend contains no local identity or embedded secret", async () => {
  const files = await Promise.all([
    readFile("public/index.html", "utf8"),
    readFile("public/style.css", "utf8"),
    readFile("scripts/build-pages.mjs", "utf8"),
    readFile("src/browser/app.ts", "utf8"),
    readFile("src/browser/runtime.ts", "utf8"),
    readFile("src/browser/keys.ts", "utf8"),
    readFile("src/browser/vault.ts", "utf8"),
    readFile("src/browser/store.ts", "utf8"),
  ]);
  const text = files.join("\n");
  assert(!/\/home\/[A-Za-z0-9._-]+|192\.168\.|(?:OPENAI_API_KEY|SIGNATURE_KEY)\s*=/u.test(text), "public source must not contain local paths, private-network addresses or credential values");
  assert(!/id="cityQuery"[^>]*\svalue=/u.test(text), "city search must not have a prefilled location");
  assert(!/localStorage\.(?:setItem|getItem)/u.test(await readFile("src/browser/keys.ts", "utf8")), "secret session module must not use plaintext localStorage");
  assert(/AES-GCM/u.test(text) && /indexedDB/u.test(text), "saved credentials must use encrypted IndexedDB storage");
  assert(/IndexedDB|indexedDB/u.test(text), "chart recovery must use browser database storage");
});

await test("generated signing keys can be backed up and restored", async () => {
  const controls = await readFile("src/browser/signingActions.ts", "utf8");
  const tools = await readFile("src/browser/testTools.ts", "utf8");
  const build = await readFile("scripts/build-pages.mjs", "utf8");
  assert(/copySigningKeyBundle/u.test(controls), "frontend must offer signing-key copy");
  assert(/downloadSigningKeyBundle/u.test(controls), "frontend must offer signing-key download");
  assert(/importSigningKeyBundle/u.test(controls), "frontend must offer signing-key import");
  assert(/browser-tools\.js/u.test(build), "Pages build must load secure browser controls");
  assert(/privatePkcs8/u.test(controls) && /publicRaw/u.test(controls), "backup must preserve the complete signing pair");
  assert(/signingIssuer/u.test(tools) && /signingPrivatePkcs8/u.test(tools) && /signingPublicRaw/u.test(tools), "bundle must be shown as separate fields");
});

await test("browser tools initialise the interactive chart wheel", async () => {
  const tools = await readFile("src/browser/browserTools.ts", "utf8");
  const bootstrap = await readFile("src/browser/chartWheelBootstrap.ts", "utf8");
  assert(/chartWheelBootstrap\.js/u.test(tools), "browser-tools entry must import the chart wheel bootstrap so esbuild includes it");
  assert(/astral:calculation/u.test(bootstrap), "chart wheel bootstrap must listen for new deterministic calculations");
  assert(/#rawChart/u.test(bootstrap), "chart wheel bootstrap must reconstruct opened charts from their stored calculation");
});

await test("opened files use an explicit copy-only maintenance path", async () => {
  const app = await readFile("src/browser/app.ts", "utf8");
  const tools = await readFile("src/browser/testTools.ts", "utf8");
  assert(!/\bsign\s*\(/u.test(app), "ordinary open and view path must not directly sign files");
  assert(/Creates a new copy/u.test(tools), "maintenance action must state that it creates a new copy");
  assert(/canonicaliseSign/u.test(tools), "maintenance action must offer explicit signing");
});

await test("current files may be signed without forced regeneration", async () => {
  const auditUi = await readFile("src/browser/maintenanceAuditUi.ts", "utf8");
  const marker = 'element<HTMLButtonElement>("#canonicaliseRun")?.addEventListener("click"';
  const start = auditUi.indexOf(marker);
  assert(start >= 0, "maintenance run handler must exist");
  const runHandler = auditUi.slice(start);
  assert(!runHandler.includes("selectRecommendedRegeneration();"), "run action must not re-enable regeneration after the user unticks it");
  assert(/Signing the current chart without recalculating or reinterpreting it/u.test(auditUi), "sign-only action must report that calculations and interpretations are preserved");
  assert(/do not pass the current maintenance audit/u.test(auditUi), "audit warning must not claim every rejected unit is missing");
});

console.log(`1..${passed}`);
