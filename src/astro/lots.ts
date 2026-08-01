import type { CoreAngles } from "../house/angles.js";
import type { Calc, CalcReason } from "../types/base.js";
import type { AstronomyData } from "../types/astro.js";
import { normaliseDegrees } from "../zodiac/position.js";

export interface LotLongitudes {
  fortune: Calc<number>;
  spirit: Calc<number>;
}

const unavailable = (reason: CalcReason): Calc<number> => ({ status: "unavailable", value: null, reason });
const exact = (value: number): Calc<number> => ({ status: "exact", value: normaliseDegrees(value), reason: "none" });

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
  return { fortune: exact(fortune), spirit: exact(spirit) };
};
