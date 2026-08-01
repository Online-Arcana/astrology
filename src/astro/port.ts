import type { GeometrySample } from "../house/angles.js";
import type { PlanetId } from "../types/astro.js";
import type { AstralTimePort } from "../time/calculate.js";

export interface BodySample {
  rightAscensionRadians: number;
  declinationRadians: number;
  eclipticLongitudeRadians: number;
  eclipticLatitudeRadians: number;
  distanceAu: number;
}

export interface AstronomyPort extends AstralTimePort {
  readonly provider: {
    repository: string;
    revision: string;
    version: string;
  };
  sample(id: PlanetId, julianEphemerisDay: number): BodySample;
  geometry(julianDay: number, julianEphemerisDay: number): GeometrySample;
}
