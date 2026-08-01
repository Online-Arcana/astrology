export interface CivilInput {
  date: string;
  time: string;
  zone: string;
  fold?: 0 | 1;
}

export interface CivilCandidate {
  fold: 0 | 1 | null;
  utcIso: string;
  offsetSeconds: number;
  daylightSaving: boolean;
}

export type CivilResolution =
  | { kind: "exact"; localIso: string; candidate: CivilCandidate }
  | { kind: "ambiguous"; localIso: string; candidates: [CivilCandidate, CivilCandidate] }
  | { kind: "nonexistent"; localIso: string; beforeUtcIso: string; afterUtcIso: string }
  | { kind: "unsupported"; localIso: string; reason: string };

export interface TimeZoneInfo {
  provider: string;
  providerVersion: string;
  dataVersion: string;
  supportedRange: string;
  calendar: "proleptic_gregorian";
}

export interface TimeResolver {
  readonly info: TimeZoneInfo;
  resolve(input: CivilInput): CivilResolution;
}
