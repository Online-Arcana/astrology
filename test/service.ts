import { CalculationService, type CalculationPorts } from "../src/calculate/service.js";
import { compatibilityDomains } from "../src/compat/catalogue.js";
import type { AstronomyPort, BodySample, LunarOrbitPort } from "../src/astro/port.js";
import type { EclipseKind, EclipsePort } from "../src/eclipse/port.js";
import type { PlaceData } from "../src/types/base.js";
import type { PlanetId } from "../src/types/astro.js";
import type { TimeResolver } from "../src/time/model.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const place: PlaceData = {
  id: "fixture:place",
  continent: "Europe",
  subcontinent: "Northern Europe",
  country: { code: "GB", name: "United Kingdom" },
  region: { code: "TST", name: "Fixture" },
  city: { name: "Testville" },
  latitude: 10,
  longitude: -1,
  elevationMetres: 20,
  timeZone: "Europe/London",
};

const timeResolver: TimeResolver = {
  info: {
    provider: "fixture",
    providerVersion: "1",
    dataVersion: "2026a",
    supportedRange: "1900-01-01/2100-12-31",
    calendar: "proleptic_gregorian",
  },
  resolve: ({ date, time }) => {
    const localIso = `${date}T${time}`;
    if (date === "1991-06-15" && time === "12:30:00") {
      return {
        kind: "exact",
        localIso,
        candidate: {
          fold: null,
          utcIso: "1991-06-15T11:30:00Z",
          offsetSeconds: 3600,
          daylightSaving: true,
        },
      };
    }
    if (date === "1991-06-15" && time === "00:00:00") {
      return {
        kind: "exact",
        localIso,
        candidate: {
          fold: null,
          utcIso: "1991-06-14T23:00:00Z",
          offsetSeconds: 3600,
          daylightSaving: true,
        },
      };
    }
    if (date === "1991-06-16" && time === "00:00:00") {
      return {
        kind: "exact",
        localIso,
        candidate: {
          fold: null,
          utcIso: "1991-06-15T23:00:00Z",
          offsetSeconds: 3600,
          daylightSaving: true,
        },
      };
    }
    return { kind: "unsupported", localIso, reason: "fixture input" };
  },
};

const planetIds = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const planetIndex = new Map<PlanetId, number>(planetIds.map((id, index) => [id, index]));
const referenceJde = 2_448_422.979;

const bodySample = (id: PlanetId, jde: number): BodySample => {
  const index = planetIndex.get(id) as number;
  const speed = id === "mercury" || id === "saturn" ? -0.4 : id === "moon" ? 13 : 0.8;
  const degrees = index * 31 + (jde - referenceJde) * speed;
  return {
    rightAscensionRadians: degrees * Math.PI / 180,
    declinationRadians: (-15 + index * 3) * Math.PI / 180,
    eclipticLongitudeRadians: degrees * Math.PI / 180,
    eclipticLatitudeRadians: (index - 4) * 0.001,
    distanceAu: 0.1 + index,
  };
};

const isoJde: Readonly<Record<string, number>> = {
  "1991-06-14T23:00:00Z": referenceJde - 0.5208333333,
  "1991-06-15T11:30:00Z": referenceJde,
  "1991-06-15T23:00:00Z": referenceJde + 0.4791666667,
};

const astronomy: AstronomyPort = {
  provider: { repository: "fixture", revision: "fixture", version: "1" },
  time: (utcIso) => {
    const julianEphemerisDay = isoJde[utcIso];
    if (julianEphemerisDay === undefined) throw new Error(`Unknown fixture instant ${utcIso}`);
    return {
      julianDay: julianEphemerisDay - 0.0007,
      julianEphemerisDay,
      deltaTSeconds: 60.48,
    };
  },
  geometry: () => ({
    apparentSiderealDegrees: 75.75311289815316,
    trueObliquityRadians: 23.44114011385631 * Math.PI / 180,
  }),
  sample: bodySample,
};

const lunarOrbit: LunarOrbitPort = {
  sample: () => ({
    meanNode: { longitudeDegrees: 290, speedDegreesPerDay: -0.053 },
    trueNode: { longitudeDegrees: 289, speedDegreesPerDay: -0.04 },
    meanApogee: { longitudeDegrees: 276, speedDegreesPerDay: 0.111 },
    trueApogee: { longitudeDegrees: 264, speedDegreesPerDay: -2.5 },
  }),
};

const eclipses: EclipsePort = {
  provider: { repository: "fixture", revision: "fixture", version: "1" },
  sample: (_kind: EclipseKind, _decimalYear: number) => null,
  decimalYear: () => 1991.45,
  utcIso: () => "1991-01-01T00:00:00.000Z",
};

let generated = 0;
const ports: CalculationPorts = {
  places: { get: async () => place },
  timeResolver,
  astronomy,
  lunarOrbit,
  eclipses,
  version: "0.10.0",
  now: () => `2026-08-01T12:00:0${generated++}.000Z`,
};

const service = new CalculationService(ports);
const options = {
  primaryZodiac: "tropical" as const,
  ayanamsha: "lahiri" as const,
  interpretationMode: "both" as const,
};

await test("exact calculation assembles both complete zodiac systems", async () => {
  const result = await service.calculate({
    date: "1991-06-15",
    time: "12:30:00",
    timeAccuracy: "exact",
    placeId: place.id,
    name: "Test Subject",
    lang: "en-GB",
  }, options);
  equal(result.schema, "astral-calculation/1.0.0", "calculation schema");
  equal(Object.keys(result.systems.tropical.points).length, 25, "tropical point count");
  equal(Object.keys(result.systems.sidereal.points).length, 25, "sidereal point count");
  assert(result.systems.tropical.points.ascendant.position.value !== null, "exact Ascendant");
  equal(result.systems.tropical.houses.placidus.status, "calculated", "exact Placidus houses");
  equal(Object.keys(result.compatibility.tropical.domains).length, compatibilityDomains.length, "compatibility domain count");
  equal(result.compatibility.tropical.domains.romantic.ranked.length, 12, "romantic sign count");
  assert(result.provenance.calculationFingerprint.startsWith("sha256:"), "fingerprint prefix");
});

await test("fingerprint excludes generation time but covers deterministic output", async () => {
  const input = {
    date: "1991-06-15",
    time: "12:30:00",
    timeAccuracy: "exact" as const,
    placeId: place.id,
  };
  const first = await service.calculate(input, options);
  const second = await service.calculate(input, options);
  equal(first.provenance.calculationFingerprint, second.provenance.calculationFingerprint, "stable fingerprint");
  assert(first.provenance.generatedAt !== second.provenance.generatedAt, "generation timestamps should differ");
});

await test("approximate time propagates through angles houses sect and lots", async () => {
  const result = await service.calculate({
    date: "1991-06-15",
    time: "12:30:00",
    timeAccuracy: "approximate",
    placeId: place.id,
  }, options);
  equal(result.systems.tropical.points.ascendant.position.status, "approximate", "approximate Ascendant");
  equal(result.systems.tropical.houses.placidus.houses["1"].cusp.status, "approximate", "approximate house cusp");
  equal(result.systems.tropical.derived.sect.status, "approximate", "approximate sect");
  equal(result.systems.tropical.points.part_of_fortune.position.status, "approximate", "approximate Fortune");
  equal(result.warnings.some((warning) => warning.code === "birth_time_approximate"), true, "approximate warning");
});

await test("unknown time keeps bounded planets but never invents timed geometry", async () => {
  const result = await service.calculate({
    date: "1991-06-15",
    time: null,
    timeAccuracy: "unknown",
    placeId: place.id,
  }, options);
  equal(result.time.resolution.status, "bounded", "unknown-time civil window");
  equal(result.astronomy.bodies.sun.eclipticLongitudeDegrees.status, "bounded", "bounded Sun");
  equal(result.astronomy.bodies.moon.eclipticLongitudeDegrees.status, "bounded", "bounded Moon");
  equal(result.systems.tropical.points.north_node_true.position.status, "bounded", "bounded true node");
  equal(result.systems.tropical.points.ascendant.position.value, null, "unknown Ascendant");
  equal(result.systems.tropical.houses.placidus.status, "unavailable", "unknown houses");
  equal(result.systems.tropical.derived.chartRuler.traditional.value, null, "unknown chart ruler");
  equal(result.compatibility.tropical.domains.overall.ranked.length, 12, "unknown-time compatibility");
  equal(result.warnings.some((warning) => warning.code === "birth_time_unknown"), true, "unknown-time warning");
});

await test("interpretation plan is fixed field-by-field and source-bounded", async () => {
  const result = await service.calculate({
    date: "1991-06-15",
    time: "12:30:00",
    timeAccuracy: "exact",
    placeId: place.id,
  }, options);
  const ids = result.interpretationPlan.units.map(({ id }) => id);
  equal(new Set(ids).size, ids.length, "unique interpretation units");
  equal(ids.includes("tropical.point.sun"), true, "Sun interpretation unit");
  equal(ids.includes("sidereal.life.sexuality"), true, "sidereal sexuality unit");
  equal(ids.includes("tropical.compatibility.romantic.aries"), true, "romantic Aries unit");
  equal(ids.includes("tropical.compatibility.sexual.aries"), true, "sexual Aries unit");
  equal(ids.includes("final-synthesis"), true, "final synthesis unit");
  equal(
    result.interpretationPlan.units.every((unit) => unit.allowedSourceRefs.length > 0),
    true,
    "all units have source boundaries",
  );
});

console.log(`1..${passed}`);
