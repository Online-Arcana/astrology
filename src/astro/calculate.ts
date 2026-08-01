import type { CalcReason, CalcStatus, TimeData } from "../types/base.js";
import type { AstronomyData, BodyState, PlanetId } from "../types/astro.js";
import { normaliseDegrees } from "../zodiac/position.js";
import type { AstronomyPort, BodySample } from "./port.js";

const ids = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const radToDeg = 180 / Math.PI;
type AvailableStatus = Extract<CalcStatus, "exact" | "approximate" | "bounded">;

const calculated = <T>(status: AvailableStatus, value: T, reason: CalcReason) => ({ status, value, reason });
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

const speedAt = (id: PlanetId, jde: number, port: AstronomyPort): number => {
  const before = port.sample(id, jde - 0.5);
  const after = port.sample(id, jde + 0.5);
  finite(before);
  finite(after);
  return signedDelta(after.eclipticLongitudeRadians * radToDeg, before.eclipticLongitudeRadians * radToDeg);
};

const motionFromSpeed = (speed: number): BodyState["motion"] =>
  Math.abs(speed) <= 0.005 ? "stationary" : speed > 0 ? "direct" : "retrograde";

const body = (
  id: PlanetId,
  jde: number,
  port: AstronomyPort,
  status: AvailableStatus,
  reason: CalcReason,
  interval: readonly [number, number] | null = null,
): BodyState => {
  const current = port.sample(id, jde);
  finite(current);
  const speed = speedAt(id, jde, port);
  let motion = motionFromSpeed(speed);
  if (interval) {
    const startMotion = motionFromSpeed(speedAt(id, interval[0], port));
    const endMotion = motionFromSpeed(speedAt(id, interval[1], port));
    if (startMotion !== endMotion) motion = "unknown";
    else motion = startMotion;
  }
  return {
    id,
    rightAscensionRadians: calculated(status, current.rightAscensionRadians, reason),
    declinationRadians: calculated(status, current.declinationRadians, reason),
    eclipticLongitudeDegrees: calculated(status, normaliseDegrees(current.eclipticLongitudeRadians * radToDeg), reason),
    eclipticLatitudeDegrees: calculated(status, current.eclipticLatitudeRadians * radToDeg, reason),
    distanceAu: calculated(status, current.distanceAu, reason),
    longitudeSpeedDegreesPerDay: calculated(status, speed, reason),
    motion,
  };
};

const boundedInterval = (time: TimeData, port: AstronomyPort): readonly [number, number] | null => {
  const value = time.resolution.value;
  if (!value) return null;
  const start = port.time(value.utcStartIso).julianEphemerisDay;
  const end = port.time(value.utcEndIso).julianEphemerisDay;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Invalid bounded Julian interval");
  return [start, end];
};

export const calculateAstronomy = (time: TimeData, port: AstronomyPort): AstronomyData => {
  const bodies = {} as Record<PlanetId, BodyState>;
  if (time.julianEphemerisDay !== null) {
    const status: AvailableStatus = time.resolution.status === "approximate" ? "approximate" : "exact";
    const reason: CalcReason = status === "approximate" ? "birth_time_approximate" : "none";
    for (const id of ids) bodies[id] = body(id, time.julianEphemerisDay, port, status, reason);
  } else {
    const interval = boundedInterval(time, port);
    if (interval) {
      const midpoint = (interval[0] + interval[1]) / 2;
      const reason = time.resolution.reason === "none" ? "insufficient_data" : time.resolution.reason;
      for (const id of ids) bodies[id] = body(id, midpoint, port, "bounded", reason, interval);
    } else {
      const reason = time.resolution.reason === "none" ? "insufficient_data" : time.resolution.reason;
      for (const id of ids) bodies[id] = unavailableBody(id, reason);
    }
  }
  return {
    frame: { centre: "geocentric", coordinates: "apparent", epoch: "date" },
    bodies,
  };
};
