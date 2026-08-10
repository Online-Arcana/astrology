import { decomposeInterpretationUnit } from "../src/interpretation/map/decompose.js";
import { requiredCorpusAtomSet } from "../src/interpretation/corpus/requirements.js";
import type { JsonRef } from "../src/types/base.js";
import type { AstralCalculation, InterpretationUnit } from "../src/types/file.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const ref = (value: string): JsonRef => `#/${value}` as JsonRef;

const calculation = {
  system: {
    zodiac: "tropical",
    ayanamsha: null,
    points: {
      north_node_mean: { id: "north_node_mean", position: { value: { longitudeDegrees: 10 } } },
      part_of_spirit: { id: "part_of_spirit", position: { value: { longitudeDegrees: 30 } } },
      uranus: { id: "uranus", position: { value: { longitudeDegrees: 10 } } },
    },
    houses: {
      placidus: {
        houses: {
          "1": { number: 1 },
        },
      },
    },
    aspects: [{
      id: "north_node_mean.uranus.conjunction",
      a: "north_node_mean",
      b: "uranus",
      kind: "conjunction",
      exactAngleDegrees: 0,
      actualAngleDegrees: 0,
      orbDegrees: 0,
      allowedOrbDegrees: 8,
      phase: "exact",
      class: "major",
      character: "contextual",
      strength: 1,
      ruleRefs: [],
    }],
  },
  compatibility: {
    domains: {
      business: {
        signs: {
          capricorn: { score: 64 },
        },
      },
    },
  },
} as unknown as AstralCalculation;

const unit = (
  id: string,
  section: string,
  refs: JsonRef[],
  domain: string | null = null,
): InterpretationUnit => ({ id, zodiac: "tropical", section, domain, allowedSourceRefs: refs });

test("mean and true calculation variants normalise to semantic node entities", () => {
  const result = decomposeInterpretationUnit(calculation, unit(
    "tropical.point.north_node_mean",
    "points.north_node_mean",
    [ref("astral-calculation/system/points/north_node_mean")],
  ));
  equal(result.ingredients[0]?.atomId, "point.north-node", "semantic node identity");
  equal(result.ingredients[0]?.metadata["calculationVariant"], "mean", "calculation variant metadata");
  equal(result.ingredients.some(({ atomId }) => atomId.includes("tropical")), false, "zodiac must not become semantic atom");
  equal(result.chartMetadata.zodiac, "tropical", "zodiac remains chart metadata");
});

test("Part of Spirit is a technical point name rather than a metaphysical claim", () => {
  const result = decomposeInterpretationUnit(calculation, unit(
    "tropical.point.part_of_spirit",
    "points.part_of_spirit",
    [ref("astral-calculation/system/points/part_of_spirit")],
  ));
  equal(result.ingredients[0]?.atomId, "point.part-of-spirit", "semantic point identity");
  equal(result.ingredients[0]?.metadata["technicalProperName"], true, "technical proper-name marker");
});

test("aspect units decompose into two semantic entities and one reusable relation", () => {
  const result = decomposeInterpretationUnit(calculation, unit(
    "tropical.aspect.north_node_mean.uranus.conjunction",
    "aspects.north_node_mean.uranus.conjunction",
    [ref("astral-calculation/system/aspects/0")],
  ));
  equal(result.ingredients.map(({ atomId }) => atomId).join("|"), "point.north-node|aspect.conjunction|body.uranus", "aspect decomposition");
  assert(result.ingredients.every(({ atomId }) => requiredCorpusAtomSet.has(atomId)), "aspect ingredients must resolve to required corpus atoms");
});

test("house units resolve to a domain atom and preserve house number as metadata", () => {
  const result = decomposeInterpretationUnit(calculation, unit(
    "tropical.house.1",
    "houses.1",
    [ref("astral-calculation/system/houses/placidus/houses/1")],
  ));
  equal(result.ingredients[0]?.atomId, "house.1", "house atom");
  equal(result.ingredients[0]?.metadata["house"], 1, "house number metadata");
});

test("compatibility separates domain from sign", () => {
  const result = decomposeInterpretationUnit(calculation, unit(
    "tropical.compatibility.business.capricorn",
    "compatibility.sign",
    [ref("astral-calculation/compatibility/domains/business/signs/capricorn")],
    "business",
  ));
  equal(result.ingredients.map(({ atomId }) => atomId).join("|"), "compatibility-domain.business|sign.capricorn", "compatibility decomposition");
});

console.log(`1..${passed}`);
