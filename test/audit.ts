import { auditField, type FieldProfile } from "../src/llm/audit/field.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profile = (id: string): FieldProfile => ({
  id,
  lexicon: ["tropical", "overview", "astrology", "chart", "planet", "sign", "house", "aspect"],
  minLength: 2,
  maxLength: 4_000,
});

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

test("strength entries do not require a literal generic chart keyword", () => {
  const result = auditField(
    "A calm capacity to hold competing priorities together without losing direction or confidence.",
    profile("tropical.overview.strengths[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("tension entries do not require a literal generic chart keyword", () => {
  const result = auditField(
    "Impatience with slower processes can create avoidable friction when careful pacing would work better.",
    profile("tropical.overview.tensions[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("a tension may describe how a strength becomes difficult", () => {
  const result = auditField(
    "Confidence and initiative can become excessive, creating pressure to act before everyone else is ready.",
    profile("tropical.aspect.imum_coeli_sun_trine.tensions[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("a strength may describe constructive use of pressure", () => {
  const result = auditField(
    "Pressure and conflict can sharpen insight when discipline supports a calm and effective response.",
    profile("tropical.aspect.imum_coeli_sun_trine.strengths[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("an obvious tension placed in strengths is rejected", () => {
  const result = auditField(
    "Persistent conflict and instability create pressure that repeatedly undermines otherwise workable decisions.",
    profile("tropical.overview.strengths[2]"),
  );
  assert(!result.valid, "opposite-role strength entry must fail");
  assert(
    result.issues.some(({ code }) => code === "irrelevant"),
    "opposite-role strength entry must report semantic irrelevance",
  );
});

test("an obvious strength placed in tensions is rejected", () => {
  const result = auditField(
    "Reliable discipline and confidence provide a stable capacity for clear and effective action.",
    profile("tropical.overview.tensions[2]"),
  );
  assert(!result.valid, "opposite-role tension entry must fail");
  assert(
    result.issues.some(({ code }) => code === "irrelevant"),
    "opposite-role tension entry must report semantic irrelevance",
  );
});

test("process narration remains rejected", () => {
  const result = auditField(
    "I will analyse the supplied chart and explain the requested field.",
    profile("tropical.overview.strengths[3]"),
  );
  assert(!result.valid, "process narration must still fail");
});

console.log(`1..${passed}`);
