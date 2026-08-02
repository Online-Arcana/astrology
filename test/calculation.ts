import { calculateAstronomy } from "../src/astro/calculate.js";
import type { AstronomyPort } from "../src/astro/port.js";
import { CscCatalogue } from "../src/place/csc.js";
import type { CscApi, CscCity, CscCountryMeta, CscRegion } from "../src/place/model.js";
import { placeId } from "../src/place/normalise.js";
import { resolveBirthTime } from "../src/time/calculate.js";
import type { CivilResolution, TimeResolver } from "../src/time/model.js";
import type { BirthInput, TimeData } from "../src/types/base.js";
import type { PlanetId } from "../src/types/astro.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const countries: CscCountryMeta[] = [
  { id: 1, name: "United Kingdom", iso2: "GB", region: "Europe", subregion: "Northern Europe", timezones: [{ zoneName: "Europe/London" }] },
  { id: 2, name: "United States", iso2: "US", region: "Americas", subregion: "Northern America", timezones: [] },
];
const regions: CscRegion[] = [
  { id: 10, name: "England", country_code: "GB", iso2: "ENG", timezone: "Europe/London" },
  { id: 20, name: "Massachusetts", country_code: "US", iso2: "MA", timezone: "America/New_York" },
];
const cities: CscCity[] = [
  { id: 100, name: "London", state_id: 10, state_code: "ENG", country_code: "GB", latitude: "51.5074", longitude: "-0.1278", timezone: "Europe/London" },
  { id: 101, name: "Cambridge", state_id: 10, state_code: "ENG", country_code: "GB", latitude: "52.2053", longitude: "0.1218", timezone: "Europe/London" },
  { id: 200, name: "Cambridge", state_id: 20, state_code: "MA", country_code: "US", latitude: "42.3736", longitude: "-71.1097", timezone: "America/New_York" },
];

const api: CscApi = {
  getCountries: async () => countries,
  getCountryByCode: async (code) => countries.find((country) => country.iso2 === code) ?? null,
  getStatesOfCountry: async (countryCode) => regions.filter((region) => region.country_code === countryCode),
  getStateByCode: async (countryCode, regionCode) => regions.find((region) => region.country_code === countryCode && region.iso2 === regionCode) ?? null,
  getCitiesOfState: async (countryCode, regionCode) => cities.filter((city) => city.country_code === countryCode && city.state_code === regionCode),
  getAllCitiesOfCountry: async (countryCode) => cities.filter((city) => city.country_code === countryCode),
};

await test("place hierarchy normalises a selected city", async () => {
  const catalogue = new CscCatalogue(api);
  const matches = await catalogue.cities("GB", "ENG", "lond");
  equal(matches.length, 1, "city search count");
  equal(matches[0]?.id, "csc:GB:ENG:100", "stable place id");
  const place = await catalogue.get(matches[0]?.id as string);
  equal(place.city.name, "London", "city name");
  equal(place.timeZone, "Europe/London", "IANA timezone");
  equal(place.continent, "Europe", "continent");
});

await test("duplicate city names remain distinct selections", async () => {
  const catalogue = new CscCatalogue(api);
  const uk = await catalogue.cities("GB", "ENG", "Cambridge");
  const us = await catalogue.cities("US", "MA", "Cambridge");
  assert(uk[0]?.id !== us[0]?.id, "duplicate cities must have different IDs");
  equal(uk[0]?.id, placeId("GB", "ENG", 101), "UK Cambridge ID");
  equal(us[0]?.id, placeId("US", "MA", 200), "US Cambridge ID");
});

const resolver = (resolution: CivilResolution): TimeResolver => ({
  info: { provider: "test", providerVersion: "1", dataVersion: "1", supportedRange: "1900/2100", calendar: "proleptic_gregorian" },
  resolve: () => resolution,
});
const clock = {
  time: () => ({ julianDay: 2440000.5, julianEphemerisDay: 2440000.5005, deltaTSeconds: 43.2 }),
};
const birth = (timeAccuracy: BirthInput["timeAccuracy"], time: string | null): BirthInput => ({
  date: "2000-06-15",
  time,
  timeAccuracy,
  placeId: "csc:GB:ENG:100",
});

await test("exact historical time produces UTC, JD and JDE", () => {
  const result = resolveBirthTime(birth("exact", "12:30:00"), "Europe/London", resolver({
    kind: "exact",
    localIso: "2000-06-15T12:30:00",
    candidate: { fold: null, utcIso: "2000-06-15T11:30:00Z", offsetSeconds: 3600, daylightSaving: true },
  }), clock);
  equal(result.utcIso, "2000-06-15T11:30:00Z", "UTC instant");
  equal(result.julianDay, 2440000.5, "Julian day");
  equal(result.resolution.status, "exact", "resolution status");
});

await test("approximate time remains explicitly approximate", () => {
  const result = resolveBirthTime(birth("approximate", "12:30:00"), "Europe/London", resolver({
    kind: "exact",
    localIso: "2000-06-15T12:30:00",
    candidate: { fold: null, utcIso: "2000-06-15T11:30:00Z", offsetSeconds: 3600, daylightSaving: true },
  }), clock);
  equal(result.resolution.status, "approximate", "approximate status");
  equal(result.resolution.reason, "birth_time_approximate", "approximate reason");
});

await test("unknown time preserves the complete civil-day interval without inventing an instant", () => {
  const dateResolver: TimeResolver = {
    info: { provider: "test", providerVersion: "1", dataVersion: "1", supportedRange: "1900/2100", calendar: "proleptic_gregorian" },
    resolve: ({ date, time }) => ({
      kind: "exact",
      localIso: `${date}T${time}`,
      candidate: {
        fold: null,
        utcIso: date === "2000-06-15" ? "2000-06-14T23:00:00Z" : "2000-06-15T23:00:00Z",
        offsetSeconds: 3600,
        daylightSaving: true,
      },
    }),
  };
  const result = resolveBirthTime(birth("unknown", null), "Europe/London", dateResolver, clock);
  equal(result.utcIso, null, "unknown UTC instant");
  equal(result.julianDay, null, "unknown Julian instant");
  equal(result.resolution.status, "bounded", "unknown status");
  equal(result.resolution.reason, "birth_time_unknown", "unknown reason");
  equal(result.resolution.value?.utcStartIso, "2000-06-14T23:00:00Z", "civil-day start");
  equal(result.resolution.value?.utcEndIso, "2000-06-15T23:00:00Z", "civil-day end");
});

await test("DST overlap is bounded rather than silently selected", () => {
  const result = resolveBirthTime(birth("exact", "01:30:00"), "Europe/London", resolver({
    kind: "ambiguous",
    localIso: "2025-10-26T01:30:00",
    candidates: [
      { fold: 0, utcIso: "2025-10-26T00:30:00Z", offsetSeconds: 3600, daylightSaving: true },
      { fold: 1, utcIso: "2025-10-26T01:30:00Z", offsetSeconds: 0, daylightSaving: false },
    ],
  }), clock);
  equal(result.utcIso, null, "ambiguous UTC");
  equal(result.resolution.status, "bounded", "ambiguous status");
  equal(result.resolution.value?.utcStartIso, "2025-10-26T00:30:00Z", "earlier candidate");
  equal(result.resolution.value?.utcEndIso, "2025-10-26T01:30:00Z", "later candidate");
});

await test("DST gap is unavailable", () => {
  const result = resolveBirthTime(birth("exact", "01:30:00"), "Europe/London", resolver({
    kind: "nonexistent",
    localIso: "2025-03-30T01:30:00",
    beforeUtcIso: "2025-03-30T00:59:59Z",
    afterUtcIso: "2025-03-30T01:00:00Z",
  }), clock);
  equal(result.resolution.status, "unavailable", "gap status");
  equal(result.resolution.reason, "nonexistent_local_time", "gap reason");
});

const planetIds = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const index = new Map<PlanetId, number>(planetIds.map((id, at) => [id, at]));
const astronomy: AstronomyPort = {
  provider: { repository: "test", revision: "1", version: "1" },
  time: clock.time,
  geometry: () => ({ apparentSiderealDegrees: 0, trueObliquityRadians: 23.4 * Math.PI / 180 }),
  sample: (id, jde) => {
    const at = index.get(id) ?? 0;
    const direction = id === "mercury" ? -1 : 1;
    const longitude = at * 0.4 + direction * (jde - 100) * 0.02;
    return {
      rightAscensionRadians: longitude,
      declinationRadians: at * 0.01,
      eclipticLongitudeRadians: longitude,
      eclipticLatitudeRadians: at * 0.001,
      distanceAu: 0.1 + at,
    };
  },
};
const exactTime: TimeData = {
  localIso: "2000-06-15T12:30:00",
  utcIso: "2000-06-15T11:30:00Z",
  utcOffsetSeconds: 3600,
  daylightSaving: true,
  julianDay: 99.9,
  julianEphemerisDay: 100,
  deltaTSeconds: 43.2,
  resolution: {
    status: "exact",
    reason: "none",
    value: { fold: null, localStartIso: "2000-06-15T12:30:00", localEndIso: "2000-06-15T12:30:00", utcStartIso: "2000-06-15T11:30:00Z", utcEndIso: "2000-06-15T11:30:00Z" },
  },
};

await test("astronomy calculation fills every required body", () => {
  const result = calculateAstronomy(exactTime, astronomy);
  equal(Object.keys(result.bodies).length, 10, "body count");
  equal(result.bodies.mercury.motion, "retrograde", "Mercury motion");
  equal(result.bodies.sun.motion, "direct", "Sun motion");
  assert(result.bodies.pluto.distanceAu.value !== null, "Pluto distance must be present");
  equal(result.frame.coordinates, "apparent", "reference frame");
});

await test("date-only astronomy retains bounded planetary positions", () => {
  const boundedPort: AstronomyPort = {
    ...astronomy,
    time: (utcIso) => {
      const jde = utcIso.startsWith("2000-06-14") ? 99.5 : 100.5;
      return { julianDay: jde - 0.0005, julianEphemerisDay: jde, deltaTSeconds: 43.2 };
    },
  };
  const unknown: TimeData = {
    localIso: null, utcIso: null, utcOffsetSeconds: null, daylightSaving: null,
    julianDay: null, julianEphemerisDay: null, deltaTSeconds: null,
    resolution: {
      status: "bounded",
      reason: "birth_time_unknown",
      value: {
        fold: null,
        localStartIso: "2000-06-15T00:00:00",
        localEndIso: "2000-06-16T00:00:00",
        utcStartIso: "2000-06-14T23:00:00Z",
        utcEndIso: "2000-06-15T23:00:00Z",
      },
    },
  };
  const result = calculateAstronomy(unknown, boundedPort);
  assert(result.bodies.sun.eclipticLongitudeDegrees.value !== null, "bounded Sun longitude");
  assert(result.bodies.moon.eclipticLongitudeDegrees.value !== null, "bounded Moon longitude");
  equal(result.bodies.sun.eclipticLongitudeDegrees.status, "bounded", "bounded Sun status");
  equal(result.bodies.moon.eclipticLongitudeDegrees.reason, "birth_time_unknown", "bounded Moon reason");
});

await test("astronomy preserves true unavailability when no civil window exists", () => {
  const unavailableTime: TimeData = {
    localIso: null, utcIso: null, utcOffsetSeconds: null, daylightSaving: null,
    julianDay: null, julianEphemerisDay: null, deltaTSeconds: null,
    resolution: { status: "unavailable", value: null, reason: "nonexistent_local_time" },
  };
  const result = calculateAstronomy(unavailableTime, astronomy);
  equal(result.bodies.sun.eclipticLongitudeDegrees.value, null, "unavailable Sun longitude");
  equal(result.bodies.sun.eclipticLongitudeDegrees.reason, "nonexistent_local_time", "unavailable reason");
});

console.log(`1..${passed}`);
