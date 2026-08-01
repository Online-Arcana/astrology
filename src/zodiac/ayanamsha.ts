import type { Ayanamsha } from "../types/astro.js";
import { normaliseDegrees } from "./position.js";

export const ayanamshaProfile = "western_ayanamsha/1.0.0" as const;

const j2000: Readonly<Record<Ayanamsha, number>> = {
  fagan_bradley: 24.740299966181,
  lahiri: 23.857092325455,
  krishnamurti: 23.760240012073,
  raman: 22.410791012073,
};

const precessionDegrees = (julianEphemerisDay: number): number => {
  const centuries = (julianEphemerisDay - 2_451_545) / 36_525;
  return (
    5_029.0966 * centuries
    + 1.11113 * centuries ** 2
    - 0.000006 * centuries ** 3
  ) / 3_600;
};

export const ayanamshaDegrees = (julianEphemerisDay: number, ayanamsha: Ayanamsha): number => {
  if (!Number.isFinite(julianEphemerisDay)) throw new Error("Julian ephemeris day must be finite");
  return normaliseDegrees(j2000[ayanamsha] + precessionDegrees(julianEphemerisDay));
};

export const ayanamshaReference = (ayanamsha: Ayanamsha): number => j2000[ayanamsha];
