import { compileInterpretationCorpus } from "../src/interpretation/corpus/compile.js";
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
  allowedSections: ["reviewed section"],
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
      claims: [{ ...claim, sourceRefs: [`${technical.id}#section`] }],
    });
  } catch {
    failed = true;
  }
  equal(failed, true, "non-semantic provenance must fail");
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

console.log(`1..${passed}`);
