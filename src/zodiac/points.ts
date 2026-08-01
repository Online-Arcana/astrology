import type { LunarOrbitSample, OrbitPointSample } from "../astro/port.js";
import type { LotLongitudes } from "../astro/lots.js";
import type { AuxiliaryAngles, CoreAngles } from "../house/angles.js";
import { housePlacement } from "../house/chart.js";
import type { Calc, CalcReason } from "../types/base.js";
import type {
  AstrologicalPoint,
  AstronomyData,
  DignityState,
  HouseChart,
  HouseMap,
  HousePlacement,
  HouseSystem,
  PlanetId,
  PointId,
  PointMap,
  SignPosition,
  Zodiac,
} from "../types/astro.js";
import { normaliseDegrees, signPosition } from "./position.js";

const houseSystems = ["placidus", "whole_sign", "equal", "porphyry"] as const satisfies readonly HouseSystem[];
const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const pointIds = [
  ...planets,
  "north_node_true", "south_node_true", "north_node_mean", "south_node_mean",
  "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
  "part_of_fortune", "part_of_spirit", "lilith_mean", "lilith_true",
] as const satisfies readonly PointId[];

const unavailable = <T>(reason: CalcReason): Calc<T> => ({
  status: reason === "outside_supported_range" ? "unsupported" : "unavailable",
  value: null,
  reason,
});
const exact = <T>(value: T): Calc<T> => ({ status: "exact", value, reason: "none" });

const shiftPosition = (longitude: Calc<number>, shift: number): Calc<SignPosition> => longitude.value === null
  ? { status: longitude.status, value: null, reason: longitude.reason }
  : { status: longitude.status, value: signPosition(longitude.value - shift), reason: longitude.reason };

const motion = (sample: OrbitPointSample): AstrologicalPoint["motion"] =>
  Math.abs(sample.speedDegreesPerDay) <= 0.005 ? "stationary" : sample.speedDegreesPerDay > 0 ? "direct" : "retrograde";

const blankDignity = (): Calc<DignityState> => unavailable("provider_not_available");

const placements = (
  position: Calc<SignPosition>,
  houses: Record<HouseSystem, HouseChart>,
): Record<HouseSystem, Calc<HousePlacement>> => {
  const result = {} as Record<HouseSystem, Calc<HousePlacement>>;
  for (const system of houseSystems) {
    result[system] = position.value === null
      ? unavailable(position.reason)
      : housePlacement(position.value.longitudeDegrees, houses[system]);
  }
  return result;
};

const point = (
  id: PointId,
  kind: AstrologicalPoint["kind"],
  position: Calc<SignPosition>,
  pointMotion: AstrologicalPoint["motion"],
  houses: Record<HouseSystem, HouseChart>,
): AstrologicalPoint => ({
  id,
  kind,
  position,
  houses: placements(position, houses),
  motion: pointMotion,
  dignity: blankDignity(),
});

const orbitLongitude = (sample: OrbitPointSample | null, offset = 0, reason: CalcReason): Calc<number> =>
  sample ? exact(normaliseDegrees(sample.longitudeDegrees + offset)) : unavailable(reason);

const angleLongitude = (value: number | null, reason: CalcReason): Calc<number> =>
  value === null ? unavailable(reason) : exact(value);

const lotLongitude = (value: Calc<number>): Calc<number> => value;

const cloneHouses = (source: Record<HouseSystem, HouseChart>): Record<HouseSystem, HouseChart> => {
  const output = {} as Record<HouseSystem, HouseChart>;
  for (const system of houseSystems) {
    const chart = source[system];
    const houses = {} as HouseMap<HouseChart["houses"]["1"]>;
    for (let number = 1; number <= 12; number += 1) {
      const key = String(number) as keyof typeof houses;
      houses[key] = { ...chart.houses[key], occupants: [] };
    }
    output[system] = { ...chart, houses };
  }
  return output;
};

const populate = (
  houses: Record<HouseSystem, HouseChart>,
  points: PointMap<AstrologicalPoint>,
): Record<HouseSystem, HouseChart> => {
  const output = cloneHouses(houses);
  for (const id of pointIds) {
    const value = points[id];
    for (const system of houseSystems) {
      const placement = value.houses[system].value;
      if (placement) output[system].houses[String(placement.house) as keyof HouseMap<unknown>].occupants.push(id);
    }
  }
  return output;
};

export interface PointBuildInput {
  astronomy: AstronomyData;
  houses: Record<HouseSystem, HouseChart>;
  angles: CoreAngles | null;
  auxiliary: AuxiliaryAngles | null;
  lunarOrbit: LunarOrbitSample | null;
  lots: LotLongitudes;
  zodiac: Zodiac;
  ayanamshaDegrees: number;
  unavailableReason?: CalcReason;
}

export interface PointBuildResult {
  points: PointMap<AstrologicalPoint>;
  houses: Record<HouseSystem, HouseChart>;
}

export const buildPoints = (input: PointBuildInput): PointBuildResult => {
  const reason = input.unavailableReason ?? "insufficient_data";
  const shift = input.zodiac === "sidereal" ? input.ayanamshaDegrees : 0;
  const points = {} as PointMap<AstrologicalPoint>;

  for (const id of planets) {
    const body = input.astronomy.bodies[id];
    const kind = id === "sun" || id === "moon" ? "luminary" : "planet";
    points[id] = point(id, kind, shiftPosition(body.eclipticLongitudeDegrees, shift), body.motion, input.houses);
  }

  const orbit = input.lunarOrbit;
  const orbitPoints: readonly [PointId, OrbitPointSample | null, number][] = [
    ["north_node_true", orbit?.trueNode ?? null, 0],
    ["south_node_true", orbit?.trueNode ?? null, 180],
    ["north_node_mean", orbit?.meanNode ?? null, 0],
    ["south_node_mean", orbit?.meanNode ?? null, 180],
  ];
  for (const [id, sample, offset] of orbitPoints) {
    points[id] = point(id, "node", shiftPosition(orbitLongitude(sample, offset, reason), shift), sample ? motion(sample) : "unknown", input.houses);
  }

  const angleValues: readonly [PointId, number | null][] = [
    ["ascendant", input.angles?.ascendant ?? null],
    ["descendant", input.angles?.descendant ?? null],
    ["midheaven", input.angles?.midheaven ?? null],
    ["imum_coeli", input.angles?.imumCoeli ?? null],
    ["vertex", input.auxiliary?.vertex ?? null],
    ["antivertex", input.auxiliary?.antivertex ?? null],
    ["east_point", input.auxiliary?.eastPoint ?? null],
  ];
  for (const [id, value] of angleValues) {
    points[id] = point(id, "angle", shiftPosition(angleLongitude(value, reason), shift), "not_applicable", input.houses);
  }

  points.part_of_fortune = point(
    "part_of_fortune",
    "lot",
    shiftPosition(lotLongitude(input.lots.fortune), shift),
    "not_applicable",
    input.houses,
  );
  points.part_of_spirit = point(
    "part_of_spirit",
    "lot",
    shiftPosition(lotLongitude(input.lots.spirit), shift),
    "not_applicable",
    input.houses,
  );

  const lilith: readonly [PointId, OrbitPointSample | null][] = [
    ["lilith_mean", orbit?.meanApogee ?? null],
    ["lilith_true", orbit?.trueApogee ?? null],
  ];
  for (const [id, sample] of lilith) {
    points[id] = point(id, "lilith", shiftPosition(orbitLongitude(sample, 0, reason), shift), sample ? motion(sample) : "unknown", input.houses);
  }

  return { points, houses: populate(input.houses, points) };
};
