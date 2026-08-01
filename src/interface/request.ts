import type { CalculationOptions } from "../calculate/service.js";
import type { BirthInput } from "../types/base.js";

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

const options = (value: unknown, defaults: CalculationOptions): CalculationOptions => {
  if (value === undefined) return defaults;
  const raw = object(value, "options");
  return {
    primaryZodiac: raw["primaryZodiac"] === undefined
      ? defaults.primaryZodiac
      : oneOf(raw["primaryZodiac"], "options.primaryZodiac", ["tropical", "sidereal"] as const),
    ayanamsha: raw["ayanamsha"] === undefined
      ? defaults.ayanamsha
      : oneOf(raw["ayanamsha"], "options.ayanamsha", ["lahiri", "fagan_bradley", "krishnamurti", "raman"] as const),
    interpretationMode: raw["interpretationMode"] === undefined
      ? defaults.interpretationMode
      : oneOf(raw["interpretationMode"], "options.interpretationMode", ["tropical", "sidereal", "both"] as const),
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
