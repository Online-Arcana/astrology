import type { Calc } from "../src/types/base.js";
import type { Aspect, AstronomyData, BodyState, PlanetId } from "../src/types/astro.js";
import { calculateDerived } from "../src/derived/calculate.js";
import { auxiliaryAngles, coreAngles } from "../src/house/angles.js";
import { calculateHouseCharts } from "../src/house/chart.js";
import { buildPoints } from "../src/zodiac/points.js";

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

const exact = <T>(value: T): Calc<T> => ({ status: "exact", value, reason: "none" });
const day = exact("day" as const);
const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const geometry = {
  apparentSiderealDegrees: 75.75311289815316,
  trueObliquityRadians: 23.44114011385631 * Math.PI / 180,
};
const angles = coreAngles(geometry, 0, 0);
const auxiliary = auxiliaryAngles(angles, 0, geometry.trueObliquityRadians);
const houses = calculateHouseCharts({
  angles,
  latitudeDegrees: 0,
  obliquityRadians: geometry.trueObliquityRadians,
  zodiac: "tropical",
});
const orbit = {
  meanNode: { longitudeDegrees: 290, speedDegreesPerDay: -0.053 },
  trueNode: { longitudeDegrees: 289, speedDegreesPerDay: 0.02 },
  meanApogee: { longitudeDegrees: 276, speedDegreesPerDay: 0.111 },
  trueApogee: { longitudeDegrees: 264, speedDegreesPerDay: -2.5 },
};
const lots = { fortune: exact(100), spirit: exact(200) };

const makeBody = (id: PlanetId, longitude: number, motion: BodyState["motion"] = "direct"): BodyState => ({
  id,
  rightAscensionRadians: exact(longitude * Math.PI / 180),
  declinationRadians: exact(0),
  eclipticLongitudeDegrees: exact(longitude),
  eclipticLatitudeDegrees: exact(0),
  distanceAu: exact(1),
  longitudeSpeedDegreesPerDay: exact(motion === "retrograde" ? -1 : motion === "stationary" ? 0 : 1),
  motion,
});

const makePoints = (
  longitudes: readonly number[],
  motions: Partial<Record<PlanetId, BodyState["motion"]>> = {},
) => {
  if (longitudes.length !== planets.length) throw new Error("Fixture requires ten planet longitudes");
  const bodies = {} as Record<PlanetId, BodyState>;
  planets.forEach((planet, index) => {
    bodies[planet] = makeBody(planet, longitudes[index] as number, motions[planet] ?? "direct");
  });
  const astronomy: AstronomyData = {
    frame: { centre: "geocentric", coordinates: "apparent", epoch: "date" },
    bodies,
  };
  return buildPoints({
    astronomy,
    houses,
    angles,
    auxiliary,
    lunarOrbit: orbit,
    lots,
    sect: day,
    zodiac: "tropical",
    ayanamshaDegrees: 0,
  }).points;
};

const aspect = (
  a: PlanetId,
  b: PlanetId,
  classification: "major" | "minor" = "major",
  strength = 1,
): Aspect => ({
  id: `${a}_${b}_fixture`,
  a,
  b,
  kind: classification === "major" ? "trine" : "quintile",
  exactAngleDegrees: classification === "major" ? 120 : 72,
  actualAngleDegrees: classification === "major" ? 120 : 72,
  orbDegrees: 0,
  allowedOrbDegrees: classification === "major" ? 7 : 2,
  phase: "exact",
  class: classification,
  character: classification === "major" ? "flowing" : "creative",
  strength,
  ruleRefs: ["fixture"],
});

await test("chart rulers, final dispositors and weighted balances are deterministic", () => {
  const points = makePoints([150, 151, 152, 153, 154, 155, 156, 157, 158, 159], { mercury: "retrograde" });
  const derived = calculateDerived({ points, aspects: [], sect: day });
  equal(derived.chartRuler.traditional.value, "mercury", "traditional chart ruler");
  equal(derived.chartRuler.modern.value, "mercury", "modern chart ruler");
  equal(derived.dispositors.finalTraditional, "mercury", "traditional final dispositor");
  equal(derived.dispositors.finalModern, "mercury", "modern final dispositor");
  equal(derived.balances.elements.earth, 14, "earth balance");
  equal(derived.balances.elements.air, 1, "air balance");
  equal(derived.balances.modalities.mutable, 15, "mutable balance");
  equal(derived.retrogradePlanets.includes("mercury"), true, "retrograde Mercury");
  equal(derived.jonesPattern.value, "bundle", "bundle pattern");
  equal(derived.dominantPlanets[0]?.planet, "mercury", "dominant Mercury");
  equal(derived.lots.fortune.value?.id, "part_of_fortune", "Fortune point");
});

await test("traditional and modern mutual receptions are kept separate", () => {
  const points = makePoints([130, 100, 160, 10, 40, 250, 280, 310, 340, 220]);
  const derived = calculateDerived({ points, aspects: [], sect: day });
  const venusMars = derived.mutualReceptions.filter(({ a, b }) => a === "venus" && b === "mars");
  equal(venusMars.length, 2, "Venus-Mars reception count");
  equal(venusMars.some(({ system }) => system === "traditional"), true, "traditional reception");
  equal(venusMars.some(({ system }) => system === "modern"), true, "modern reception");
  equal(derived.dispositors.finalTraditional, null, "multiple traditional final dispositors");
});

await test("unaspected planets ignore minor aspects and non-planet points", () => {
  const points = makePoints([0, 120, 45, 117, 180, 210, 240, 270, 300, 330]);
  const derived = calculateDerived({
    points,
    aspects: [aspect("sun", "moon"), aspect("mercury", "venus", "minor")],
    sect: day,
  });
  equal(derived.unaspectedPlanets.includes("sun"), false, "aspected Sun");
  equal(derived.unaspectedPlanets.includes("moon"), false, "aspected Moon");
  equal(derived.unaspectedPlanets.includes("mercury"), true, "minor-only Mercury");
});

const pattern = (longitudes: readonly number[]): string | null =>
  calculateDerived({ points: makePoints(longitudes), aspects: [], sect: day }).jonesPattern.value;

await test("Jones bundle, bowl and bucket rules are distinct", () => {
  equal(pattern([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]), "bundle", "bundle");
  equal(pattern([0, 20, 40, 60, 80, 100, 120, 140, 160, 180]), "bowl", "bowl");
  equal(pattern([0, 10, 20, 30, 40, 50, 60, 70, 80, 200]), "bucket", "bucket");
});

await test("Jones locomotive, see-saw and splash rules are distinct", () => {
  equal(pattern([0, 25, 50, 75, 100, 125, 150, 175, 200, 225]), "locomotive", "locomotive");
  equal(pattern([0, 10, 20, 30, 40, 180, 190, 200, 210, 220]), "see_saw", "see-saw");
  equal(pattern([0, 36, 72, 108, 144, 180, 216, 252, 288, 324]), "splash", "splash");
});

await test("dominance includes aspect strength without changing chart facts", () => {
  const points = makePoints([0, 120, 45, 117, 180, 210, 240, 270, 300, 330]);
  const without = calculateDerived({ points, aspects: [], sect: day });
  const withAspect = calculateDerived({ points, aspects: [aspect("sun", "moon", "major", 0.75)], sect: day });
  const sunBefore = without.dominantPlanets.find(({ planet }) => planet === "sun")?.score ?? 0;
  const sunAfter = withAspect.dominantPlanets.find(({ planet }) => planet === "sun")?.score ?? 0;
  close(sunAfter - sunBefore, 1.5, 1e-12, "Sun aspect contribution");
});

console.log(`1..${passed}`);
