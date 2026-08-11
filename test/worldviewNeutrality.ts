import {
  auditSourceNeutrality,
  auditWorldviewText,
} from "../src/interpretation/corpus/worldview.js";
import {
  validateCorpusClaim,
  validateSourceForSemanticIngestion,
} from "../src/interpretation/corpus/compile.js";
import type { CorpusClaim, CorpusSource } from "../src/interpretation/corpus/types.js";
import { auditField } from "../src/llm/audit/field.js";
import { fallbackCatalogue } from "../src/llm/reconstruct/catalogue.js";

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

const rejected = [
  "God is asking you to accept this challenge.",
  "God has given you this challenge for a reason.",
  "The universe has placed this person in your path to teach you independence.",
  "The universe is telling you to change direction.",
  "This is a karmic relationship that carries unfinished debt.",
  "You knew this person in a past life.",
  "Your soul chose this challenge before this incarnation.",
  "This encounter was destined to happen.",
  "You are spiritually meant to follow this direction.",
  "This placement reflects divine purpose in your life.",
  "Your guardian angel is guiding this relationship.",
  "Your spirit guides are asking you to wait.",
  "This pattern is part of a larger cosmic plan.",
] as const;

const accepted = [
  "This relationship may challenge you to balance independence with cooperation.",
  "This placement can describe a strong preference for approaching problems on your own terms.",
  "Important encounters may coincide with periods when your priorities are changing.",
  "You may find that solitude gives you more room to process experiences privately.",
  "Astrologically, this pattern points towards a recurring tension between autonomy and cooperation.",
  "Part of Spirit can be interpreted here as intentional action and chosen direction.",
] as const;

test("explicit religious karmic fatalistic and supernatural claims are hard failures", () => {
  for (const sample of rejected) {
    const result = auditWorldviewText(sample);
    equal(result.safe, false, sample);
    assert(result.findings.some(({ severity }) => severity === "reject"), `missing hard finding for ${sample}`);
  }
});

test("worldview-neutral psychological and symbolic prose passes", () => {
  for (const sample of accepted) {
    const result = auditWorldviewText(sample);
    equal(result.safe, true, sample);
    equal(result.requiresReview, false, sample);
  }
});

test("Part of Spirit survives only as a technical proper name", () => {
  equal(auditWorldviewText("Part of Spirit can describe chosen priorities.").safe, true, "proper name should pass");
  equal(auditWorldviewText("Your spirit chose this incarnation for you.").safe, false, "metaphysical spirit claim must fail");
});

test("subtle intentional-metaphysics language is quarantined for review", () => {
  const result = auditWorldviewText("This person entered your life for a reason.");
  equal(result.safe, true, "ambiguous phrase is not lexical hard reject");
  equal(result.requiresReview, true, "ambiguous phrase requires discriminator review");
});

test("source passages fail before claim extraction when worldview assumptions appear", () => {
  const result = auditSourceNeutrality("Your soul carries karmic lessons from a past life.");
  equal(result.safeForAgnosticCorpus, false, "metaphysical passage must not enter corpus");
  equal(result.karmaOrReincarnation, true, "karma category");
  equal(result.soulAssumption, true, "soul category");
});

test("semantic source ingestion is document-level and requires explicit approval", () => {
  const source: CorpusSource = {
    id: "semantic.example",
    title: "Reviewed secular astrology source",
    author: "Example Author",
    publisher: "Example Publisher",
    editionOrDate: "2026",
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: ["planets"],
    notes: [],
  };
  validateSourceForSemanticIngestion(source, "This pattern can describe independence and willingness to change.");

  let rejectedSource = false;
  try {
    validateSourceForSemanticIngestion({ ...source, reviewStatus: "pending" }, "This pattern can describe independence.");
  } catch {
    rejectedSource = true;
  }
  equal(rejectedSource, true, "pending semantic source must be rejected");
});

test("compiled corpus claims must be neutral and provenance-backed", () => {
  const claim: CorpusClaim = {
    id: "claim.example.independence",
    atomId: "body.uranus",
    category: "core",
    proposition: "This symbol is associated with independence and willingness to depart from established patterns.",
    tags: ["independence", "change"],
    sourceRefs: ["semantic.example#planets"],
    neutrality: {
      religious: false,
      spiritual: false,
      karmic: false,
      fatalistic: false,
      supernatural: false,
    },
    confidence: "well-supported",
  };
  validateCorpusClaim(claim);

  let rejectedClaim = false;
  try {
    validateCorpusClaim({ ...claim, proposition: "Your soul is destined to learn this karmic lesson." });
  } catch {
    rejectedClaim = true;
  }
  equal(rejectedClaim, true, "non-neutral claim must never compile");
});

test("runtime field audit hard-rejects worldview assumptions", () => {
  const result = auditField("The universe placed this person in your path because your soul needs the lesson.", {
    id: "fixture.summary",
    lexicon: [],
  });
  equal(result.valid, false, "worldview assumption should fail field audit");
  assert(result.issues.some(({ code }) => code === "worldview_assumption"), "missing worldview audit code");
});

test("ambiguous runtime prose is fail-closed until the discriminator accepts it", () => {
  const result = auditField("This person entered your life for a reason and may affect your priorities.", {
    id: "fixture.summary",
    lexicon: [],
  });
  equal(result.worldviewReview.length > 0, true, "review reason should be retained");
});

test("existing deterministic fallback catalogue is worldview-neutral", () => {
  for (const [family, fields] of Object.entries(fallbackCatalogue)) {
    for (const [field, value] of Object.entries(fields)) {
      const result = auditWorldviewText(value);
      equal(result.safe, true, `${family}.${field}`);
      equal(result.requiresReview, false, `${family}.${field}`);
    }
  }
});

console.log(`1..${passed}`);
