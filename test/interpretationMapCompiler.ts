import { compileInterpretationCorpus } from "../src/interpretation/corpus/compile.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../src/interpretation/corpus/types.js";
import { compileInterpretationMap, semanticPropositionTexts } from "../src/interpretation/map/compile.js";
import type { DecomposedInterpretationUnit } from "../src/interpretation/map/decompose.js";
import type { JsonRef } from "../src/types/base.js";

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

const source: CorpusSource = {
  id: "semantic.reviewed",
  title: "Reviewed semantic source",
  author: "Example",
  publisher: "Example",
  editionOrDate: "2026",
  role: "semantic",
  reviewStatus: "approved",
  allowedSections: ["nodes", "uranus", "aspects"],
  notes: [],
};

const atom = (
  id: string,
  kind: CorpusAtom["kind"],
  displayName: string,
  plainEnglish: string,
  claimIds: string[],
  doNotInfer: string[] = [],
): CorpusAtom => ({
  id,
  kind,
  displayName,
  plainEnglish,
  aliases: [],
  internalIds: [],
  claimIds,
  doNotInfer,
  relatedAtomIds: [],
  sourceIds: [source.id],
  reviewStatus: "approved",
});

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

const sectionFor = (atomId: string): string => atomId.startsWith("point.")
  ? "nodes"
  : atomId.startsWith("aspect.")
    ? "aspects"
    : "uranus";

const claim = (
  id: string,
  atomId: string,
  category: CorpusClaim["category"],
  proposition: string,
): CorpusClaim => ({
  id,
  atomId,
  category,
  proposition,
  tags: [],
  sourceRefs: [`${source.id}#${sectionFor(atomId)}`],
  neutrality: neutral,
  confidence: "well-supported",
});

const atoms: CorpusAtom[] = [
  atom(
    "point.north-node",
    "entity",
    "North Node",
    "developmental direction and unfamiliar ways of responding",
    ["claim.node.direction", "claim.node.tension"],
    ["karmic debt", "past lives", "destiny"],
  ),
  atom(
    "aspect.conjunction",
    "relation",
    "Conjunction",
    "a close linkage in which two principles strongly condition one another",
    ["claim.conjunction.fuse"],
  ),
  atom(
    "body.uranus",
    "entity",
    "Uranus",
    "independence, disruption, experimentation and departure from established patterns",
    ["claim.uranus.change", "claim.uranus.risk"],
  ),
];

const claims: CorpusClaim[] = [
  claim(
    "claim.node.direction",
    "point.north-node",
    "core",
    "This point is associated with development through responses that are less familiar or habitual.",
  ),
  claim(
    "claim.node.tension",
    "point.north-node",
    "developmental",
    "Development can involve distinguishing useful growth from change pursued only because it feels unfamiliar.",
  ),
  claim(
    "claim.conjunction.fuse",
    "aspect.conjunction",
    "interaction",
    "A conjunction links two principles closely so that expression of one strongly conditions the other.",
  ),
  claim(
    "claim.uranus.change",
    "body.uranus",
    "constructive",
    "Uranian symbolism is associated with independence, experimentation and willingness to question established patterns.",
  ),
  claim(
    "claim.uranus.risk",
    "body.uranus",
    "difficult",
    "A difficult expression can confuse disruption with useful change or reject stability merely because it is conventional.",
  ),
];

const corpus = compileInterpretationCorpus({ sources: [source], atoms, claims });
const evidenceRef = "#/astral-calculation/system/aspects/0" as JsonRef;
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
  evidenceRefs: [evidenceRef],
  evidence: [{ a: "north_node_mean", b: "uranus", kind: "conjunction" }],
};

const map = compileInterpretationMap(corpus, decomposition);

test("map is composed from entity-relation-entity atoms rather than a canned combination essay", () => {
  equal(
    map.provenance.corpusAtomIds.join("|"),
    "point.north-node|aspect.conjunction|body.uranus",
    "composed atom identities",
  );
  equal(map.chartEvidence[0], evidenceRef, "deterministic evidence survives into the map");
  equal(map.composition?.ingredients.length, 3, "chart-specific composition is retained privately");
});

test("claim categories become semantic buckets", () => {
  equal(map.semantics.core.length, 1, "core claims");
  equal(map.semantics.detail.length, 1, "developmental claims");
  equal(map.semantics.themes.length, 1, "interaction claims");
  equal(map.semantics.strengths.length, 1, "constructive claims");
  equal(map.semantics.tensions.length, 1, "difficult claims");
});

test("forbidden metaphysical concepts remain policy metadata without poisoning the map audit", () => {
  assert(map.forbiddenClaims.includes("karmic debt"), "atom-specific prohibition should survive compilation");
  assert(map.forbiddenClaims.some((value) => value.includes("fate")), "global fatalism prohibition should survive compilation");
  equal(map.neutrality.worldview, "agnostic", "map worldview");
});

test("semantic proposition text is separately available for prose-copy leakage auditing", () => {
  const propositions = semanticPropositionTexts(map);
  equal(propositions.length, 5, "all map propositions should be available to the voice audit");
  assert(propositions.includes(claims[0]?.proposition ?? ""), "core proposition should be exposed to audit tooling");
});

test("machine calculation variants remain outside semantic atom identity", () => {
  equal(map.provenance.corpusAtomIds.some((id) => id.includes("mean")), false, "mean node is calculation metadata, not meaning");
  equal(map.subject.technicalLabel, decomposition.unitId, "technical identity may remain private map metadata");
});

console.log(`1..${passed}`);
