import { normaliseDegrees } from "../zodiac/position.js";
import { loadVendor } from "../vendor/load.js";
import type { LunarOrbitPort, LunarOrbitSample } from "./port.js";

interface MoonPosition {
  lon: number;
  lat: number;
  range: number;
}

interface MoonApi {
  position(julianEphemerisDay: number): MoonPosition;
}

interface NutationApi {
  nutation(julianEphemerisDay: number): [number, number];
}

interface DefaultModule<T> {
  default: T;
}

interface Vector {
  x: number;
  y: number;
  z: number;
}

interface OrbitLongitudes {
  meanNode: number;
  trueNode: number;
  meanApogee: number;
  trueApogee: number;
}

const radiansToDegrees = 180 / Math.PI;
const earthMoonMuKm3PerDay2 = (398_600.435_507 + 4_902.800_118) * 86_400 ** 2;

const vector = (position: MoonPosition): Vector => {
  const cosLatitude = Math.cos(position.lat);
  return {
    x: position.range * cosLatitude * Math.cos(position.lon),
    y: position.range * cosLatitude * Math.sin(position.lon),
    z: position.range * Math.sin(position.lat),
  };
};

const subtract = (a: Vector, b: Vector): Vector => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (value: Vector, factor: number): Vector => ({ x: value.x * factor, y: value.y * factor, z: value.z * factor });
const cross = (a: Vector, b: Vector): Vector => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const magnitude = (value: Vector): number => Math.hypot(value.x, value.y, value.z);
const longitude = (value: Vector): number => normaliseDegrees(Math.atan2(value.y, value.x) * radiansToDegrees);

const polynomial = (t: number, coefficients: readonly number[]): number => {
  let value = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) value = value * t + (coefficients[index] as number);
  return value;
};

const meanNode = (jde: number): number => {
  const t = (jde - 2_451_545) / 36_525;
  return polynomial(t, [125.0445479, -1934.1362891, 0.0020754, 1 / 467_441, -1 / 60_616_000]);
};

const meanApogee = (jde: number): number => {
  const t = (jde - 2_451_545) / 36_525;
  const perigee = polynomial(t, [83.3532465, 4069.0137287, -0.01032, -1 / 80_053, 1 / 18_999_000]);
  return perigee + 180;
};

const osculating = (moon: MoonApi, jde: number): { node: number; apogee: number } => {
  const step = 0.001;
  const current = vector(moon.position(jde));
  const velocity = scale(
    subtract(vector(moon.position(jde + step)), vector(moon.position(jde - step))),
    1 / (2 * step),
  );
  const angularMomentum = cross(current, velocity);
  if (magnitude(angularMomentum) === 0) throw new Error("Lunar state has no angular momentum");
  const eccentricity = subtract(
    scale(cross(velocity, angularMomentum), 1 / earthMoonMuKm3PerDay2),
    scale(current, 1 / magnitude(current)),
  );
  if (magnitude(eccentricity) < 1e-9) throw new Error("Lunar osculating apogee is undefined");
  return {
    node: normaliseDegrees(Math.atan2(angularMomentum.x, -angularMomentum.y) * radiansToDegrees),
    apogee: longitude(scale(eccentricity, -1)),
  };
};

const longitudes = (moon: MoonApi, nutation: NutationApi, jde: number): OrbitLongitudes => {
  const correction = nutation.nutation(jde)[0] * radiansToDegrees;
  const trueOrbit = osculating(moon, jde);
  return {
    meanNode: normaliseDegrees(meanNode(jde) + correction),
    trueNode: normaliseDegrees(trueOrbit.node + correction),
    meanApogee: normaliseDegrees(meanApogee(jde) + correction),
    trueApogee: normaliseDegrees(trueOrbit.apogee + correction),
  };
};

const signedDelta = (after: number, before: number): number => {
  const delta = normaliseDegrees(after - before);
  return delta > 180 ? delta - 360 : delta;
};

class AstronomiaLunarOrbit implements LunarOrbitPort {
  readonly #moon: MoonApi;
  readonly #nutation: NutationApi;

  constructor(moon: MoonApi, nutation: NutationApi) {
    this.#moon = moon;
    this.#nutation = nutation;
  }

  sample(jde: number): LunarOrbitSample {
    const current = longitudes(this.#moon, this.#nutation, jde);
    const before = longitudes(this.#moon, this.#nutation, jde - 0.5);
    const after = longitudes(this.#moon, this.#nutation, jde + 0.5);
    return {
      meanNode: { longitudeDegrees: current.meanNode, speedDegreesPerDay: signedDelta(after.meanNode, before.meanNode) },
      trueNode: { longitudeDegrees: current.trueNode, speedDegreesPerDay: signedDelta(after.trueNode, before.trueNode) },
      meanApogee: { longitudeDegrees: current.meanApogee, speedDegreesPerDay: signedDelta(after.meanApogee, before.meanApogee) },
      trueApogee: { longitudeDegrees: current.trueApogee, speedDegreesPerDay: signedDelta(after.trueApogee, before.trueApogee) },
    };
  }
}

const moduleDefault = async <T>(path: string): Promise<T> => (await loadVendor<DefaultModule<T>>(path)).default;

export const loadLunarOrbit = async (): Promise<LunarOrbitPort> => {
  const [moon, nutation] = await Promise.all([
    moduleDefault<MoonApi>("astronomia/moonposition"),
    moduleDefault<NutationApi>("astronomia/nutation"),
  ]);
  return new AstronomiaLunarOrbit(moon, nutation);
};
