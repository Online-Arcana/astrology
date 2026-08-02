import type { AstronomyPort, LunarOrbitPort } from "../astro/port.js";
import type { Calc, CalcReason, CalcStatus, TimeData } from "../types/base.js";
import type { Ayanamsha, NatalEclipse, PrenatalEclipse, Zodiac } from "../types/astro.js";
import { ayanamshaDegrees } from "../zodiac/ayanamsha.js";
import { normaliseDegrees, signPosition } from "../zodiac/position.js";
import type { EclipseEventSample, EclipseKind, EclipsePort } from "./port.js";

export const eclipseProfile = "western_eclipses/1.1.0" as const;

export interface EclipseCalculation {
  atBirth: Calc<NatalEclipse>;
  prenatalSolar: Calc<PrenatalEclipse>;
  prenatalLunar: Calc<PrenatalEclipse>;
}

export interface EclipseCalculationInput {
  time: TimeData;
  astronomy: AstronomyPort;
  lunarOrbit: LunarOrbitPort;
  eclipses: EclipsePort;
  zodiac: Zodiac;
  ayanamsha: Ayanamsha | null;
}

interface EventFacts {
  longitudeDegrees: number;
  node: "north" | "south";
  nodeDistanceDegrees: number;
  sunMoonAngleDegrees: number;
}

const unavailable = <T>(reason: CalcReason): Calc<T> => ({
  status: reason === "outside_supported_range" ? "unsupported" : "unavailable",
  value: null,
  reason,
});

const resultStatus = (time: TimeData): { status: CalcStatus; reason: CalcReason } => {
  if (time.resolution.status === "exact") return { status: "exact", reason: "none" };
  if (time.resolution.status === "bounded") {
    return {
      status: "bounded",
      reason: time.resolution.reason === "none" ? "birth_time_approximate" : time.resolution.reason,
    };
  }
  return {
    status: "approximate",
    reason: time.resolution.reason === "none" ? "birth_time_approximate" : time.resolution.reason,
  };
};

const noTimeReason = (time: TimeData): CalcReason =>
  time.resolution.reason === "none" ? "birth_time_unknown" : time.resolution.reason;

const distance = (a: number, b: number): number => {
  const delta = Math.abs(normaliseDegrees(a) - normaliseDegrees(b));
  return Math.min(delta, 360 - delta);
};

const longitude = (astronomy: AstronomyPort, id: "sun" | "moon", jde: number): number =>
  normaliseDegrees(astronomy.sample(id, jde).eclipticLongitudeRadians * 180 / Math.PI);

const facts = (
  event: EclipseEventSample,
  astronomy: AstronomyPort,
  lunarOrbit: LunarOrbitPort,
): EventFacts => {
  const sun = longitude(astronomy, "sun", event.julianEphemerisDay);
  const moon = longitude(astronomy, "moon", event.julianEphemerisDay);
  const eclipseLongitude = event.kind === "solar" ? sun : moon;
  const north = normaliseDegrees(lunarOrbit.sample(event.julianEphemerisDay).trueNode.longitudeDegrees);
  const south = normaliseDegrees(north + 180);
  const northDistance = distance(eclipseLongitude, north);
  const southDistance = distance(eclipseLongitude, south);
  return {
    longitudeDegrees: eclipseLongitude,
    node: northDistance <= southDistance ? "north" : "south",
    nodeDistanceDegrees: Math.min(northDistance, southDistance),
    sunMoonAngleDegrees: distance(sun, moon),
  };
};

const scan = (birthJde: number, eclipses: EclipsePort): EclipseEventSample[] => {
  const year = eclipses.decimalYear(birthJde);
  const events = new Map<string, EclipseEventSample>();
  const kinds = ["solar", "lunar"] as const satisfies readonly EclipseKind[];
  for (let month = -24; month <= 2; month += 1) {
    const sampleYear = year + month / 12;
    for (const kind of kinds) {
      const event = eclipses.sample(kind, sampleYear);
      if (!event) continue;
      const key = `${kind}:${Math.round(event.julianEphemerisDay * 1_000_000)}`;
      events.set(key, event);
    }
  }
  return [...events.values()].sort((a, b) => a.julianEphemerisDay - b.julianEphemerisDay);
};

const prenatal = (
  kind: EclipseKind,
  birthJde: number,
  events: readonly EclipseEventSample[],
): EclipseEventSample | null => {
  const candidates = events.filter((event) => event.kind === kind && event.julianEphemerisDay < birthJde);
  return candidates.at(-1) ?? null;
};

const atBirth = (birthJde: number, events: readonly EclipseEventSample[]): EclipseEventSample | null => {
  const candidates = events
    .filter((event) => Math.abs(event.julianEphemerisDay - birthJde) <= event.activeHalfDurationDays)
    .sort((a, b) =>
      Math.abs(a.julianEphemerisDay - birthJde) - Math.abs(b.julianEphemerisDay - birthJde),
    );
  return candidates[0] ?? null;
};

const prenatalValue = (
  event: EclipseEventSample,
  birthJde: number,
  astronomy: AstronomyPort,
  lunarOrbit: LunarOrbitPort,
  eclipses: EclipsePort,
  zodiac: Zodiac,
  ayanamsha: Ayanamsha | null,
): PrenatalEclipse => {
  const eventFacts = facts(event, astronomy, lunarOrbit);
  const longitudeDegrees = zodiac === "tropical"
    ? eventFacts.longitudeDegrees
    : eventFacts.longitudeDegrees - ayanamshaDegrees(
        event.julianEphemerisDay,
        ayanamsha ?? "lahiri",
      );
  return {
    kind: event.kind,
    type: event.type,
    exactUtcIso: eclipses.utcIso(event.julianEphemerisDay),
    daysBeforeBirth: birthJde - event.julianEphemerisDay,
    zodiac,
    position: signPosition(longitudeDegrees),
    node: eventFacts.node,
    magnitude: event.magnitude,
  };
};

const natalValue = (
  event: EclipseEventSample,
  birthJde: number,
  astronomy: AstronomyPort,
  lunarOrbit: LunarOrbitPort,
  eclipses: EclipsePort,
): NatalEclipse => {
  const eventFacts = facts(event, astronomy, lunarOrbit);
  return {
    kind: event.kind,
    type: event.type,
    exactUtcIso: eclipses.utcIso(event.julianEphemerisDay),
    birthOffsetSeconds: (birthJde - event.julianEphemerisDay) * 86_400,
    magnitude: event.magnitude,
    node: eventFacts.node,
    sunMoonAngleDegrees: eventFacts.sunMoonAngleDegrees,
    nodeDistanceDegrees: eventFacts.nodeDistanceDegrees,
  };
};

export const calculateEclipses = (input: EclipseCalculationInput): EclipseCalculation => {
  if (input.zodiac === "sidereal" && input.ayanamsha === null) {
    throw new Error("Sidereal eclipse calculation requires one selected ayanamsha");
  }
  if (input.zodiac === "tropical" && input.ayanamsha !== null) {
    throw new Error("Tropical eclipse calculation cannot use an ayanamsha");
  }

  const birthJde = input.time.julianEphemerisDay;
  if (birthJde === null) {
    const reason = noTimeReason(input.time);
    return {
      atBirth: unavailable(reason),
      prenatalSolar: unavailable(reason),
      prenatalLunar: unavailable(reason),
    };
  }

  const events = scan(birthJde, input.eclipses);
  const state = resultStatus(input.time);
  const natal = atBirth(birthJde, events);
  const solar = prenatal("solar", birthJde, events);
  const lunar = prenatal("lunar", birthJde, events);

  return {
    atBirth: natal
      ? {
          status: state.status,
          value: natalValue(natal, birthJde, input.astronomy, input.lunarOrbit, input.eclipses),
          reason: state.reason,
        }
      : unavailable("insufficient_data"),
    prenatalSolar: solar
      ? {
          status: state.status,
          value: prenatalValue(
            solar,
            birthJde,
            input.astronomy,
            input.lunarOrbit,
            input.eclipses,
            input.zodiac,
            input.ayanamsha,
          ),
          reason: state.reason,
        }
      : unavailable("insufficient_data"),
    prenatalLunar: lunar
      ? {
          status: state.status,
          value: prenatalValue(
            lunar,
            birthJde,
            input.astronomy,
            input.lunarOrbit,
            input.eclipses,
            input.zodiac,
            input.ayanamsha,
          ),
          reason: state.reason,
        }
      : unavailable("insufficient_data"),
  };
};
