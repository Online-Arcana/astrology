import { boundRuler, calculateDignity, faceRuler } from "../src/dignity/calculate.js";
import { egyptianBounds } from "../src/dignity/catalogue.js";
import type { Calc } from "../src/types/base.js";
import type { SignPosition } from "../src/types/astro.js";
import { ayanamshaDegrees } from "../src/zodiac/ayanamsha.js";
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

const exact = <T>(value: T): Calc<T> => ({ status: "exact", value, reason: "none" });
const day = exact("day" as const);
const night = exact("night" as const);
const position = (longitude: number): Calc<SignPosition> => exact(signPosition(longitude));

await test("all four ayanamshas preserve their J2000 reference", () => {
  close(ayanamshaDegrees(2_451_545, "fagan_bradley"), 24.740299966181, 1e-12, "Fagan-Bradley J2000");
  close(ayanamshaDegrees(2_451_545, "lahiri"), 23.857092325455, 1e-12, "Lahiri J2000");
  close(ayanamshaDegrees(2_451_545, "krishnamurti"), 23.760240012073, 1e-12, "Krishnamurti J2000");
  close(ayanamshaDegrees(2_451_545, "raman"), 22.410791012073, 1e-12, "Raman J2000");
});

await test("ayanamsha precession matches the 2000 reference fixture", () => {
  const jde = 2_448_422.979837963;
  close(ayanamshaDegrees(jde, "fagan_bradley"), 24.6208943500329, 1e-10, "Fagan-Bradley 2000");
  close(ayanamshaDegrees(jde, "lahiri"), 23.7376867093069, 1e-10, "Lahiri 2000");
  close(ayanamshaDegrees(jde, "krishnamurti"), 23.6408343959249, 1e-10, "Krishnamurti 2000");
  close(ayanamshaDegrees(jde, "raman"), 22.2913853959249, 1e-10, "Raman 2000");
});

await test("Egyptian bounds cover each sign contiguously", () => {
  for (const [sign, segments] of Object.entries(egyptianBounds)) {
    equal(segments.length, 5, `${sign} segment count`);
    let cursor = 0;
    for (const segment of segments) {
      equal(segment.start, cursor, `${sign} bound start`);
      if (segment.end <= segment.start) throw new Error(`${sign} bound must be positive`);
      cursor = segment.end;
    }
    equal(cursor, 30, `${sign} bound coverage`);
  }
});

await test("Egyptian bound boundaries are left-closed and right-open", () => {
  equal(boundRuler(signPosition(5.999999)), "jupiter", "late Jupiter bound");
  equal(boundRuler(signPosition(6)), "venus", "Venus boundary");
  equal(boundRuler(signPosition(12)), "mercury", "Mercury boundary");
});

await test("Chaldean faces begin Mars Sun Venus then continue into Taurus", () => {
  equal(faceRuler(signPosition(0)), "mars", "first Aries face");
  equal(faceRuler(signPosition(10)), "sun", "second Aries face");
  equal(faceRuler(signPosition(20)), "venus", "third Aries face");
  equal(faceRuler(signPosition(30)), "mercury", "first Taurus face");
});

await test("exaltation, day triplicity and face scores combine without false domicile", () => {
  const dignity = calculateDignity("sun", position(15), day).value;
  equal(dignity?.domicile, false, "Sun domicile");
  equal(dignity?.exalted, true, "Sun exaltation");
  equal(dignity?.triplicityRuler, true, "Sun triplicity");
  equal(dignity?.faceRuler, true, "Sun face");
  equal(dignity?.score, 8, "Sun dignity score");
});

await test("domicile and Egyptian bound scores combine", () => {
  const dignity = calculateDignity("mars", position(22), day).value;
  equal(dignity?.domicile, true, "Mars domicile");
  equal(dignity?.boundRuler, true, "Mars bound");
  equal(dignity?.score, 7, "Mars dignity score");
});

await test("Dorothean triplicity changes with sect", () => {
  const byNight = calculateDignity("jupiter", position(3), night).value;
  const byDay = calculateDignity("jupiter", position(3), day).value;
  equal(byNight?.triplicityRuler, true, "Jupiter night triplicity");
  equal(byNight?.score, 5, "Jupiter night score");
  equal(byDay?.triplicityRuler, false, "Jupiter day triplicity");
  equal(byDay?.score, 2, "Jupiter day score");
});

await test("participating triplicity remains active in either sect", () => {
  const dignity = calculateDignity("saturn", position(3), day).value;
  equal(dignity?.triplicityRuler, true, "Saturn participating triplicity");
  equal(dignity?.fallen, true, "Saturn fall");
  equal(dignity?.score, -3, "Saturn combined score");
});

await test("modern co-rulership does not become traditional domicile", () => {
  const dignity = calculateDignity("uranus", position(305), day).value;
  equal(dignity?.traditionalRuler, "saturn", "Aquarius traditional ruler");
  equal(dignity?.modernRuler, "uranus", "Aquarius modern co-ruler");
  equal(dignity?.domicile, false, "Uranus traditional domicile");
  equal(dignity?.peregrine, true, "Uranus peregrine");
  equal(dignity?.score, 0, "Uranus score");
});

await test("unknown sect returns a conservative bounded dignity", () => {
  const dignity = calculateDignity(
    "jupiter",
    position(3),
    { status: "unavailable", value: null, reason: "birth_time_unknown" },
  );
  equal(dignity.status, "bounded", "unknown-sect status");
  equal(dignity.reason, "birth_time_unknown", "unknown-sect reason");
  equal(dignity.value?.triplicityRuler, false, "unconfirmed triplicity");
  equal(dignity.value?.boundRuler, true, "certain bound dignity");
  equal(dignity.value?.score, 2, "conservative score");
});

console.log(`1..${passed}`);
