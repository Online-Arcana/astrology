import { auditField } from "../src/llm/audit/field.js";
import type { InterpretationCall } from "../src/llm/orchestrate/types.js";
import { reconstructUnit } from "../src/llm/reconstruct/reconstruct.js";
import { shapeForUnit } from "../src/llm/schema/chart.js";
import type { InterpretationMap } from "../src/interpretation/corpus/types.js";
import type { JsonRef } from "../src/types/base.js";
import type { InterpretationUnit } from "../src/types/file.js";

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

const ref = "#/astral-calculation/system/aspects/0" as JsonRef;
const unit: InterpretationUnit = {
  id: "tropical.aspect.north_node_mean.uranus.conjunction",
  zodiac: "tropical",
  section: "aspects.north_node_mean.uranus.conjunction",
  domain: null,
  allowedSourceRefs: [ref],
};
const proposition = "Personal development is associated with independence, experimentation and willingness to depart from established patterns.";
const map: InterpretationMap = {
  unitId: unit.id,
  subject: {
    title: "North Node conjunct Uranus",
    plainEnglishDomain: "developmental direction interacting with independence and experimentation",
  },
  chartEvidence: [ref],
  semantics: {
    core: [{
      id: "proposition.fixture.core",
      text: proposition,
      tags: ["independence", "experimentation", "developmental direction"],
      sourceClaimIds: ["claim.fixture.core"],
    }],
    detail: [{
      id: "proposition.fixture.detail",
      text: "Change can be more constructive when it serves a considered direction instead of novelty alone.",
      tags: ["change", "deliberate direction"],
      sourceClaimIds: ["claim.fixture.detail"],
    }],
    themes: [],
    strengths: [{
      id: "proposition.fixture.strength",
      text: "A constructive expression can support independent experimentation and openness to alternatives.",
      tags: ["independent experimentation", "openness to alternatives"],
      sourceClaimIds: ["claim.fixture.strength"],
    }],
    tensions: [{
      id: "proposition.fixture.tension",
      text: "A difficult expression can mistake disruption for useful change.",
      tags: ["disruption", "useful change"],
      sourceClaimIds: ["claim.fixture.tension"],
    }],
  },
  provenance: {
    corpusAtomIds: ["point.north-node", "aspect.conjunction", "body.uranus"],
    sourceClaimIds: [
      "claim.fixture.core",
      "claim.fixture.detail",
      "claim.fixture.strength",
      "claim.fixture.tension",
    ],
    corpusVersion: "fixture/1",
  },
  neutrality: { worldview: "agnostic" },
  forbiddenClaims: ["karma", "past lives", "destiny"],
};

const call: InterpretationCall = {
  id: unit.id,
  label: "North Node conjunct Uranus",
  kind: "small",
  semanticMap: map,
  shape: shapeForUnit(unit, [ref]),
  allowedSourceRefs: new Set([ref]),
  input: () => ({}),
  audit: (value) => ({ valid: true, value, errors: [] }),
};

test("empty candidate reconstruction uses semantic map before generic XML prose", () => {
  const rebuilt = reconstructUnit({ unit: call, candidates: [] });
  equal(rebuilt.usedXmlFallback, false, "semantic map should avoid XML prose fallback");
  assert(rebuilt.fallbackFields.includes("summary"), "summary should be deterministically rendered");
  const value = rebuilt.value as {
    title?: string;
    summary?: string;
    strengths?: string[];
    tensions?: string[];
    sourceRefs?: JsonRef[];
  };
  equal(value.title, map.subject.title, "map owns deterministic title meaning");
  assert(value.summary?.includes("independence") === true, "summary should use approved map concepts");
  assert(value.strengths?.[0]?.includes("independent experimentation") === true, "strength should use constructive concepts");
  assert(value.tensions?.[0]?.includes("disruption") === true, "tension should use difficult concepts");
  equal(value.sourceRefs?.[0], ref, "deterministic evidence reference should be retained");
  equal(value.summary?.includes(proposition), false, "renderer must not copy the semantic proposition as prose");
  call.shape.parse?.(rebuilt.value);
});

test("semantic deterministic prose passes the same corpus-copy and voice audit", () => {
  const rebuilt = reconstructUnit({ unit: call, candidates: [] });
  const summary = (rebuilt.value as { summary?: string }).summary ?? "";
  const audit = auditField(summary, {
    id: `${unit.id}.summary`,
    lexicon: ["independence", "experimentation", "developmental", "direction"],
    semanticPropositions: [proposition],
  });
  equal(audit.valid, true, `semantic fallback audit: ${audit.issues.map(({ message }) => message).join("; ")}`);
});

test("unsafe candidate prose is discarded and rebuilt from safe semantic concepts", () => {
  const rebuilt = reconstructUnit({
    unit: call,
    candidates: [{
      status: "written",
      title: "North Node conjunct Uranus",
      summary: "Your soul chose this karmic lesson in a past life.",
      detail: "The universe placed disruption in your path for a reason.",
      themes: ["Destiny will force change."],
      strengths: ["Divine guidance supports you."],
      tensions: ["Your karma creates instability."],
      sourceRefs: [ref],
    }],
  });
  const encoded = JSON.stringify(rebuilt.value).toLocaleLowerCase("en-GB");
  equal(encoded.includes("karm"), false, "karmic candidate language must not survive");
  equal(encoded.includes("soul chose"), false, "soul-metaphysics candidate language must not survive");
  equal(encoded.includes("destiny"), false, "fatalistic candidate language must not survive");
  equal(rebuilt.usedXmlFallback, false, "safe map renderer should recover without XML prose");
});

console.log(`1..${passed}`);
