import { calculateAstronomy } from "../src/astro/calculate.js";
import { loadAstronomia } from "../src/astro/astronomia.js";
import { loadLunarOrbit } from "../src/astro/lunarOrbit.js";
import { loadEclipses } from "../src/eclipse/astronomia.js";
import { auxiliaryAngles, coreAngles } from "../src/house/angles.js";
import { loadCscCatalogue } from "../src/place/csc.js";
import { resolveBirthTime } from "../src/time/calculate.js";
import { loadTimeResolver } from "../src/time/vendor.js";
import type { BirthInput } from "../src/types/base.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const close = (actual: number, expected: number, tolerance: number, message: string): void => {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
};

const catalogue = await loadCscCatalogue();
const candidates = await catalogue.cities("GB", null, "London");
const selected = candidates.find((candidate) => candidate.name === "London");
assert(selected, "Pinned place data did not return the public reference city");
const place = await catalogue.get(selected.id);
assert(place.timeZone === "Europe/London", `Unexpected reference-city time zone: ${place.timeZone}`);
assert(Math.abs(place.latitude - 51.5) < 0.2, `Unexpected reference-city latitude: ${place.latitude}`);

const resolver = await loadTimeResolver();
const overlap = resolver.resolve({ date: "2025-10-26", time: "01:30:00", zone: "Europe/London" });
assert(overlap.kind === "ambiguous", `London autumn overlap was not detected: ${JSON.stringify(overlap)}`);
const gap = resolver.resolve({ date: "2025-03-30", time: "01:30:00", zone: "Europe/London" });
assert(gap.kind === "nonexistent", `London spring gap was not detected: ${JSON.stringify(gap)}`);

const astronomy = await loadAstronomia();
const input: BirthInput = {
  date: "2000-06-15",
  time: "12:30:00",
  timeAccuracy: "exact",
  placeId: place.id,
};
const time = resolveBirthTime(input, place.timeZone, resolver, astronomy);
assert(time.utcIso !== null, "Historical birth time did not resolve to UTC");
assert(time.julianDay !== null && time.julianDay > 2_400_000, "Julian day is implausible");
assert(time.julianEphemerisDay !== null && time.julianEphemerisDay > time.julianDay, "Julian ephemeris day is implausible");

const result = calculateAstronomy(time, astronomy);
for (const [id, body] of Object.entries(result.bodies)) {
  assert(body.eclipticLongitudeDegrees.value !== null, `${id} longitude is unavailable`);
  assert(body.eclipticLongitudeDegrees.value >= 0 && body.eclipticLongitudeDegrees.value < 360, `${id} longitude is outside 0 through 360`);
  assert(body.declinationRadians.value !== null && Math.abs(body.declinationRadians.value) <= Math.PI / 2, `${id} declination is implausible`);
  assert(body.distanceAu.value !== null && body.distanceAu.value > 0, `${id} distance is implausible`);
  assert(body.longitudeSpeedDegreesPerDay.value !== null, `${id} speed is unavailable`);
}

const geometry = astronomy.geometry(time.julianDay, time.julianEphemerisDay);
const angles = coreAngles(geometry, place.longitude, place.latitude);
const extra = auxiliaryAngles(angles, place.latitude, geometry.trueObliquityRadians);
for (const [name, value] of Object.entries({
  ascendant: angles.ascendant,
  vertex: extra.vertex,
  eastPoint: extra.eastPoint,
})) {
  assert(Number.isFinite(value) && value >= 0 && value < 360, `${name} is outside 0 through 360`);
}

const lunarOrbit = await loadLunarOrbit();
const orbit = lunarOrbit.sample(time.julianEphemerisDay);
for (const [name, value] of Object.entries({
  meanNode: orbit.meanNode.longitudeDegrees,
  trueNode: orbit.trueNode.longitudeDegrees,
  meanApogee: orbit.meanApogee.longitudeDegrees,
  trueApogee: orbit.trueApogee.longitudeDegrees,
})) {
  assert(Number.isFinite(value) && value >= 0 && value < 360, `${name} is outside 0 through 360`);
}

const eclipses = await loadEclipses();
const solar = eclipses.sample("solar", 2000.5);
assert(solar !== null, "Pinned eclipse provider returned no solar sample");
assert(solar.activeHalfDurationDays > 0, "Solar eclipse active duration is unavailable");
const lunar = eclipses.sample("lunar", 2000.5);
assert(lunar !== null, "Pinned eclipse provider returned no lunar sample");
assert(lunar.activeHalfDurationDays > 0, "Lunar eclipse active duration is unavailable");

console.log("Pinned place, time, astronomy, calculated-point and eclipse integrations passed");
