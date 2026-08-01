export type EclipseKind = "solar" | "lunar";
export type EclipseType = "partial" | "total" | "annular" | "hybrid" | "penumbral";

export interface EclipseEventSample {
  kind: EclipseKind;
  type: EclipseType;
  julianEphemerisDay: number;
  magnitude: number | null;
  activeHalfDurationDays: number;
}

export interface EclipsePort {
  readonly provider: {
    repository: string;
    revision: string;
    version: string;
  };
  sample(kind: EclipseKind, decimalYear: number): EclipseEventSample | null;
  decimalYear(julianEphemerisDay: number): number;
  utcIso(julianEphemerisDay: number): string;
}
