import { calculateCompatibility, candidateRulers, signRelation } from "../src/compat/calculate.js";
import { compatibilityDomains } from "../src/compat/catalogue.js";
import type { Calc } from "../src/types/base.js";
import type {
  AstrologicalPoint,
  DignityState,
  HousePlacement,
  HouseSystem,
  PointId,
  PointMap,
  SignPosition,
} from "../src/types/astro.js";
import { normaliseDegrees, signPosition, signs } from "../src/zodiac/position.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const close = (actual: number, expected: number, tolerance: number, message: string): void => {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${message}: expected ${expected}, got ${actual}`);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const pointIds = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "north_node_true", "south_node_true", "north_node_mean", "south_node_mean",
  "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
  "part_of_fortune", "part_of_spirit", "lilith_mean", "lilith_true",
] as const satisfies readonly PointId[];
const systems = ["placidus", "whole_sign", "equal", "porphyry"] as const satisfies readonly HouseSystem[];

const exact = <T>(value: T): Calc<T> => ({ status: "exact", value, reason: "none" });
const unavailable = <T>(): Calc<T> => ({ status: "unavailable", value: null, reason: "birth_time_unknown" });

const dignity: Calc<DignityState> = unavailable();
const houses = (): Record<HouseSystem, Calc<HousePlacement>> => {
  const output = {} as Record<HouseSystem, Calc<HousePlacement>>;
  for (const system of systems) output[system] = unavailable();
  return output;
};

const longitudes: Readonly<Record<PointId, number>> = {
  sun: 5,
  moon: 100,
  mercury: 72,
  venus: 50,
  mars: 225,
  jupiter: 248,
  saturn: 282,
  uranus: 305,
  neptune: 340,
  pluto: 235,
  north_node_true: 290,
  south_node_true: 110,
  north_node_mean: 292,
  south_node_mean: 112,
  ascendant: 135,
  descendant: 315,
  midheaven: 45,
  imum_coeli: 225,
  vertex: 330,
  antivertex: 150,
  east_point: 128,
  part_of_fortune: 180,
  part_of_spirit: 90,
  lilith_mean: 275,
  lilith_true: 264,
};

const point = (id: PointId, position: Calc<SignPosition>): AstrologicalPoint => ({
  id,
  kind: id === "sun" || id === "moon"
    ? "luminary"
    : ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].includes(id)
      ? "planet"
      : id.includes("node")
        ? "node"
        : ["part_of_fortune", "part_of_spirit"].includes(id)
          ? "lot"
          : id.includes("lilith")
            ? "lilith"
            : "angle",
  position,
  houses: houses(),
  motion: "not_applicable",
  dignity,
});

const pointMap = (shift = 0, omitTimed = false): PointMap<AstrologicalPoint> => {
  const output = {} as PointMap<AstrologicalPoint>;
  const timed = new Set<PointId>([
    "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
    "part_of_fortune", "part_of_spirit", "lilith_true",
  ]);
  for (const id of pointIds) {
    output[id] = point(
      id,
      omitTimed && timed.has(id)
        ? unavailable()
        : exact(signPosition(normaliseDegrees(longitudes[id] - shift))),
    );
  }
  return output;
};

await test("sign relation geometry covers all seven sign distances", () => {
  equal(signRelation("aries", "aries"), "conjunction", "same sign");
  equal(signRelation("aries", "taurus"), "semisextile", "adjacent sign");
  equal(signRelation("aries", "gemini"), "sextile", "two-sign distance");
  equal(signRelation("aries", "cancer"), "square", "three-sign distance");
  equal(signRelation("aries", "leo"), "trine", "four-sign distance");
  equal(signRelation("aries", "virgo"), "quincunx", "five-sign distance");
  equal(signRelation("aries", "libra"), "opposition", "opposite sign");
});

await test("every domain ranks all twelve signs exactly once", () => {
  const matrix = calculateCompatibility("tropical", pointMap());
  equal(Object.keys(matrix.domains).length, compatibilityDomains.length, "domain count");
  for (const domain of compatibilityDomains) {
    const result = matrix.domains[domain];
    equal(result.ranked.length, 12, `${domain} ranking length`);
    equal(new Set(result.ranked).size, 12, `${domain} unique signs`);
    equal(Object.keys(result.signs).length, 12, `${domain} sign map length`);
    result.ranked.forEach((sign, index) => equal(result.signs[sign].rank, index + 1, `${domain}.${sign} rank`));
  }
});

await test("factor contributions remain inspectable and reproduce the raw score", () => {
  const score = calculateCompatibility("tropical", pointMap()).domains.romantic.signs.taurus;
  const contribution = score.factors.reduce((sum, factor) => sum + factor.contribution, 0);
  close(contribution, score.score, 0.00001, "factor contribution total");
  equal(score.factors.every((factor) => factor.sourceRefs.length === 1), true, "single source per factor");
  equal(
    score.factors.every((factor) => factor.sourceRefs[0]?.startsWith("#/astral-calculation/systems/tropical/points/")),
    true,
    "tropical source paths",
  );
});

await test("romantic and sexual rankings use genuinely different catalogues", () => {
  const matrix = calculateCompatibility("tropical", pointMap());
  equal(
    matrix.domains.romantic.ranked.join(",") === matrix.domains.sexual.ranked.join(","),
    false,
    "romantic and sexual ordering",
  );
  equal(
    matrix.domains.romantic.signs.scorpio.score === matrix.domains.sexual.signs.scorpio.score,
    false,
    "romantic and sexual Scorpio score",
  );
});

await test("tropical and sidereal matrices are calculated independently", () => {
  const tropical = calculateCompatibility("tropical", pointMap());
  const sidereal = calculateCompatibility("sidereal", pointMap(24));
  equal(
    tropical.domains.overall.ranked.join(",") === sidereal.domains.overall.ranked.join(","),
    false,
    "cross-zodiac overall ordering",
  );
  equal(
    sidereal.domains.overall.signs.aries.factors.every((factor) =>
      factor.sourceRefs[0]?.startsWith("#/astral-calculation/systems/sidereal/points/"),
    ),
    true,
    "sidereal source paths",
  );
});

await test("unknown timed points are omitted and weights are renormalised", () => {
  const matrix = calculateCompatibility("tropical", pointMap(0, true));
  for (const domain of compatibilityDomains) {
    equal(matrix.domains[domain].ranked.length, 12, `${domain} unknown-time ranking`);
  }
  const business = matrix.domains.business.signs.capricorn;
  equal(business.factors.some((factor) => factor.id.includes("midheaven")), false, "missing Midheaven factor");
  equal(business.score >= 0 && business.score <= 100, true, "renormalised score range");
});

await test("candidate ruler metadata preserves traditional and modern systems", () => {
  equal(candidateRulers("aquarius").traditional, "saturn", "Aquarius traditional ruler");
  equal(candidateRulers("aquarius").modern, "uranus", "Aquarius modern co-ruler");
  equal(candidateRulers("taurus").traditional, "venus", "Taurus traditional ruler");
  equal(candidateRulers("taurus").modern, null, "Taurus modern co-ruler");
});

await test("scores are bounded and levels include deterministic relations", () => {
  const matrix = calculateCompatibility("tropical", pointMap());
  const levels = new Set<string>();
  for (const domain of compatibilityDomains) {
    for (const sign of signs) {
      const score = matrix.domains[domain].signs[sign];
      equal(score.score >= 0 && score.score <= 100, true, `${domain}.${sign} score range`);
      levels.add(score.level);
      equal(
        score.relation === "compatible" || score.relation === "neutral" || score.relation === "incompatible",
        true,
        `${domain}.${sign} relation`,
      );
    }
  }
  equal(levels.has("high"), true, "high compatibility represented");
  equal(levels.has("medium"), true, "medium compatibility represented");
  equal(levels.has("low"), true, "low compatibility represented");
});

console.log(`1..${passed}`);
