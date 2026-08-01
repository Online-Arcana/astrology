import { calculateAstronomy } from "../astro/calculate.js";
import { loadAstronomia } from "../astro/astronomia.js";
import { lunarPhase } from "../astro/lunar.js";
import { loadLunarOrbit } from "../astro/lunarOrbit.js";
import { calculateLots } from "../astro/lots.js";
import type { AstronomyPort, LunarOrbitPort, LunarOrbitSample } from "../astro/port.js";
import { calculateSect } from "../astro/sect.js";
import { detectDeclinationAspects } from "../aspect/declination.js";
import { aspectProfile } from "../aspect/catalogue.js";
import { detectAspects, type AspectPoint } from "../aspect/detect.js";
import { calculateCompatibility } from "../compat/calculate.js";
import { compatibilityProfile } from "../compat/rank.js";
import type { Config } from "../config.js";
import { calculateDerived } from "../derived/calculate.js";
import { dignityProfile } from "../dignity/catalogue.js";
import { calculateEclipses } from "../eclipse/calculate.js";
import { loadEclipses } from "../eclipse/astronomia.js";
import type { EclipsePort } from "../eclipse/port.js";
import { canonicalBytes } from "../file/canonical.js";
import { digest } from "../file/hash.js";
import { auxiliaryAngles, coreAngles, type AuxiliaryAngles, type CoreAngles } from "../house/angles.js";
import { calculateHouseCharts, unavailableHouseCharts } from "../house/chart.js";
import { detectPatterns, type PatternPoint } from "../pattern/detect.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { PlaceCatalogue } from "../place/model.js";
import { resolveBirthTime } from "../time/calculate.js";
import type { TimeResolver } from "../time/model.js";
import { loadTimeResolver } from "../time/vendor.js";
import type { BirthInput, Calc, CalcReason, CalcStatus, JsonRef, TimeData } from "../types/base.js";
import type {
  Ayanamsha,
  AstrologicalPoint,
  AstronomyData,
  BodyState,
  HouseSystem,
  LunarPhase,
  PlanetId,
  PointId,
  PointMap,
  SiderealCalculation,
  TropicalCalculation,
  Zodiac,
  ZodiacCalculation,
} from "../types/astro.js";
import type { AstralCalculation, CalculationWarning, InterpretationPlan } from "../types/file.js";
import { vendorRevisions } from "../vendor/revisions.js";
import { ayanamshaDegrees } from "../zodiac/ayanamsha.js";
import { buildPoints } from "../zodiac/points.js";
import { buildInterpretationPlan } from "./plan.js";

export const calculationProfile = "western_natal/1.0.0" as const;

const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const satisfies readonly PlanetId[];
const pointIds = [
  ...planets,
  "north_node_true", "south_node_true", "north_node_mean", "south_node_mean",
  "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
  "part_of_fortune", "part_of_spirit", "lilith_mean", "lilith_true",
] as const satisfies readonly PointId[];
type TimedStatus = Extract<CalcStatus, "exact" | "approximate" | "bounded">;

export interface CalculationOptions {
  primaryZodiac: "tropical" | "sidereal";
  ayanamsha: Ayanamsha;
  interpretationMode: "tropical" | "sidereal" | "both";
}

export interface CalculationPorts {
  places: Pick<PlaceCatalogue, "get">;
  timeResolver: TimeResolver;
  astronomy: AstronomyPort;
  lunarOrbit: LunarOrbitPort;
  eclipses: EclipsePort;
  version: string;
  now(): string;
}

interface TimedState {
  julianEphemerisDay: number;
  status: TimedStatus;
  reason: CalcReason;
}

export class CalculationUnavailableError extends Error {
  readonly reason: CalcReason;

  constructor(reason: CalcReason) {
    super(`Chart calculation is unavailable: ${reason}`);
    this.name = "CalculationUnavailableError";
    this.reason = reason;
  }
}

const ref = (value: string): JsonRef => `#/${value}` as JsonRef;
const unavailable = <T>(reason: CalcReason): Calc<T> => ({
  status: reason === "outside_supported_range" ? "unsupported" : "unavailable",
  value: null,
  reason,
});
const calculated = <T>(value: T, status: TimedStatus, reason: CalcReason): Calc<T> => ({ status, value, reason });

const optionsFromConfig = (config: Config): CalculationOptions => ({
  primaryZodiac: config.chart.primaryZodiac,
  ayanamsha: config.chart.ayanamsha,
  interpretationMode: config.chart.interpretationMode,
});

const timeState = (time: TimeData, astronomy: AstronomyPort): TimedState => {
  if (time.julianEphemerisDay !== null) {
    return time.resolution.status === "approximate"
      ? { julianEphemerisDay: time.julianEphemerisDay, status: "approximate", reason: "birth_time_approximate" }
      : { julianEphemerisDay: time.julianEphemerisDay, status: "exact", reason: "none" };
  }
  const window = time.resolution.value;
  if (!window) throw new CalculationUnavailableError(time.resolution.reason);
  const start = astronomy.time(window.utcStartIso).julianEphemerisDay;
  const end = astronomy.time(window.utcEndIso).julianEphemerisDay;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new CalculationUnavailableError("insufficient_data");
  }
  return {
    julianEphemerisDay: (start + end) / 2,
    status: "bounded",
    reason: time.resolution.reason === "none" ? "insufficient_data" : time.resolution.reason,
  };
};

const angleState = (
  time: TimeData,
  astronomy: AstronomyPort,
  longitude: number,
  latitude: number,
): { core: CoreAngles | null; auxiliary: AuxiliaryAngles | null } => {
  if (time.julianDay === null || time.julianEphemerisDay === null || time.utcIso === null) {
    return { core: null, auxiliary: null };
  }
  const geometry = astronomy.geometry(time.julianDay, time.julianEphemerisDay);
  const core = coreAngles(geometry, longitude, latitude);
  return {
    core,
    auxiliary: auxiliaryAngles(core, latitude, geometry.trueObliquityRadians),
  };
};

const houseState = (
  zodiac: Zodiac,
  angles: CoreAngles | null,
  astronomy: AstronomyPort,
  time: TimeData,
  latitude: number,
  ayanamsha: number,
  state: TimedState,
) => {
  if (!angles || time.julianDay === null || time.julianEphemerisDay === null) {
    return unavailableHouseCharts(state.reason);
  }
  const geometry = astronomy.geometry(time.julianDay, time.julianEphemerisDay);
  const status = state.status === "approximate" ? "approximate" : "exact";
  return calculateHouseCharts({
    angles,
    latitudeDegrees: latitude,
    obliquityRadians: geometry.trueObliquityRadians,
    zodiac,
    ayanamshaDegrees: ayanamsha,
    calculationStatus: status,
    calculationReason: status === "approximate" ? state.reason : "none",
  });
};

const speed = (
  id: PointId,
  astronomy: AstronomyData,
  orbit: LunarOrbitSample,
): number | null => {
  if (planets.includes(id as PlanetId)) return astronomy.bodies[id as PlanetId].longitudeSpeedDegreesPerDay.value;
  switch (id) {
    case "north_node_true":
    case "south_node_true": return orbit.trueNode.speedDegreesPerDay;
    case "north_node_mean":
    case "south_node_mean": return orbit.meanNode.speedDegreesPerDay;
    case "lilith_mean": return orbit.meanApogee.speedDegreesPerDay;
    case "lilith_true": return orbit.trueApogee.speedDegreesPerDay;
    default: return null;
  }
};

const aspectPoints = (
  points: PointMap<AstrologicalPoint>,
  astronomy: AstronomyData,
  orbit: LunarOrbitSample,
): AspectPoint[] => pointIds.flatMap((id) => {
  const position = points[id].position.value;
  return position
    ? [{ id, longitudeDegrees: position.longitudeDegrees, speedDegreesPerDay: speed(id, astronomy, orbit) }]
    : [];
});

const patternPoints = (points: PointMap<AstrologicalPoint>): PatternPoint[] => pointIds.flatMap((id) => {
  const position = points[id].position.value;
  return position ? [{ id, position }] : [];
});

const lunarPhaseUnavailable = (reason: CalcReason): LunarPhase => ({
  angleDegrees: unavailable(reason),
  phase: unavailable(reason),
  illumination: unavailable(reason),
  ageDays: unavailable(reason),
  waxing: unavailable(reason),
});

const calculateLunarPhase = (astronomy: AstronomyData): LunarPhase => {
  const sun = astronomy.bodies.sun.eclipticLongitudeDegrees;
  const moon = astronomy.bodies.moon.eclipticLongitudeDegrees;
  if (sun.value === null || moon.value === null) {
    return lunarPhaseUnavailable(sun.reason !== "none" ? sun.reason : moon.reason);
  }
  const base = lunarPhase(sun.value, moon.value);
  const status: TimedStatus = sun.status === "bounded" || moon.status === "bounded"
    ? "bounded"
    : sun.status === "approximate" || moon.status === "approximate"
      ? "approximate"
      : "exact";
  const reason = sun.reason !== "none" ? sun.reason : moon.reason;
  return {
    angleDegrees: calculated(base.angleDegrees.value as number, status, reason),
    phase: calculated(base.phase.value as NonNullable<LunarPhase["phase"]["value"]>, status, reason),
    illumination: calculated(base.illumination.value as number, status, reason),
    ageDays: calculated(base.ageDays.value as number, status, reason),
    waxing: calculated(base.waxing.value as boolean, status, reason),
  };
};

const zodiacCalculation = (
  zodiac: Zodiac,
  selectedAyanamsha: Ayanamsha,
  ayanamshaValue: number,
  ayanamshaCalc: Calc<number>,
  astronomy: AstronomyData,
  orbit: LunarOrbitSample,
  angles: CoreAngles | null,
  auxiliary: AuxiliaryAngles | null,
  houses: ReturnType<typeof unavailableHouseCharts>,
  sect: Calc<"day" | "night">,
  lots: ReturnType<typeof calculateLots>,
  timed: TimedState,
  eclipses: ReturnType<typeof calculateEclipses>,
): ZodiacCalculation => {
  const built = buildPoints({
    astronomy,
    houses,
    angles,
    auxiliary,
    lunarOrbit: orbit,
    lots,
    sect,
    zodiac,
    ayanamshaDegrees: ayanamshaValue,
    timedStatus: timed.status,
    timedReason: timed.reason,
    unavailableReason: timed.reason,
  });
  const aspects = detectAspects(aspectPoints(built.points, astronomy, orbit));
  const declinationAspects = detectDeclinationAspects(planets.flatMap((id) => {
    const value = astronomy.bodies[id].declinationRadians.value;
    return value === null ? [] : [{ id, declinationRadians: value }];
  }));
  const patterns = detectPatterns(patternPoints(built.points), aspects);
  return {
    zodiac,
    ayanamsha: zodiac === "sidereal" ? selectedAyanamsha : null,
    ayanamshaDegrees: zodiac === "sidereal" ? ayanamshaCalc : calculated(0, "exact", "none"),
    points: built.points,
    houses: built.houses,
    aspects,
    declinationAspects,
    patterns,
    lunarPhase: calculateLunarPhase(astronomy),
    eclipses,
    derived: calculateDerived({ points: built.points, aspects, sect }),
  };
};

const warnings = (
  input: BirthInput,
  time: TimeData,
  tropical: ZodiacCalculation,
  sidereal: ZodiacCalculation,
): CalculationWarning[] => {
  const result: CalculationWarning[] = [];
  if (input.timeAccuracy === "unknown") {
    result.push({
      code: "birth_time_unknown",
      message: "Birth time is unknown; planetary positions are bounded to the civil date and timed angles, houses, lots and eclipse timing remain unavailable.",
      sourceRefs: [ref("astral-calculation/time/resolution")],
    });
  } else if (input.timeAccuracy === "approximate") {
    result.push({
      code: "birth_time_approximate",
      message: "Birth time is approximate; timed angles, houses and dependent values are marked approximate.",
      sourceRefs: [ref("astral-calculation/time/resolution")],
    });
  }
  if (time.resolution.reason === "ambiguous_local_time") {
    result.push({
      code: "ambiguous_local_time",
      message: "The supplied local time occurs twice; planetary positions are bounded across both instants and timed angles and houses remain unavailable.",
      sourceRefs: [ref("astral-calculation/time/resolution")],
    });
  }
  for (const [zodiac, system] of [["tropical", tropical], ["sidereal", sidereal]] as const) {
    if (system.houses.placidus.status === "fallback") {
      result.push({
        code: `polar_placidus_fallback_${zodiac}`,
        message: `${zodiac} Placidus houses failed at the supplied latitude; the explicitly labelled Porphyry fallback is retained.`,
        sourceRefs: [ref(`astral-calculation/systems/${zodiac}/houses/placidus`)],
      });
    }
  }
  return result;
};

const fingerprint = async (value: object): Promise<string> =>
  `sha256:${await digest("SHA-256", canonicalBytes(value))}`;

export class CalculationService {
  readonly #ports: CalculationPorts;

  constructor(ports: CalculationPorts) {
    this.#ports = ports;
  }

  async calculate(input: BirthInput, options: CalculationOptions): Promise<AstralCalculation> {
    const place = await this.#ports.places.get(input.placeId);
    const time = resolveBirthTime(input, place.timeZone, this.#ports.timeResolver, this.#ports.astronomy);
    const timed = timeState(time, this.#ports.astronomy);
    const astronomy = calculateAstronomy(time, this.#ports.astronomy);
    if (planets.some((id) => astronomy.bodies[id].eclipticLongitudeDegrees.value === null)) {
      throw new CalculationUnavailableError(time.resolution.reason);
    }

    const angles = angleState(time, this.#ports.astronomy, place.longitude, place.latitude);
    const sect = calculateSect(
      astronomy,
      angles.core,
      place.latitude,
      timed.status,
      timed.reason,
    );
    const lots = calculateLots(astronomy, angles.core, sect);
    const orbit = this.#ports.lunarOrbit.sample(timed.julianEphemerisDay);
    const siderealDegrees = ayanamshaDegrees(timed.julianEphemerisDay, options.ayanamsha);
    const siderealCalc = calculated(siderealDegrees, timed.status, timed.reason);
    const tropicalHouses = houseState(
      "tropical",
      angles.core,
      this.#ports.astronomy,
      time,
      place.latitude,
      0,
      timed,
    );
    const siderealHouses = houseState(
      "sidereal",
      angles.core,
      this.#ports.astronomy,
      time,
      place.latitude,
      siderealDegrees,
      timed,
    );
    const eclipseValues = calculateEclipses({
      time,
      astronomy: this.#ports.astronomy,
      lunarOrbit: this.#ports.lunarOrbit,
      eclipses: this.#ports.eclipses,
      ayanamsha: options.ayanamsha,
    });

    const tropical = zodiacCalculation(
      "tropical",
      options.ayanamsha,
      0,
      calculated(0, "exact", "none"),
      astronomy,
      orbit,
      angles.core,
      angles.auxiliary,
      tropicalHouses,
      sect,
      lots,
      timed,
      eclipseValues,
    ) as TropicalCalculation;
    const sidereal = zodiacCalculation(
      "sidereal",
      options.ayanamsha,
      siderealDegrees,
      siderealCalc,
      astronomy,
      orbit,
      angles.core,
      angles.auxiliary,
      siderealHouses,
      sect,
      lots,
      timed,
      eclipseValues,
    ) as SiderealCalculation;

    const compatibility = {
      method: "natal_to_sign_archetype" as const,
      profile: compatibilityProfile,
      tropical: calculateCompatibility("tropical", tropical.points) as ReturnType<typeof calculateCompatibility> & { zodiac: "tropical" },
      sidereal: calculateCompatibility("sidereal", sidereal.points) as ReturnType<typeof calculateCompatibility> & { zodiac: "sidereal" },
    };
    const interpretationPlan: InterpretationPlan = buildInterpretationPlan(tropical, sidereal);
    const warningValues = warnings(input, time, tropical, sidereal);
    const settings = {
      primaryZodiac: options.primaryZodiac,
      siderealAyanamsha: options.ayanamsha,
      interpretationMode: options.interpretationMode,
      primaryHouseSystem: "placidus" as const,
      polarFallback: "porphyry" as const,
      houseSystems: ["placidus", "whole_sign", "equal", "porphyry"] as ["placidus", "whole_sign", "equal", "porphyry"],
    };
    const core = {
      schema: "astral-calculation/1.0.0" as const,
      subject: {
        providedName: input.name?.trim() || null,
        language: input.lang?.trim() || "en",
        adult: true as const,
      },
      birth: { date: input.date, time: input.time, timeAccuracy: input.timeAccuracy },
      place,
      time,
      settings,
      astronomy,
      systems: { tropical, sidereal },
      compatibility,
      interpretationPlan,
      warnings: warningValues,
    };
    const calculationFingerprint = await fingerprint(core);
    return {
      ...core,
      provenance: {
        generatedAt: this.#ports.now(),
        astralChartsVersion: this.#ports.version,
        astronomia: vendorRevisions.astronomia,
        places: vendorRevisions.places,
        time: {
          repository: vendorRevisions.time.repository,
          revision: vendorRevisions.time.revision,
          version: `${vendorRevisions.time.coreVersion}+${vendorRevisions.time.timezoneVersion}`,
          timeZoneDatabaseVersion: this.#ports.timeResolver.info.dataVersion,
          calendar: "proleptic_gregorian",
          supportedRange: this.#ports.timeResolver.info.supportedRange,
        },
        astrologyProfile: calculationProfile,
        aspectProfile,
        dignityProfile,
        compatibilityProfile,
        calculationFingerprint,
      },
    };
  }
}

export const loadCalculationPorts = async (version = "0.10.0"): Promise<CalculationPorts> => {
  const [places, timeResolver, astronomy, lunarOrbit, eclipses] = await Promise.all([
    loadCscCatalogue(),
    loadTimeResolver(),
    loadAstronomia(),
    loadLunarOrbit(),
    loadEclipses(),
  ]);
  return {
    places,
    timeResolver,
    astronomy,
    lunarOrbit,
    eclipses,
    version,
    now: () => new Date().toISOString(),
  };
};

export const loadCalculationService = async (
  config: Config,
  version = "0.10.0",
): Promise<{ service: CalculationService; options: CalculationOptions }> => ({
  service: new CalculationService(await loadCalculationPorts(version)),
  options: optionsFromConfig(config),
});
