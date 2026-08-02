import { loadVendor } from "../vendor/load.js";
import { vendorRevisions } from "../vendor/revisions.js";
import type { EclipseEventSample, EclipseKind, EclipsePort, EclipseType } from "./port.js";

interface RawEclipse {
  type: number;
  jdeMax?: number;
  magnitude?: number;
  sdPenumbral?: number;
}

interface EclipseApi {
  TYPE: {
    None: number;
    Partial: number;
    Annular: number;
    AnnularTotal: number;
    Penumbral: number;
    Umbral: number;
    Total: number;
  };
  solar(decimalYear: number): RawEclipse;
  lunar(decimalYear: number): RawEclipse;
}

interface CalendarValue {
  fromJDE(julianEphemerisDay: number): CalendarValue;
  toYear(): number;
  toISOString(): string;
}

interface JulianApi {
  CalendarGregorian: new () => CalendarValue;
}

interface DefaultModule<T> {
  default: T;
}

const solarHalfDurationDays = 3 / 24;

const finite = (value: number | undefined, name: string): number => {
  if (value === undefined || !Number.isFinite(value)) throw new Error(`Invalid eclipse ${name}`);
  return value;
};

const typeOf = (kind: EclipseKind, raw: RawEclipse, api: EclipseApi): EclipseType | null => {
  if (raw.type === api.TYPE.None) return null;
  if (kind === "solar") {
    if (raw.type === api.TYPE.Partial) return "partial";
    if (raw.type === api.TYPE.Annular) return "annular";
    if (raw.type === api.TYPE.AnnularTotal) return "hybrid";
    if (raw.type === api.TYPE.Total) return "total";
  } else {
    if (raw.type === api.TYPE.Penumbral) return "penumbral";
    if (raw.type === api.TYPE.Umbral) return "partial";
    if (raw.type === api.TYPE.Total) return "total";
  }
  throw new Error(`Unsupported ${kind} eclipse type ${raw.type}`);
};

class AstronomiaEclipses implements EclipsePort {
  readonly provider = vendorRevisions.astronomia;
  readonly #eclipse: EclipseApi;
  readonly #julian: JulianApi;

  constructor(eclipse: EclipseApi, julian: JulianApi) {
    this.#eclipse = eclipse;
    this.#julian = julian;
  }

  sample(kind: EclipseKind, decimalYear: number): EclipseEventSample | null {
    const raw = kind === "solar" ? this.#eclipse.solar(decimalYear) : this.#eclipse.lunar(decimalYear);
    const type = typeOf(kind, raw, this.#eclipse);
    if (type === null) return null;
    const activeHalfDurationDays = kind === "solar"
      ? solarHalfDurationDays
      : finite(raw.sdPenumbral, "penumbral semiduration");
    return {
      kind,
      type,
      julianEphemerisDay: finite(raw.jdeMax, "maximum JDE"),
      magnitude: raw.magnitude !== undefined && Number.isFinite(raw.magnitude) ? raw.magnitude : null,
      activeHalfDurationDays,
    };
  }

  decimalYear(julianEphemerisDay: number): number {
    return new this.#julian.CalendarGregorian().fromJDE(julianEphemerisDay).toYear();
  }

  utcIso(julianEphemerisDay: number): string {
    return new this.#julian.CalendarGregorian().fromJDE(julianEphemerisDay).toISOString();
  }
}

const moduleDefault = async <T>(path: string): Promise<T> => (await loadVendor<DefaultModule<T>>(path)).default;

export const loadEclipses = async (): Promise<EclipsePort> => {
  const [eclipse, julian] = await Promise.all([
    moduleDefault<EclipseApi>("astronomia/eclipse"),
    moduleDefault<JulianApi>("astronomia/julian"),
  ]);
  return new AstronomiaEclipses(eclipse, julian);
};
