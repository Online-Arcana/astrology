import type { CoreAngles } from "../house/angles.js";
import type { Calc } from "../types/base.js";
import type { AstronomyData } from "../types/astro.js";

export const calculateSect = (
  astronomy: AstronomyData,
  angles: CoreAngles | null,
  latitudeDegrees: number,
): Calc<"day" | "night"> => {
  const sun = astronomy.bodies.sun;
  if (!angles || sun.rightAscensionRadians.value === null || sun.declinationRadians.value === null) {
    return {
      status: "unavailable",
      value: null,
      reason: sun.rightAscensionRadians.reason === "none" ? "insufficient_data" : sun.rightAscensionRadians.reason,
    };
  }
  const latitude = latitudeDegrees * Math.PI / 180;
  const hourAngle = angles.localSiderealDegrees * Math.PI / 180 - sun.rightAscensionRadians.value;
  const altitudeSine = Math.sin(latitude) * Math.sin(sun.declinationRadians.value)
    + Math.cos(latitude) * Math.cos(sun.declinationRadians.value) * Math.cos(hourAngle);
  return {
    status: "exact",
    value: altitudeSine >= 0 ? "day" : "night",
    reason: "none",
  };
};
