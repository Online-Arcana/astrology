import { readFile } from "node:fs/promises";
import { correctionSummary, unitLabel } from "../src/browser/labels.js";
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
      date: "1991-01-01",
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

await test("public frontend contains no local identity or embedded secret", async () => {
  const files = await Promise.all([
    readFile("public/index.html", "utf8"),
    readFile("public/style.css", "utf8"),
    readFile("src/browser/app.ts", "utf8"),
    readFile("src/browser/runtime.ts", "utf8"),
  ]);
  const text = files.join("\n");
  assert(!/Peterhead|\/home\/kitty|192\.168\.|kitty@|SIGNATURE_KEY\s*=|OPENAI_API_KEY\s*=/u.test(text), "public source must not contain local identity or credential values");
  assert(!/id="signOpened"|>Sign opened/u.test(text), "opened files must never expose a signing action");
  assert(/localStorage/u.test(text), "client keys must be stored locally");
  assert(/IndexedDB|indexedDB/u.test(text), "chart recovery must use browser database storage");
});

console.log(`1..${passed}`);
