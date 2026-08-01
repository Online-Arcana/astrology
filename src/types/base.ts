export type CalcStatus =
  | "exact"
  | "approximate"
  | "bounded"
  | "unavailable"
  | "unsupported";

export type CalcReason =
  | "none"
  | "birth_time_unknown"
  | "birth_time_approximate"
  | "ambiguous_local_time"
  | "nonexistent_local_time"
  | "polar_house_failure"
  | "provider_not_available"
  | "outside_supported_range"
  | "insufficient_data";

export interface Calc<T> {
  status: CalcStatus;
  value: T | null;
  reason: CalcReason;
}

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonRef = `#/${string}`;

export interface BirthInput {
  date: string;
  time: string | null;
  timeAccuracy: "exact" | "approximate" | "unknown";
  placeId: string;
  name?: string;
  lang?: string;
}

export interface PlaceData {
  id: string;
  continent: string;
  subcontinent: string | null;
  country: {
    code: string;
    name: string;
  };
  region: {
    code: string | null;
    name: string;
  } | null;
  city: {
    name: string;
  };
  latitude: number;
  longitude: number;
  elevationMetres: number | null;
  timeZone: string;
}

export interface TimeWindow {
  fold: 0 | 1 | null;
  localStartIso: string;
  localEndIso: string;
  utcStartIso: string;
  utcEndIso: string;
}

export interface TimeData {
  localIso: string | null;
  utcIso: string | null;
  utcOffsetSeconds: number | null;
  daylightSaving: boolean | null;
  julianDay: number | null;
  julianEphemerisDay: number | null;
  deltaTSeconds: number | null;
  resolution: Calc<TimeWindow>;
}

export interface BirthData {
  date: string;
  time: string | null;
  timeAccuracy: BirthInput["timeAccuracy"];
}
