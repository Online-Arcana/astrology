import { compileInterpretationCorpus } from "../src/interpretation/corpus/compile.js";
import { compileReviewedCorpus, reviewedCorpusAtoms } from "../src/interpretation/corpus/data/index.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../src/interpretation/corpus/types.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const source: CorpusSource = {
  id: "semantic.reviewed",
  title: "Reviewed semantic source",
  author: "Example",
  publisher: "Example",
  editionOrDate: "2026",
  role: "semantic",
  reviewStatus: "approved",
  allowedSections: ["reviewed-section"],
  notes: [],
};

const atom: CorpusAtom = {
  id: "point.part-of-spirit",
  kind: "entity",
  displayName: "Part of Spirit",
  plainEnglish: "Intentional action and chosen direction",
  aliases: [],
  internalIds: ["part_of_spirit"],
  claimIds: ["claim.part-of-spirit.intentional-action"],
  doNotInfer: ["soul", "divine purpose", "incarnation"],
  relatedAtomIds: [],
  sourceIds: [source.id],
  reviewStatus: "approved",
};

const claim: CorpusClaim = {
  id: "claim.part-of-spirit.intentional-action",
  atomId: atom.id,
  category: "core",
  proposition: "This point is associated with deliberate action, priorities actively pursued and chosen direction.",
  tags: ["intention", "action", "priorities"],
  sourceRefs: [`${source.id}#reviewed-section`],
  neutrality: {
    religious: false,
    spiritual: false,
    karmic: false,
    fatalistic: false,
    supernatural: false,
  },
  confidence: "well-supported",
};

test("review tooling can compile an explicitly partial neutral corpus", () => {
  const compiled = compileInterpretationCorpus({ sources: [source], atoms: [atom], claims: [claim] });
  equal(compiled.worldview, "agnostic", "compiled worldview");
  equal(compiled.atoms[atom.id]?.displayName, "Part of Spirit", "proper technical name remains available");
});

test("production compilation fails when required semantic coverage is incomplete", () => {
  let failed = false;
  try {
    compileInterpretationCorpus({ sources: [source], atoms: [atom], claims: [claim], requireComplete: true });
  } catch (cause: unknown) {
    failed = cause instanceof Error && cause.message.includes("missing required atoms");
  }
  equal(failed, true, "incomplete production corpus must fail");
});

test("technical or architecture references cannot silently become semantic provenance", () => {
  const technical: CorpusSource = { ...source, id: "technical.example", role: "calculation" };
  let failed = false;
  try {
    compileInterpretationCorpus({
      sources: [technical],
      atoms: [{ ...atom, sourceIds: [technical.id] }],
      claims: [{ ...claim, sourceRefs: [`${technical.id}#reviewed-section`] }],
    });
  } catch {
    failed = true;
  }
  equal(failed, true, "non-semantic provenance must fail");
});

test("claims cannot cite an unapproved section of an otherwise approved document", () => {
  let failed = false;
  try {
    compileInterpretationCorpus({
      sources: [source],
      atoms: [atom],
      claims: [{ ...claim, sourceRefs: [`${source.id}#different-section`] }],
    });
  } catch (cause: unknown) {
    failed = cause instanceof Error && cause.message.includes("unapproved section");
  }
  equal(failed, true, "document approval must not imply section approval");
});

test("claims require a section locator rather than a bare document ID", () => {
  let failed = false;
  try {
    compileInterpretationCorpus({
      sources: [source],
      atoms: [atom],
      claims: [{ ...claim, sourceRefs: [source.id] }],
    });
  } catch (cause: unknown) {
    failed = cause instanceof Error && cause.message.includes("must reference an approved section");
  }
  equal(failed, true, "bare document provenance must fail");
});

test("non-agnostic claims cannot enter even an otherwise valid partial corpus", () => {
  let failed = false;
  try {
    compileInterpretationCorpus({
      sources: [source],
      atoms: [atom],
      claims: [{ ...claim, proposition: "Your soul chose this direction as part of a karmic lesson." }],
    });
  } catch {
    failed = true;
  }
  equal(failed, true, "metaphysical claim must fail compilation");
});

const reviewedIds = new Set(reviewedCorpusAtoms.map(({ id }) => id));

test("the checked-in reviewed corpus contains all ten principal body atoms", () => {
  const expected = [
    "sun", "moon", "mercury", "venus", "mars",
    "jupiter", "saturn", "uranus", "neptune", "pluto",
  ];
  for (const id of expected) equal(reviewedIds.has(`body.${id}`), true, `body.${id} exists`);
});

test("the checked-in reviewed corpus contains every zodiac sign", () => {
  const expected = [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
  ];
  for (const id of expected) equal(reviewedIds.has(`sign.${id}`), true, `sign.${id} exists`);
});

test("the checked-in reviewed corpus contains all twelve houses", () => {
  for (let number = 1; number <= 12; number += 1) {
    equal(reviewedIds.has(`house.${number}`), true, `house.${number} exists`);
  }
});

test("the checked-in reviewed corpus contains every configured longitude aspect operator", () => {
  const expected = [
    "conjunction", "opposition", "trine", "square", "sextile",
    "quincunx", "semisextile", "semisquare", "sesquiquadrate", "quintile", "biquintile",
  ];
  for (const id of expected) equal(reviewedIds.has(`aspect.${id}`), true, `aspect.${id} exists`);
});

test("the checked-in reviewed corpus contains approved node lot and main-angle atoms", () => {
  const expected = [
    "point.north-node", "point.south-node", "point.part-of-fortune", "point.part-of-spirit",
    "angle.ascendant", "angle.descendant", "angle.midheaven", "angle.imum-coeli",
  ];
  for (const id of expected) equal(reviewedIds.has(id), true, `${id} exists`);
});

test("the checked-in reviewed corpus compiles as a partial agnostic corpus", () => {
  const compiled = compileReviewedCorpus(false);
  equal(compiled.worldview, "agnostic", "reviewed corpus worldview");
  equal(Object.keys(compiled.atoms).length >= 53, true, "reviewed corpus has the current reviewed atom set");
  equal(Object.keys(compiled.claims).length >= Object.keys(compiled.atoms).length, true, "every reviewed atom has semantic claims");
});

test("the checked-in corpus still refuses production compilation until remaining atoms are reviewed", () => {
  let failed = false;
  try {
    compileReviewedCorpus(true);
  } catch (cause: unknown) {
    failed = cause instanceof Error && cause.message.includes("missing required atoms");
  }
  equal(failed, true, "reviewed corpus must remain fail-closed while incomplete");
});

console.log(`1..${passed}`);
