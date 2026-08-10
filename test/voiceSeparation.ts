import { auditField } from "../src/llm/audit/field.js";
import { serialiseInterpretationPrompt } from "../src/interpretation/prompt/serialise.js";
import { interpretationVoiceProfile } from "../src/interpretation/voice/profile.js";
import type { JsonRef } from "../src/types/base.js";
import type { DecomposedInterpretationUnit } from "../src/interpretation/map/decompose.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const profile = {
  id: "fixture.summary",
  lexicon: ["independence", "change", "cooperation"],
};

test("user-facing interpretation has no first-person astrologer character", () => {
  const result = auditField("I see that you may need more independence when established routines become restrictive.", profile);
  equal(result.valid, false, "first person should fail");
  assert(result.issues.some(({ code }) => code === "interpreter_first_person"), "missing first-person voice issue");
});

test("private corpus/compiler vocabulary cannot leak into prose", () => {
  const result = auditField("Your corpus atom indicates that you may prefer more independence during periods of change.", profile);
  equal(result.valid, false, "corpus vocabulary should fail");
  assert(result.issues.some(({ code }) => code === "semantic_register_leakage"), "missing semantic-register issue");
});

test("corpus propositions are meaning input rather than prose templates", () => {
  const proposition = "Personal development is closely connected with independence and willingness to depart from established patterns.";
  const copied = auditField(
    "Personal development is closely connected with independence and willingness to depart from established patterns.",
    { ...profile, semanticPropositions: [proposition] },
  );
  equal(copied.valid, false, "close corpus copy should fail");
  assert(copied.issues.some(({ code }) => code === "semantic_register_leakage"), "missing copied-proposition issue");

  const rendered = auditField(
    "You may develop most when you give yourself permission to question routines that no longer fit, while choosing change for a clear reason rather than for novelty alone.",
    { ...profile, semanticPropositions: [proposition] },
  );
  equal(rendered.valid, true, "fresh rendering of the same permitted meaning should pass");
});

test("serialized prompt keeps semantic input and interpretive voice in separate fields", () => {
  const ref = "#/astral-calculation/system/aspects/0" as JsonRef;
  const decomposition: DecomposedInterpretationUnit = {
    unitId: "tropical.aspect.north_node_mean.uranus.conjunction",
    family: "aspect",
    zodiac: "tropical",
    chartMetadata: { zodiac: "tropical", ayanamsha: null },
    ingredients: [
      { kind: "point", atomId: "point.north-node", technicalId: "north_node_mean", metadata: { calculationVariant: "mean" } },
      { kind: "aspect", atomId: "aspect.conjunction", technicalId: "conjunction", metadata: {} },
      { kind: "body", atomId: "body.uranus", technicalId: "uranus", metadata: {} },
    ],
    evidenceRefs: [ref],
    evidence: [{ kind: "conjunction" }],
  };
  const serialized = serialiseInterpretationPrompt({
    task: "Write the requested interpretation.",
    decomposition,
    interpretationMap: null,
    chartEvidence: [{ ref, value: { kind: "conjunction" } }],
    permittedSourceRefs: [ref],
  });
  equal(serialized.profile, interpretationVoiceProfile.id, "voice profile identity");
  assert(serialized.interpretiveVoice.includes("INTERPRETIVE VOICE"), "missing interpretive voice section");
  assert(serialized.semanticInput.contract.includes("SEMANTIC REGISTER"), "missing semantic register section");
  equal(serialized.semanticInput.decomposition.ingredients[0]?.atomId, "point.north-node", "semantic input remains structured");
  equal(serialized.chartEvidence.sources[0]?.ref, ref, "chart evidence remains separate");
});

console.log(`1..${passed}`);
