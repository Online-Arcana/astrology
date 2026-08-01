import type { BirthInput, Calc, TimeData, TimeWindow } from "../types/base.js";
import type { TimeResolver } from "./model.js";

export interface AstralTimePort {
  time(utcIso: string): {
    julianDay: number;
    julianEphemerisDay: number;
    deltaTSeconds: number;
  };
}

const unavailable = (reason: Calc<unknown>["reason"]): TimeData => ({
  localIso: null,
  utcIso: null,
  utcOffsetSeconds: null,
  daylightSaving: null,
  julianDay: null,
  julianEphemerisDay: null,
  deltaTSeconds: null,
  resolution: { status: reason === "outside_supported_range" ? "unsupported" : "unavailable", value: null, reason },
});

const inputValid = (input: BirthInput): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.date)) throw new Error("Birth date must use YYYY-MM-DD");
  if (input.timeAccuracy === "unknown") {
    if (input.time !== null) throw new Error("Unknown birth time must be null");
    return;
  }
  if (input.time === null || !/^\d{2}:\d{2}:\d{2}$/u.test(input.time)) {
    throw new Error("Known birth time must use HH:mm:ss");
  }
};

const window = (localIso: string, utcIso: string, fold: 0 | 1 | null): TimeWindow => ({
  fold,
  localStartIso: localIso,
  localEndIso: localIso,
  utcStartIso: utcIso,
  utcEndIso: utcIso,
});

export const resolveBirthTime = (
  input: BirthInput,
  zone: string,
  resolver: TimeResolver,
  astronomy: AstralTimePort,
): TimeData => {
  inputValid(input);
  if (input.timeAccuracy === "unknown" || input.time === null) return unavailable("birth_time_unknown");
  const resolved = resolver.resolve({ date: input.date, time: input.time, zone });
  if (resolved.kind === "unsupported") return unavailable("outside_supported_range");
  if (resolved.kind === "nonexistent") return unavailable("nonexistent_local_time");
  if (resolved.kind === "ambiguous") {
    const ordered = [...resolved.candidates].sort((a, b) => a.utcIso.localeCompare(b.utcIso));
    const first = ordered[0];
    const last = ordered[1];
    if (!first || !last) return unavailable("ambiguous_local_time");
    return {
      localIso: resolved.localIso,
      utcIso: null,
      utcOffsetSeconds: null,
      daylightSaving: null,
      julianDay: null,
      julianEphemerisDay: null,
      deltaTSeconds: null,
      resolution: {
        status: "bounded",
        reason: "ambiguous_local_time",
        value: {
          fold: null,
          localStartIso: resolved.localIso,
          localEndIso: resolved.localIso,
          utcStartIso: first.utcIso,
          utcEndIso: last.utcIso,
        },
      },
    };
  }
  const values = astronomy.time(resolved.candidate.utcIso);
  const approximate = input.timeAccuracy === "approximate";
  return {
    localIso: resolved.localIso,
    utcIso: resolved.candidate.utcIso,
    utcOffsetSeconds: resolved.candidate.offsetSeconds,
    daylightSaving: resolved.candidate.daylightSaving,
    julianDay: values.julianDay,
    julianEphemerisDay: values.julianEphemerisDay,
    deltaTSeconds: values.deltaTSeconds,
    resolution: {
      status: approximate ? "approximate" : "exact",
      reason: approximate ? "birth_time_approximate" : "none",
      value: window(resolved.localIso, resolved.candidate.utcIso, resolved.candidate.fold),
    },
  };
};
