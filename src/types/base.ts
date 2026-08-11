export type { BirthData, Calc, CalcReason, CalcStatus, Json, JsonRef, PlaceData, TimeData, TimeWindow } from "astral-core";
export type { PreferredGender } from "astral-interpreter/web";
import type { PreferredGender } from "astral-interpreter/web";

export interface BirthInput {
  date: string;
  time?: string | null;
  timeAccuracy?: "exact" | "approximate" | "unknown" | undefined;
  placeId: string;
  name?: string;
  lang?: string;
  preferredGender?: PreferredGender;
}

export const preferredGenderOf = (value: { preferredGender?: PreferredGender }): PreferredGender =>
  value.preferredGender ?? "male";
