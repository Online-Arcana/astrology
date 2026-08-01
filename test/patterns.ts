import { detectAspects } from "../src/aspect/detect.js";
import { detectDeclinationAspect, detectDeclinationAspects } from "../src/aspect/declination.js";
import { detectPatterns, type PatternPoint } from "../src/pattern/detect.js";
import type { PatternKind, PlanetId } from "../src/types/astro.js";
import { signPosition } from "../src/zodiac/position.js";

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

const ids = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];

const chart = (longitudes: readonly number[]) => {
  const points: PatternPoint[] = longitudes.map((longitude, index) => ({
    id: ids[index] as PlanetId,
    position: signPosition(longitude),
  }));
  const aspects = detectAspects(points.map(({ id, position }) => ({
    id,
    longitudeDegrees: position.longitudeDegrees,
    speedDegreesPerDay: 1,
  })));
  return { points, aspects, patterns: detectPatterns(points, aspects) };
};

const requirePattern = (kind: PatternKind, longitudes: readonly number[]) => {
  const result = chart(longitudes);
  const pattern = result.patterns.find((value) => value.kind === kind);
  if (!pattern) throw new Error(`Expected ${kind} pattern`);
  return { ...result, pattern };
};

await test("parallel and contra-parallel use separate declination geometry", () => {
  const parallel = detectDeclinationAspect(
    { id: "sun", declinationRadians: 20 * Math.PI / 180 },
    { id: "moon", declinationRadians: 19 * Math.PI / 180 },
  );
  equal(parallel?.kind, "parallel", "parallel kind");
  close(parallel?.orbDegrees ?? -1, 1, 1e-12, "parallel orb");
  equal(parallel?.allowedOrbDegrees, 1.5, "luminary declination orb");

  const contra = detectDeclinationAspect(
    { id: "mars", declinationRadians: 12 * Math.PI / 180 },
    { id: "saturn", declinationRadians: -11.5 * Math.PI / 180 },
  );
  equal(contra?.kind, "contra_parallel", "contra-parallel kind");
  close(contra?.orbDegrees ?? -1, 0.5, 1e-12, "contra-parallel orb");
});

await test("declination detection rejects values outside the explicit orb", () => {
  const aspects = detectDeclinationAspects([
    { id: "mercury", declinationRadians: 10 * Math.PI / 180 },
    { id: "venus", declinationRadians: 11.1 * Math.PI / 180 },
    { id: "mars", declinationRadians: -10.4 * Math.PI / 180 },
  ]);
  equal(aspects.length, 1, "declination aspect count");
  equal(aspects[0]?.kind, "contra_parallel", "remaining declination aspect");
});

await test("stellium uses a maximal conjunction clique", () => {
  const { pattern } = requirePattern("stellium", [0, 2, 4, 100]);
  equal(pattern.points.length, 3, "stellium point count");
  equal(pattern.aspects.length, 3, "stellium conjunction count");
});

await test("T-square and grand cross identify exact hard-aspect structures", () => {
  const tSquare = requirePattern("t_square", [0, 90, 180]).pattern;
  equal(tSquare.focalPoint, "moon", "T-square focal point");
  equal(tSquare.aspects.length, 3, "T-square aspect count");

  const grandCross = requirePattern("grand_cross", [0, 90, 180, 270]).pattern;
  equal(grandCross.modality, "cardinal", "grand-cross modality");
  equal(grandCross.aspects.length, 6, "grand-cross aspect count");
});

await test("grand trine and kite retain their real aspect IDs", () => {
  const grandTrine = requirePattern("grand_trine", [0, 120, 240]).pattern;
  equal(grandTrine.element, "fire", "grand-trine element");
  equal(grandTrine.aspects.length, 3, "grand-trine aspect count");

  const kite = requirePattern("kite", [0, 120, 240, 180]).pattern;
  equal(kite.focalPoint, "venus", "kite focal point");
  equal(kite.aspects.length, 6, "kite aspect count");
  equal(kite.aspects.every((id) => id.includes("_")), true, "kite aspect IDs");
});

await test("Yod and Thor's hammer identify the apex", () => {
  const yod = requirePattern("yod", [0, 60, 210]).pattern;
  equal(yod.focalPoint, "mercury", "Yod apex");
  equal(yod.aspects.length, 3, "Yod aspect count");

  const hammer = requirePattern("thor_hammer", [0, 90, 225]).pattern;
  equal(hammer.focalPoint, "mercury", "Thor's hammer apex");
  equal(hammer.aspects.length, 3, "Thor's hammer aspect count");
});

await test("mystic rectangle requires two oppositions, trines and sextiles", () => {
  const rectangle = requirePattern("mystic_rectangle", [0, 60, 180, 240]).pattern;
  equal(rectangle.aspects.length, 6, "mystic rectangle aspect count");
  equal(rectangle.focalPoint, null, "mystic rectangle focal point");
});

await test("grand sextile requires the complete fifteen-edge structure", () => {
  const sextile = requirePattern("grand_sextile", [0, 60, 120, 180, 240, 300]).pattern;
  equal(sextile.points.length, 6, "grand sextile point count");
  equal(sextile.aspects.length, 15, "grand sextile aspect count");
  close(sextile.strength, 1, 1e-12, "grand sextile strength");
});

console.log(`1..${passed}`);
