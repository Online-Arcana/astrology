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
  const wheel = await readFile("vendor/astral-chart-wheel/src/chartWheel.ts", "utf8");
  const wheelGlyphs = await readFile("vendor/astral-chart-wheel/src/chartWheelGlyphs.ts", "utf8");
  const wheelStyles = await readFile("public/chart-wheel.css", "utf8");
  assert(/chartWheelBootstrap\.js/u.test(tools), "browser-tools entry must import the chart wheel bootstrap so esbuild includes it");
  assert(/astral:calculation/u.test(bootstrap), "chart wheel bootstrap must listen for new deterministic calculations");
  assert(/#rawChart/u.test(bootstrap), "chart wheel bootstrap must reconstruct opened charts from their stored calculation");
  assert(/wheelView/u.test(bootstrap) && /wheelChart/u.test(bootstrap) && /Chart wheel/u.test(bootstrap), "opened charts must expose the wheel as its own viewer tab");
  assert(/wheel-aspect-groups/u.test(bootstrap) && /wheel-aspect-child/u.test(bootstrap), "aspect controls must expose expandable groups and individual deterministic lines");
  assert(/parent\.indeterminate/u.test(bootstrap), "aspect group checkboxes must represent mixed child state");
  assert(/defaultAspectVisible/u.test(bootstrap) && /defaultAspectPoints/u.test(bootstrap) && /corePlanets/u.test(bootstrap), "default view must preserve a conventional major-aspect presentation without deleting the rest");
  assert(/"ascendant"/u.test(bootstrap) && /"midheaven"/u.test(bootstrap) && /"north_node_true"/u.test(bootstrap), "default aspect presentation must include the main angles and True North Node with the planets");
  assert(/Restore default aspect lines/u.test(bootstrap) && /Hide all aspect lines/u.test(bootstrap) && /Show all aspect lines/u.test(bootstrap), "chart wheel must provide default, none and all aspect actions");
  assert(/pointAnchors/u.test(wheel) && /aspectSegment/u.test(wheel) && /endpointA/u.test(wheel), "aspect lines must be drawn from the rendered point anchors rather than an unrelated inner radius");
  assert(/extendSegment/u.test(wheel) && /wheel-aspect-conjunction-marker/u.test(wheelStyles), "conjunctions must remain visible while staying aligned to their actual endpoints");
  assert(/document\.body\.append\(tooltip\)/u.test(bootstrap) && /position:\s*fixed/u.test(wheelStyles), "chart tooltips must use viewport coordinates so they stay beside the pointer");
  assert(/grid-template-areas:\s*"graphic controls"/u.test(wheelStyles) && /position:\s*sticky/u.test(wheelStyles) && /overscroll-behavior:\s*contain/u.test(wheelStyles), "aspect controls must sit beside the chart and scroll independently on wide screens");
  assert(wheelStyles.includes(".chart-wheel-tab-host") && /container-type:\s*inline-size/u.test(wheelStyles), "dedicated wheel tab must establish the container used by responsive wheel queries");
  assert(/@container \(max-width: 56rem\)[\s\S]*grid-template-areas:[\s\S]*"graphic"[\s\S]*"controls"/u.test(wheelStyles), "narrow wheel layout must stack the chart and independently scrollable controls instead of overflowing sideways");
  assert(/100dvh/u.test(wheelStyles) && /overflow-x:\s*clip/u.test(wheelStyles), "wheel sizing must respect narrow and short viewports without leaking horizontal overflow");
  assert(/-webkit-appearance:\s*none/u.test(wheelStyles) && /appearance:\s*none/u.test(wheelStyles) && /wheel-aspect-group-checkbox:indeterminate/u.test(wheelStyles), "aspect checkboxes must reset global input styling and render checked, unchecked and mixed states consistently");
  assert(/addGlyphColourFilter/u.test(wheel) && /feColorMatrix/u.test(wheel), "wheel SVG assets must be recoloured inside SVG instead of depending on a CSS filter applied to an external SVG document");
  assert(wheel.includes('image.setAttribute("filter", `url(#${glyphFilterId})`);'), "every rendered canonical glyph image must use the wheel-local SVG colour filter");
  assert(!/filter:\s*invert\(/u.test(wheelStyles), "wheel glyph colour must not rely on CSS invert, which is inconsistent for external SVG images");
  assert(!/wheel-detail/u.test(wheel), "renderer must not create a permanent chart detail panel");
  assert(/part_of_spirit/u.test(wheelGlyphs) && /lot_of_spirit\.svg/u.test(wheelGlyphs), "Part of Spirit must use its dedicated SVG glyph");
  assert(/fallback\.textContent = "Φ"/u.test(wheelGlyphs), "Part of Spirit fallback must remain visually distinct from the Sun");
  assert(wheelGlyphs.includes('north_node_true: { path: `${glyphBase}/true_node.svg`, modifier: "N"'), "True North Node must use the True Node glyph with N");
  assert(wheelGlyphs.includes('south_node_true: { path: `${glyphBase}/true_node.svg`, modifier: "S"'), "True South Node must use the True Node glyph with S");
  assert(wheelGlyphs.includes('north_node_mean: { path: `${glyphBase}/mean_node.svg`, modifier: "N"'), "Mean North Node must use the Mean Node glyph with N");
  assert(wheelGlyphs.includes('south_node_mean: { path: `${glyphBase}/mean_node.svg`, modifier: "S"'), "Mean South Node must use the Mean Node glyph with S");
  assert(!/rotation:\s*180/u.test(wheelGlyphs), "North and South node direction must not be encoded by rotating the Mean/True glyph");
});

await test("random canonical chart tester remains deterministic and test-only", async () => {
  const tester = await readFile("src/browser/randomChartTest.ts", "utf8");
  const policy = await readFile("src/browser/testKeyPolicyUi.ts", "utf8");
  assert(/TEST: Random canonical chart \(no LLM\)/u.test(tester), "test chart button must identify itself and the no-LLM path clearly");
  assert(/CalculationService/u.test(tester) && /assembleAstralFile/u.test(tester), "test chart must use canonical calculation and file assembly");
  assert(/Lorem ipsum/u.test(tester) && /calls:\s*0/u.test(tester), "test chart interpretations must be Lorem Ipsum with zero LLM calls");
  assert(/generateTestSigningKey/u.test(tester) && /testArtifactMarker/u.test(tester), "test chart must create an explicit signed test artifact when no real key is available");
  assert(/canonicaliseSign/u.test(policy) && /sign\.disabled = testOnly/u.test(policy), "test signing bundle must disable ordinary re-sign UI");
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
