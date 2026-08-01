import { modernRulers, traditionalRulers } from "../rules/rulership.js";
import type { Calc, CalcReason } from "../types/base.js";
import type {
  House,
  HouseChart,
  HouseMap,
  HousePlacement,
  HouseSystem,
  PlanetId,
  Sign,
  Zodiac,
} from "../types/astro.js";
import { normaliseDegrees, signPosition, signs } from "../zodiac/position.js";
import type { CoreAngles } from "./angles.js";
import { forwardArc } from "./angles.js";
import {
  equalCusps,
  placidusCusps,
  porphyryCusps,
  shiftCusps,
  wholeSignCusps,
  type CuspMap,
} from "./cusps.js";

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const exact = <T>(value: T): Calc<T> => ({ status: "exact", value, reason: "none" });
const unavailable = <T>(reason: CalcReason): Calc<T> => ({ status: reason === "outside_supported_range" ? "unsupported" : "unavailable", value: null, reason });
const key = (number: number): keyof HouseMap<unknown> => String(number) as keyof HouseMap<unknown>;

const intercepted = (cusp: number, end: number): Sign[] => {
  const span = forwardArc(cusp, end);
  const result: Sign[] = [];
  signs.forEach((sign, index) => {
    const start = index * 30;
    const fromCusp = forwardArc(cusp, start);
    if (fromCusp > 1e-9 && fromCusp + 30 < span - 1e-9) result.push(sign);
  });
  return result;
};

const house = (number: typeof numbers[number], cusp: number, end: number): House => {
  const position = signPosition(cusp);
  return {
    number,
    cusp: exact(position),
    end: exact(signPosition(end)),
    rulerTraditional: exact(traditionalRulers[position.sign]),
    rulerModern: exact(modernRulers[position.sign]),
    occupants: [],
    interceptedSigns: intercepted(cusp, end),
  };
};

const chart = (
  system: HouseSystem,
  cusps: CuspMap,
  status: HouseChart["status"] = "calculated",
  fallbackFrom: HouseSystem | null = null,
  reason: CalcReason = "none",
): HouseChart => {
  const houses = {} as HouseMap<House>;
  numbers.forEach((number, index) => {
    const next = numbers[(index + 1) % 12] as typeof numbers[number];
    houses[key(number) as keyof HouseMap<House>] = house(number, cusps[key(number)], cusps[key(next)]);
  });
  return { system, status, fallbackFrom, reason, houses };
};

const unavailableChart = (system: HouseSystem, reason: CalcReason): HouseChart => {
  const houses = {} as HouseMap<House>;
  numbers.forEach((number) => {
    houses[key(number) as keyof HouseMap<House>] = {
      number,
      cusp: unavailable(reason),
      end: unavailable(reason),
      rulerTraditional: unavailable<PlanetId>(reason),
      rulerModern: unavailable<PlanetId>(reason),
      occupants: [],
      interceptedSigns: [],
    };
  });
  return { system, status: "unavailable", fallbackFrom: null, reason, houses };
};

export const unavailableHouseCharts = (reason: CalcReason): Record<HouseSystem, HouseChart> => ({
  placidus: unavailableChart("placidus", reason),
  whole_sign: unavailableChart("whole_sign", reason),
  equal: unavailableChart("equal", reason),
  porphyry: unavailableChart("porphyry", reason),
});

export interface HouseInput {
  angles: CoreAngles;
  latitudeDegrees: number;
  obliquityRadians: number;
  zodiac: Zodiac;
  ayanamshaDegrees?: number;
}

export const calculateHouseCharts = (input: HouseInput): Record<HouseSystem, HouseChart> => {
  const shift = input.zodiac === "sidereal" ? input.ayanamshaDegrees ?? 0 : 0;
  if (!Number.isFinite(shift) || shift < 0 || shift >= 360) throw new Error("Ayanamsha must be between 0 and 360 degrees");
  const porphyryTropical = porphyryCusps(input.angles);
  const equalTropical = equalCusps(input.angles.ascendant);
  const placidusTropical = placidusCusps(input.angles, input.latitudeDegrees, input.obliquityRadians);
  const porphyry = shiftCusps(porphyryTropical, shift);
  const equal = shiftCusps(equalTropical, shift);
  const siderealAscendant = normaliseDegrees(input.angles.ascendant - shift);
  const wholeSign = wholeSignCusps(siderealAscendant);
  const placidus = placidusTropical === null ? null : shiftCusps(placidusTropical, shift);
  return {
    placidus: placidus
      ? chart("placidus", placidus)
      : chart("porphyry", porphyry, "fallback", "placidus", "polar_house_failure"),
    whole_sign: chart("whole_sign", wholeSign),
    equal: chart("equal", equal),
    porphyry: chart("porphyry", porphyry),
  };
};

export const housePlacement = (longitudeDegrees: number, chartValue: HouseChart): Calc<HousePlacement> => {
  if (chartValue.status === "unavailable") return unavailable(chartValue.reason);
  const longitude = normaliseDegrees(longitudeDegrees);
  for (const number of numbers) {
    const current = chartValue.houses[key(number) as keyof HouseMap<House>];
    if (!current.cusp.value || !current.end.value) continue;
    const cusp = current.cusp.value.longitudeDegrees;
    const span = forwardArc(cusp, current.end.value.longitudeDegrees);
    const distance = forwardArc(cusp, longitude);
    if (distance < span || Math.abs(distance - span) < 1e-10 && number === 12) {
      return exact({
        house: number,
        distanceFromCuspDegrees: distance,
        intercepted: current.interceptedSigns.includes(signPosition(longitude).sign),
      });
    }
  }
  return unavailable("insufficient_data");
};
