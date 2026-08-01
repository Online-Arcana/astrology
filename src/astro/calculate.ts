import type { CalcReason, TimeData } from "../types/base.js";
import type { AstronomyData, BodyState, PlanetId } from "../types/astro.js";
import { normaliseDegrees } from "../zodiac/position.js";
import type { AstronomyPort, BodySample } from "./port.js";

const ids = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const radToDeg = 180 / Math.PI;
const exact = <T>(value: T) => ({ status: "exact" as const, value, reason: "none" as const });
const unavailable = <T>(reason: CalcReason) => ({ status: "unavailable" as const, value: null as T | null, reason });

const unavailableBody = (id: PlanetId, reason: CalcReason): BodyState => ({
  id,
  rightAscensionRadians: unavailable<number>(reason),
  declinationRadians: unavailable<number>(reason),
  eclipticLongitudeDegrees: unavailable<number>(reason),
  eclipticLatitudeDegrees: unavailable<number>(reason),
  distanceAu: unavailable<number>(reason),
  longitudeSpeedDegreesPerDay: unavailable<number>(reason),
  motion: "unknown",
});

const signedDelta = (after: number, before: number): number => {
  let value = normaliseDegrees(after - before);
  if (value > 180) value -= 360;
  return value;
};

const finite = (sample: BodySample): void => {
  for (const value of Object.values(sample)) {
    if (!Number.isFinite(value)) throw new Error("Astronomia returned a non-finite body value");
  }
  if (sample.distanceAu <= 0) throw new Error("Astronomia returned a non-positive distance");
};

const body = (id: PlanetId, jde: number, port: AstronomyPort): BodyState => {
  const current = port.sample(id, jde);
  const before = port.sample(id, jde - 0.5);
  const after = port.sample(id, jde + 0.5);
  finite(current);
  finite(before);
  finite(after);
  const longitude = normaliseDegrees(current.eclipticLongitudeRadians * radToDeg);
  const speed = signedDelta(after.eclipticLongitudeRadians * radToDeg, before.eclipticLongitudeRadians * radToDeg);
  const motion = Math.abs(speed) <= 0.005 ? "stationary" : speed > 0 ? "direct" : "retrograde";
  return {
    id,
    rightAscensionRadians: exact(current.rightAscensionRadians),
    declinationRadians: exact(current.declinationRadians),
    eclipticLongitudeDegrees: exact(longitude),
    eclipticLatitudeDegrees: exact(current.eclipticLatitudeRadians * radToDeg),
    distanceAu: exact(current.distanceAu),
    longitudeSpeedDegreesPerDay: exact(speed),
    motion,
  };
};

export const calculateAstronomy = (time: TimeData, port: AstronomyPort): AstronomyData => {
  const bodies = {} as Record<PlanetId, BodyState>;
  if (time.julianEphemerisDay === null) {
    const reason = time.resolution.reason === "none" ? "insufficient_data" : time.resolution.reason;
    for (const id of ids) bodies[id] = unavailableBody(id, reason);
  } else {
    for (const id of ids) bodies[id] = body(id, time.julianEphemerisDay, port);
  }
  return {
    frame: { centre: "geocentric", coordinates: "apparent", epoch: "date" },
    bodies,
  };
};
