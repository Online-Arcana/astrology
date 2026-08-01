import { calculateAstronomy } from "../src/astro/calculate.js";
import { loadAstronomia } from "../src/astro/astronomia.js";
import { loadCscCatalogue } from "../src/place/csc.js";
import { resolveBirthTime } from "../src/time/calculate.js";
import { loadTimeResolver } from "../src/time/vendor.js";
import type { BirthInput } from "../src/types/base.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
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
assert(overlap.kind === "ambiguous", "London autumn overlap was not detected");
const gap = resolver.resolve({ date: "2025-03-30", time: "01:30:00", zone: "Europe/London" });
assert(gap.kind === "nonexistent", "London spring gap was not detected");

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

console.log("Pinned place, time and astronomy integrations passed");
