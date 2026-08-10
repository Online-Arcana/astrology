import type { InterpretationMap } from "../src/interpretation/corpus/types.js";
import type { InterpretationSemanticProvider } from "../src/interpretation/map/provider.js";
import { interpretationCalls } from "../src/llm/orchestrate/plan.js";
import type { JsonRef } from "../src/types/base.js";
import type { AstralCalculation } from "../src/types/file.js";

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

const sourceRef = "#/astral-calculation/system/points/sun" as JsonRef;
const calculation = {
  schema: "astral-calculation/1.1.0",
  subject: { providedName: "Fixture", language: "en", adult: true },
  system: {
    zodiac: "tropical",
    ayanamsha: null,
    points: {
      sun: {
        id: "sun",
        status: "exact",
        value: {
          longitudeDegrees: 12,
          sign: "aries",
        },
      },
    },
  },
  settings: {
    primaryZodiac: "tropical",
    siderealAyanamsha: null,
    interpretationMode: "tropical",
  },
  interpretationPlan: {
    schema: "astral-interpretation-plan/1.1.0",
    units: [{
      id: "tropical.point.sun",
      zodiac: "tropical",
      section: "points.sun",
      domain: null,
      allowedSourceRefs: [sourceRef],
    }],
  },
} as unknown as AstralCalculation;

const context = {
  calculation: { "astral-calculation": calculation },
  earlier: {},
  correction: [],
} as const;

const proposition = "Personal identity can be expressed through deliberate self-direction and visible commitment to chosen priorities.";
const map: InterpretationMap = {
  unitId: "tropical.point.sun",
  subject: {
    title: "Sun",
    plainEnglishDomain: "identity, self-direction and purposeful expression",
    technicalLabel: "Sun",
  },
  chartEvidence: [sourceRef],
  semantics: {
    core: [{
      id: "proposition.claim.sun.identity",
      text: proposition,
      tags: ["identity", "direction"],
      sourceClaimIds: ["claim.sun.identity"],
    }],
    detail: [],
    themes: [],
    strengths: [],
    tensions: [],
  },
  provenance: {
    corpusAtomIds: ["body.sun"],
    sourceClaimIds: ["claim.sun.identity"],
    corpusVersion: "fixture/1",
  },
  neutrality: { worldview: "agnostic" },
  forbiddenClaims: ["destiny", "divine purpose"],
};

const provider: InterpretationSemanticProvider = {
  mapFor: () => map,
};

test("live legacy calls serialize decomposition separately from interpretive voice", () => {
  const prepared = interpretationCalls(calculation);
  equal(prepared.calls.length, 1, "one substantive call");
  const input = prepared.calls[0]?.input(context) as {
    semanticMode?: string;
    privateControls?: string;
    interpretiveVoice?: string;
    semanticInput?: {
      decomposition?: { ingredients?: Array<{ atomId?: string }> };
      interpretationMap?: unknown;
    };
    chartEvidence?: { sources?: Array<{ ref?: string }> };
  };
  equal(input.semanticMode, "legacy-unmapped", "transitional semantic mode");
  assert(input.privateControls?.includes("different jobs") === true, "private controls should enforce separation");
  assert(input.interpretiveVoice?.includes("INTERPRETIVE VOICE") === true, "interpretive voice should be explicit");
  equal(input.semanticInput?.decomposition?.ingredients?.[0]?.atomId, "body.sun", "machine point decomposes to semantic atom");
  equal(input.semanticInput?.interpretationMap, null, "legacy mode carries no fake corpus map");
  equal(input.chartEvidence?.sources?.[0]?.ref, sourceRef, "chart evidence remains separate");
});

test("corpus-backed calls expose approved semantics without turning them into voice", () => {
  const prepared = interpretationCalls(calculation, provider);
  const input = prepared.calls[0]?.input(context) as {
    semanticMode?: string;
    semanticInput?: { interpretationMap?: InterpretationMap | null; contract?: string };
    interpretiveVoice?: string;
  };
  equal(input.semanticMode, "corpus-backed", "corpus semantic mode");
  equal(input.semanticInput?.interpretationMap?.unitId, map.unitId, "approved map attached");
  assert(input.semanticInput?.contract?.includes("Only propositions contained in interpretationMap") === true, "map should be semantic authority");
  assert(input.interpretiveVoice?.includes("source-author imitation") === true, "voice should forbid source imitation");
});

test("corpus-backed live audit rejects copied proposition wording", () => {
  const call = interpretationCalls(calculation, provider).calls[0];
  assert(call !== undefined, "substantive call should exist");
  const audit = call.audit({
    status: "written",
    title: "Identity",
    summary: proposition,
    detail: "You may feel most coherent when your choices reflect priorities you have consciously selected and can sustain over time.",
    themes: ["You tend to organise important choices around a clear sense of personal direction."],
    strengths: ["You can bring dependable initiative to goals that genuinely matter to you."],
    tensions: ["You may become overly identified with one aim when flexibility would serve you better."],
    sourceRefs: [sourceRef],
  }, context);
  equal(audit.valid, false, "copied semantic wording must fail");
  assert(audit.errors.some((message) => message.includes("reproduces corpus proposition wording too closely")), "copy-leak diagnostic should be explicit");
});

test("forbidden-claim policy metadata can contain taboo terms without becoming prose semantics", () => {
  const prepared = interpretationCalls(calculation, provider);
  equal(prepared.calls.length, 1, "policy metadata should not poison map validation");
});

console.log(`1..${passed}`);
