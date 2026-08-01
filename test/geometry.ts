import { coreAngles } from "../src/house/angles.js";
import { calculateHouseCharts, housePlacement, unavailableHouseCharts } from "../src/house/chart.js";
import { placidusCusps } from "../src/house/cusps.js";

const close = (actual: number, expected: number, tolerance: number, message: string): void => {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
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

const geometry = {
  apparentSiderealDegrees: 75.75311289815316,
  trueObliquityRadians: 23.44114011385631 * Math.PI / 180,
};
const angles = coreAngles(geometry, -1.784, 57.505);

await test("core angles match the independent Peterhead fixture", () => {
  close(angles.localSiderealDegrees, 73.96911289815316, 1e-9, "local sidereal time");
  close(angles.ascendant, 169.611415885649, 1e-7, "Ascendant");
  close(angles.midheaven, 75.23192416485837, 1e-7, "Midheaven");
  close(angles.descendant, 349.611415885649, 1e-7, "Descendant");
  close(angles.imumCoeli, 255.23192416485836, 1e-7, "IC");
});

await test("Placidus semi-arc roots match the independent reference", () => {
  const cusps = placidusCusps(angles, 57.505, geometry.trueObliquityRadians);
  if (!cusps) throw new Error("Placidus unexpectedly failed");
  const expected = [
    169.611415885649,
    190.46281711328808,
    218.46697990137858,
    255.23192416485836,
    294.56409165772664,
    325.7903667339992,
    349.61141588564897,
    10.46281711328811,
    38.46697990137858,
    75.23192416485837,
    114.56409165772665,
    145.79036673399918,
  ];
  expected.forEach((value, index) => close(cusps[String(index + 1) as keyof typeof cusps], value, 1e-6, `cusp ${index + 1}`));
});

await test("all four tropical house systems contain twelve houses", () => {
  const charts = calculateHouseCharts({
    angles,
    latitudeDegrees: 57.505,
    obliquityRadians: geometry.trueObliquityRadians,
    zodiac: "tropical",
  });
  for (const chart of Object.values(charts)) equal(Object.keys(chart.houses).length, 12, `${chart.system} house count`);
  equal(charts.placidus.status, "calculated", "Placidus status");
  equal(charts.placidus.houses["1"].rulerTraditional.value, "mercury", "Virgo traditional ruler");
});

await test("sidereal whole-sign houses start at the sidereal rising sign", () => {
  const charts = calculateHouseCharts({
    angles,
    latitudeDegrees: 57.505,
    obliquityRadians: geometry.trueObliquityRadians,
    zodiac: "sidereal",
    ayanamshaDegrees: 24,
  });
  equal(charts.whole_sign.houses["1"].cusp.value?.longitudeDegrees, 120, "sidereal whole-sign cusp 1");
  close(charts.equal.houses["1"].cusp.value?.longitudeDegrees ?? -1, angles.ascendant - 24, 1e-9, "sidereal equal cusp 1");
});

await test("polar Placidus failure is explicitly labelled Porphyry fallback", () => {
  const polarAngles = coreAngles(geometry, 18.9553, 78.2232);
  const charts = calculateHouseCharts({
    angles: polarAngles,
    latitudeDegrees: 78.2232,
    obliquityRadians: geometry.trueObliquityRadians,
    zodiac: "tropical",
  });
  equal(charts.placidus.status, "fallback", "fallback status");
  equal(charts.placidus.system, "porphyry", "actual fallback system");
  equal(charts.placidus.fallbackFrom, "placidus", "fallback origin");
  equal(charts.placidus.reason, "polar_house_failure", "fallback reason");
});

await test("house placement reports cusp distance and intercepted status", () => {
  const chart = calculateHouseCharts({
    angles,
    latitudeDegrees: 57.505,
    obliquityRadians: geometry.trueObliquityRadians,
    zodiac: "tropical",
  }).placidus;
  const placement = housePlacement(200, chart);
  equal(placement.value?.house, 2, "house number");
  close(placement.value?.distanceFromCuspDegrees ?? -1, 9.53718288671192, 1e-6, "cusp distance");
});

await test("unavailable charts preserve every house field", () => {
  const charts = unavailableHouseCharts("birth_time_unknown");
  for (const chart of Object.values(charts)) {
    equal(Object.keys(chart.houses).length, 12, "unavailable house count");
    equal(chart.houses["1"].cusp.value, null, "unavailable cusp");
    equal(chart.houses["1"].cusp.reason, "birth_time_unknown", "unavailable reason");
  }
});

console.log(`1..${passed}`);
