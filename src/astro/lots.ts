import type { CoreAngles } from "../house/angles.js";
import type { Calc, CalcReason, CalcStatus } from "../types/base.js";
import type { AstronomyData } from "../types/astro.js";
import { normaliseDegrees } from "../zodiac/position.js";

export interface LotLongitudes {
  fortune: Calc<number>;
  spirit: Calc<number>;
}

type AvailableStatus = Extract<CalcStatus, "exact" | "approximate" | "bounded">;

const unavailable = (reason: CalcReason): Calc<number> => ({ status: "unavailable", value: null, reason });
const available = (value: number, status: AvailableStatus, reason: CalcReason): Calc<number> => ({
  status,
  value: normaliseDegrees(value),
  reason,
});

const combinedStatus = (...values: readonly Calc<unknown>[]): { status: AvailableStatus; reason: CalcReason } => {
  const status: AvailableStatus = values.some((value) => value.status === "bounded")
    ? "bounded"
    : values.some((value) => value.status === "approximate")
      ? "approximate"
      : "exact";
  const reason = values.find((value) => value.reason !== "none")?.reason ?? "none";
  return { status, reason };
};

export const calculateLots = (
  astronomy: AstronomyData,
  angles: CoreAngles | null,
  sect: Calc<"day" | "night">,
): LotLongitudes => {
  const sun = astronomy.bodies.sun.eclipticLongitudeDegrees;
  const moon = astronomy.bodies.moon.eclipticLongitudeDegrees;
  if (!angles || sect.value === null || sun.value === null || moon.value === null) {
    const reason = sect.reason !== "none"
      ? sect.reason
      : sun.reason !== "none"
        ? sun.reason
        : moon.reason !== "none"
          ? moon.reason
          : "insufficient_data";
    return { fortune: unavailable(reason), spirit: unavailable(reason) };
  }
  const fortune = sect.value === "day"
    ? angles.ascendant + moon.value - sun.value
    : angles.ascendant + sun.value - moon.value;
  const spirit = sect.value === "day"
    ? angles.ascendant + sun.value - moon.value
    : angles.ascendant + moon.value - sun.value;
  const state = combinedStatus(sun, moon, sect);
  return {
    fortune: available(fortune, state.status, state.reason),
    spirit: available(spirit, state.status, state.reason),
  };
};
