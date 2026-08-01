import { calculateAstronomy } from "../src/astro/calculate.js";
import { loadAstronomia } from "../src/astro/astronomia.js";
import { loadLunarOrbit } from "../src/astro/lunarOrbit.js";
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
const candidates = await catalogue.cities("GB", null, "Peterhead");
const selected = candidates.find((candidate) => candidate.name === "Peterhead");
assert(selected, "Pinned place data did not return Peterhead");
const place = await catalogue.get(selected.id);
assert(place.timeZone === "Europe/London", `Unexpected Peterhead time zone: ${place.timeZone}`);
assert(Math.abs(place.latitude - 57.5) < 0.2, `Unexpected Peterhead latitude: ${place.latitude}`);

const resolver = await loadTimeResolver();
const overlap = resolver.resolve({ date: "2025-10-26", time: "01:30:00", zone: "Europe/London" });
assert(overlap.kind === "ambiguous", `London autumn overlap was not detected: ${JSON.stringify(overlap)}`);
const gap = resolver.resolve({ date: "2025-03-30", time: "01:30:00", zone: "Europe/London" });
assert(gap.kind === "nonexistent", `London spring gap was not detected: ${JSON.stringify(gap)}`);

const astronomy = await loadAstronomia();
const input: BirthInput = {
  date: "1991-06-15",
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
close(angles.ascendant, 169.611415885649, 0.00001, "Ascendant");
close(extra.vertex, 336.2768392553082, 0.00001, "Vertex");
close(extra.eastPoint, 162.61072224422642, 0.00001, "East Point");

const lunarOrbit = await loadLunarOrbit();
const orbit = lunarOrbit.sample(time.julianEphemerisDay);
close(orbit.meanNode.longitudeDegrees, 290.37175838276363, 0.02, "mean lunar node");
close(orbit.trueNode.longitudeDegrees, 289.0795438429075, 0.1, "true lunar node");
close(orbit.meanApogee.longitudeDegrees, 275.5535836472449, 0.02, "mean lunar apogee");
close(orbit.trueApogee.longitudeDegrees, 263.88071576723195, 0.2, "osculating lunar apogee");

console.log("Pinned place, time, astronomy and calculated-point integrations passed");
