import { calculateLots } from "../src/astro/lots.js";
import type { LunarOrbitSample } from "../src/astro/port.js";
import { calculateSect } from "../src/astro/sect.js";
import { auxiliaryAngles, coreAngles } from "../src/house/angles.js";
import { calculateHouseCharts } from "../src/house/chart.js";
import type { AstronomyData, BodyState, PlanetId } from "../src/types/astro.js";
import { buildPoints } from "../src/zodiac/points.js";

const close = (actual: number, expected: number, tolerance: number, message: string): void => {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${message}: expected ${expected}, got ${actual}`);
};
const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const exact = <T>(value: T) => ({ status: "exact" as const, value, reason: "none" as const });
const ids = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const body = (id: PlanetId, longitude: number, rightAscension: number, declination: number): BodyState => ({
  id,
  rightAscensionRadians: exact(rightAscension),
  declinationRadians: exact(declination),
  eclipticLongitudeDegrees: exact(longitude),
  eclipticLatitudeDegrees: exact(0),
  distanceAu: exact(1),
  longitudeSpeedDegreesPerDay: exact(1),
  motion: "direct",
});
const bodies = {} as Record<PlanetId, BodyState>;
ids.forEach((id, index) => { bodies[id] = body(id, index * 28, 0, 0); });
bodies.sun = body("sun", 84, 0, 0);
bodies.moon = body("moon", 180, 0, 0);
const astronomy: AstronomyData = {
  frame: { centre: "geocentric", coordinates: "apparent", epoch: "date" },
  bodies,
};

const geometry = {
  apparentSiderealDegrees: 75.75311289815316,
  trueObliquityRadians: 23.44114011385631 * Math.PI / 180,
};
const angles = coreAngles(geometry, -1.784, 57.505);
const auxiliary = auxiliaryAngles(angles, 57.505, geometry.trueObliquityRadians);
const houses = calculateHouseCharts({
  angles,
  latitudeDegrees: 57.505,
  obliquityRadians: geometry.trueObliquityRadians,
  zodiac: "tropical",
});
const day = exact("day" as const);

await test("Vertex, Antivertex and East Point match the independent fixture", () => {
  close(auxiliary.vertex, 336.2768392553082, 1e-8, "Vertex");
  close(auxiliary.antivertex, 156.2768392553082, 1e-8, "Antivertex");
  close(auxiliary.eastPoint, 162.61072224422642, 1e-8, "East Point");
});

await test("sect uses the Sun's actual altitude", () => {
  const daySect = calculateSect(astronomy, { ...angles, localSiderealDegrees: 0 }, 0);
  equal(daySect.value, "day", "day sect");
  const night = calculateSect(astronomy, { ...angles, localSiderealDegrees: 180 }, 0);
  equal(night.value, "night", "night sect");
});

await test("Fortune and Spirit use sect-correct formulas", () => {
  const dayLots = calculateLots(astronomy, angles, day);
  close(dayLots.fortune.value ?? -1, angles.ascendant + 96, 1e-9, "day Fortune");
  close(dayLots.spirit.value ?? -1, angles.ascendant - 96, 1e-9, "day Spirit");
  const night = calculateLots(astronomy, angles, exact("night" as const));
  close(night.fortune.value ?? -1, angles.ascendant - 96, 1e-9, "night Fortune");
  close(night.spirit.value ?? -1, angles.ascendant + 96, 1e-9, "night Spirit");
});

const orbit: LunarOrbitSample = {
  meanNode: { longitudeDegrees: 290, speedDegreesPerDay: -0.053 },
  trueNode: { longitudeDegrees: 289, speedDegreesPerDay: 0.02 },
  meanApogee: { longitudeDegrees: 276, speedDegreesPerDay: 0.111 },
  trueApogee: { longitudeDegrees: 264, speedDegreesPerDay: -2.5 },
};
const lots = calculateLots(astronomy, angles, day);

await test("fixed point map contains every required point", () => {
  const result = buildPoints({
    astronomy, houses, angles, auxiliary, lunarOrbit: orbit, lots, sect: day,
    zodiac: "tropical", ayanamshaDegrees: 0,
  });
  equal(Object.keys(result.points).length, 25, "point count");
  equal(result.points.north_node_mean.motion, "retrograde", "mean node motion");
  equal(result.points.north_node_true.motion, "direct", "true node motion");
  equal(result.points.lilith_true.position.value?.longitudeDegrees, 264, "true Lilith");
  equal(result.points.part_of_fortune.kind, "lot", "Fortune kind");
  equal(result.points.sun.dignity.value?.traditionalRuler, "mercury", "Sun sign ruler");
});

await test("sidereal points shift without mixing tropical house geometry", () => {
  const siderealHouses = calculateHouseCharts({
    angles,
    latitudeDegrees: 57.505,
    obliquityRadians: geometry.trueObliquityRadians,
    zodiac: "sidereal",
    ayanamshaDegrees: 24,
  });
  const result = buildPoints({
    astronomy, houses: siderealHouses, angles, auxiliary, lunarOrbit: orbit, lots, sect: day,
    zodiac: "sidereal", ayanamshaDegrees: 24,
  });
  close(result.points.sun.position.value?.longitudeDegrees ?? -1, 60, 1e-9, "sidereal Sun");
  close(result.points.ascendant.position.value?.longitudeDegrees ?? -1, angles.ascendant - 24, 1e-9, "sidereal Ascendant");
  close(result.points.part_of_fortune.position.value?.longitudeDegrees ?? -1, (lots.fortune.value as number) - 24, 1e-9, "sidereal Fortune");
  equal(result.points.sun.dignity.value?.traditionalRuler, "mercury", "sidereal Sun ruler");
});

await test("house occupants are populated from point placements", () => {
  const result = buildPoints({
    astronomy, houses, angles, auxiliary, lunarOrbit: orbit, lots, sect: day,
    zodiac: "tropical", ayanamshaDegrees: 0,
  });
  const ascHouse = result.points.ascendant.houses.placidus.value?.house;
  equal(ascHouse, 1, "Ascendant house");
  equal(result.houses.placidus.houses["1"].occupants.includes("ascendant"), true, "Ascendant occupant");
});

await test("missing time-dependent geometry remains explicit", () => {
  const result = buildPoints({
    astronomy, houses, angles: null, auxiliary: null, lunarOrbit: orbit,
    lots: {
      fortune: { status: "unavailable", value: null, reason: "birth_time_unknown" },
      spirit: { status: "unavailable", value: null, reason: "birth_time_unknown" },
    },
    sect: { status: "unavailable", value: null, reason: "birth_time_unknown" },
    zodiac: "tropical", ayanamshaDegrees: 0, unavailableReason: "birth_time_unknown",
  });
  equal(result.points.ascendant.position.value, null, "unknown Ascendant");
  equal(result.points.ascendant.position.reason, "birth_time_unknown", "unknown Ascendant reason");
  equal(result.points.part_of_fortune.position.value, null, "unknown Fortune");
  equal(result.points.sun.dignity.status, "bounded", "unknown-sect dignity status");
});

console.log(`1..${passed}`);
