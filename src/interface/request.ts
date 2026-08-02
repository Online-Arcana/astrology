import type { CalculationOptions } from "../calculate/service.js";
import type { BirthInput } from "../types/base.js";
import type { Zodiac } from "../types/astro.js";

export interface CalculationRequest {
  birth: BirthInput;
  options: CalculationOptions;
}

const object = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
};

const string = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} must be a non-empty string`);
  return value;
};

const optionalString = (value: unknown, name: string): string | undefined => {
  if (value === undefined) return undefined;
  return string(value, name);
};

const oneOf = <T extends string>(value: unknown, name: string, values: readonly T[]): T => {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${name} has an unsupported value`);
  return value as T;
};

const birth = (value: unknown): BirthInput => {
  const raw = object(value, "birth");
  const timeAccuracy = oneOf(raw["timeAccuracy"], "birth.timeAccuracy", ["exact", "approximate", "unknown"] as const);
  const timeValue = raw["time"];
  const time = timeValue === null ? null : string(timeValue, "birth.time");
  if (timeAccuracy === "unknown" && time !== null) throw new Error("birth.time must be null when birth.timeAccuracy is unknown");
  if (timeAccuracy !== "unknown" && time === null) throw new Error("birth.time is required when birth.timeAccuracy is known");
  const result: BirthInput = {
    date: string(raw["date"], "birth.date"),
    time,
    timeAccuracy,
    placeId: string(raw["placeId"], "birth.placeId"),
  };
  const name = optionalString(raw["name"], "birth.name");
  const lang = optionalString(raw["lang"], "birth.lang");
  if (name !== undefined) result.name = name;
  if (lang !== undefined) result.lang = lang;
  return result;
};

const selectedZodiac = (raw: Record<string, unknown>, defaults: CalculationOptions): Zodiac => {
  const supplied: Array<readonly [string, unknown]> = [];
  for (const [name, value] of [
    ["options.zodiac", raw["zodiac"]],
    ["options.primaryZodiac", raw["primaryZodiac"]],
    ["options.interpretationMode", raw["interpretationMode"]],
  ] as const) {
    if (value !== undefined) supplied.push([name, value]);
  }
  if (supplied.some(([, value]) => value === "both")) {
    throw new Error("A chart cannot contain both zodiac systems; create separate tropical and sidereal charts");
  }
  const first = supplied[0];
  const selected = first === undefined
    ? defaults.primaryZodiac
    : oneOf(first[1], first[0], ["tropical", "sidereal"] as const);
  for (const [name, value] of supplied.slice(1)) {
    if (oneOf(value, name, ["tropical", "sidereal"] as const) !== selected) {
      throw new Error("options.zodiac, options.primaryZodiac and options.interpretationMode must select the same zodiac");
    }
  }
  return selected;
};

const options = (value: unknown, defaults: CalculationOptions): CalculationOptions => {
  if (value === undefined) return defaults;
  const raw = object(value, "options");
  const zodiac = selectedZodiac(raw, defaults);
  const ayanamshaValue = raw["ayanamsha"] ?? raw["siderealAyanamsha"];
  return {
    primaryZodiac: zodiac,
    ayanamsha: ayanamshaValue === undefined
      ? defaults.ayanamsha
      : oneOf(ayanamshaValue, "options.ayanamsha", ["lahiri", "fagan_bradley", "krishnamurti", "raman"] as const),
    interpretationMode: zodiac,
  };
};

export const parseCalculationRequest = (
  value: unknown,
  defaults: CalculationOptions,
): CalculationRequest => {
  const raw = object(value, "request");
  return {
    birth: birth(raw["birth"]),
    options: options(raw["options"], defaults),
  };
};
