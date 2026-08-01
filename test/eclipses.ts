import type { AstronomyPort, BodySample, LunarOrbitPort } from "../src/astro/port.js";
import { calculateEclipses } from "../src/eclipse/calculate.js";
import type { EclipseEventSample, EclipseKind, EclipsePort } from "../src/eclipse/port.js";
import type { TimeData } from "../src/types/base.js";

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

const birthJde = 2_451_545;
const solarEvent: EclipseEventSample = {
  kind: "solar",
  type: "total",
  julianEphemerisDay: birthJde - 0.05,
  magnitude: null,
  activeHalfDurationDays: 3 / 24,
};
const lunarEvent: EclipseEventSample = {
  kind: "lunar",
  type: "partial",
  julianEphemerisDay: birthJde - 10,
  magnitude: 0.75,
  activeHalfDurationDays: 0.08,
};

class FakeEclipses implements EclipsePort {
  readonly provider = { repository: "fixture", revision: "fixture", version: "1" };
  readonly #events: Readonly<Record<EclipseKind, EclipseEventSample | null>>;

  constructor(events: Readonly<Record<EclipseKind, EclipseEventSample | null>>) {
    this.#events = events;
  }

  sample(kind: EclipseKind, _decimalYear: number): EclipseEventSample | null {
    return this.#events[kind];
  }

  decimalYear(_julianEphemerisDay: number): number {
    return 2000;
  }

  utcIso(julianEphemerisDay: number): string {
    return julianEphemerisDay === solarEvent.julianEphemerisDay
      ? "2000-01-01T10:48:00.000Z"
      : "1999-12-22T12:00:00.000Z";
  }
}

const sample = (longitudeDegrees: number): BodySample => ({
  rightAscensionRadians: 0,
  declinationRadians: 0,
  eclipticLongitudeRadians: longitudeDegrees * Math.PI / 180,
  eclipticLatitudeRadians: 0,
  distanceAu: 1,
});

const astronomy: AstronomyPort = {
  provider: { repository: "fixture", revision: "fixture", version: "1" },
  time: () => ({ julianDay: birthJde, julianEphemerisDay: birthJde, deltaTSeconds: 0 }),
  geometry: () => ({ apparentSiderealDegrees: 0, trueObliquityRadians: 0 }),
  sample: (id, jde) => {
    if (id === "sun") return sample(100);
    if (id === "moon") return sample(jde < birthJde - 1 ? 280 : 100.2);
    return sample(0);
  },
};

const lunarOrbit: LunarOrbitPort = {
  sample: () => ({
    meanNode: { longitudeDegrees: 102, speedDegreesPerDay: -0.05 },
    trueNode: { longitudeDegrees: 101, speedDegreesPerDay: -0.04 },
    meanApogee: { longitudeDegrees: 270, speedDegreesPerDay: 0.1 },
    trueApogee: { longitudeDegrees: 268, speedDegreesPerDay: 0.2 },
  }),
};

const exactTime: TimeData = {
  localIso: "2000-01-01T12:00:00",
  utcIso: "2000-01-01T12:00:00.000Z",
  utcOffsetSeconds: 0,
  daylightSaving: false,
  julianDay: birthJde,
  julianEphemerisDay: birthJde,
  deltaTSeconds: 0,
  resolution: {
    status: "exact",
    reason: "none",
    value: {
      fold: null,
      localStartIso: "2000-01-01T12:00:00",
      localEndIso: "2000-01-01T12:00:00",
      utcStartIso: "2000-01-01T12:00:00.000Z",
      utcEndIso: "2000-01-01T12:00:00.000Z",
    },
  },
};

await test("solar eclipse at birth uses the provider active window", () => {
  const result = calculateEclipses({
    time: exactTime,
    astronomy,
    lunarOrbit,
    eclipses: new FakeEclipses({ solar: solarEvent, lunar: lunarEvent }),
    ayanamsha: "lahiri",
  });
  equal(result.atBirth.value?.kind, "solar", "natal eclipse kind");
  equal(result.atBirth.value?.type, "total", "natal eclipse type");
  close(result.atBirth.value?.birthOffsetSeconds ?? -1, 4_320, 1e-6, "birth offset");
  equal(result.atBirth.value?.node, "north", "natal eclipse node");
  close(result.atBirth.value?.sunMoonAngleDegrees ?? -1, 0.2, 1e-9, "solar eclipse angle");
});

await test("latest prenatal solar and lunar eclipses remain separate", () => {
  const result = calculateEclipses({
    time: exactTime,
    astronomy,
    lunarOrbit,
    eclipses: new FakeEclipses({ solar: solarEvent, lunar: lunarEvent }),
    ayanamsha: "lahiri",
  });
  close(result.prenatalSolar.value?.daysBeforeBirth ?? -1, 0.05, 1e-9, "solar days before birth");
  close(result.prenatalLunar.value?.daysBeforeBirth ?? -1, 10, 1e-9, "lunar days before birth");
  equal(result.prenatalSolar.value?.node, "north", "solar node");
  equal(result.prenatalLunar.value?.node, "south", "lunar node");
  equal(result.prenatalSolar.value?.tropicalPosition.sign, "cancer", "solar tropical sign");
  equal(result.prenatalLunar.value?.tropicalPosition.sign, "capricorn", "lunar tropical sign");
  equal(
    result.prenatalSolar.value?.siderealPosition.longitudeDegrees === result.prenatalSolar.value?.tropicalPosition.longitudeDegrees,
    false,
    "sidereal eclipse position must shift independently",
  );
});

await test("lunar eclipse birth coincidence uses calculated penumbral duration", () => {
  const nearLunar: EclipseEventSample = {
    ...lunarEvent,
    julianEphemerisDay: birthJde - 0.04,
    activeHalfDurationDays: 0.05,
  };
  const farSolar: EclipseEventSample = {
    ...solarEvent,
    julianEphemerisDay: birthJde - 0.2,
  };
  const result = calculateEclipses({
    time: exactTime,
    astronomy,
    lunarOrbit,
    eclipses: new FakeEclipses({ solar: farSolar, lunar: nearLunar }),
    ayanamsha: "raman",
  });
  equal(result.atBirth.value?.kind, "lunar", "lunar natal eclipse kind");
  equal(result.atBirth.value?.type, "partial", "lunar natal eclipse type");
});

await test("unknown birth time never invents eclipse timing", () => {
  const unknown: TimeData = {
    localIso: null,
    utcIso: null,
    utcOffsetSeconds: null,
    daylightSaving: null,
    julianDay: null,
    julianEphemerisDay: null,
    deltaTSeconds: null,
    resolution: { status: "unavailable", value: null, reason: "birth_time_unknown" },
  };
  const result = calculateEclipses({
    time: unknown,
    astronomy,
    lunarOrbit,
    eclipses: new FakeEclipses({ solar: solarEvent, lunar: lunarEvent }),
    ayanamsha: "fagan_bradley",
  });
  equal(result.atBirth.value, null, "unknown natal eclipse");
  equal(result.prenatalSolar.reason, "birth_time_unknown", "unknown prenatal solar reason");
  equal(result.prenatalLunar.reason, "birth_time_unknown", "unknown prenatal lunar reason");
});

console.log(`1..${passed}`);
