import type { Calc, CalcReason, JsonRef } from "./base.js";

export type Zodiac = "tropical" | "sidereal";
export type Ayanamsha = "lahiri" | "fagan_bradley" | "krishnamurti" | "raman";
export type HouseSystem = "placidus" | "whole_sign" | "equal" | "porphyry";

export type HouseMap<T> = {
  "1": T; "2": T; "3": T; "4": T; "5": T; "6": T;
  "7": T; "8": T; "9": T; "10": T; "11": T; "12": T;
};

export type PlanetId =
  | "sun" | "moon" | "mercury" | "venus" | "mars"
  | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto";
export type NodeId =
  | "north_node_true" | "south_node_true"
  | "north_node_mean" | "south_node_mean";
export type AngleId =
  | "ascendant" | "descendant" | "midheaven" | "imum_coeli"
  | "vertex" | "antivertex" | "east_point";
export type LotId = "part_of_fortune" | "part_of_spirit";
export type OtherPointId = "lilith_mean" | "lilith_true";
export type PointId = PlanetId | NodeId | AngleId | LotId | OtherPointId;

export type Sign =
  | "aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo"
  | "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces";

export type SignMap<T> = Record<Sign, T>;
export type PointMap<T> = Record<PointId, T>;

export interface SignPosition {
  longitudeDegrees: number;
  sign: Sign;
  degree: number;
  minute: number;
  second: number;
  decan: 1 | 2 | 3;
  degreeWithinSign: number;
}

export interface BodyState {
  id: PlanetId;
  rightAscensionRadians: Calc<number>;
  declinationRadians: Calc<number>;
  eclipticLongitudeDegrees: Calc<number>;
  eclipticLatitudeDegrees: Calc<number>;
  distanceAu: Calc<number>;
  longitudeSpeedDegreesPerDay: Calc<number>;
  motion: "direct" | "retrograde" | "stationary" | "unknown";
}

export interface AstronomyReferenceFrame {
  centre: "geocentric";
  coordinates: "apparent";
  epoch: "date";
}

export interface AstronomyData {
  frame: AstronomyReferenceFrame;
  bodies: Record<PlanetId, BodyState>;
}

export interface HousePlacement {
  house: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  distanceFromCuspDegrees: number;
  intercepted: boolean;
}

export interface DignityState {
  traditionalRuler: PlanetId;
  modernRuler: PlanetId | null;
  domicile: boolean;
  exalted: boolean;
  detriment: boolean;
  fallen: boolean;
  triplicityRuler: boolean;
  boundRuler: boolean;
  faceRuler: boolean;
  peregrine: boolean;
  score: number;
  ruleRefs: string[];
}

export interface AstrologicalPoint {
  id: PointId;
  kind: "planet" | "luminary" | "node" | "angle" | "lot" | "lilith";
  position: Calc<SignPosition>;
  houses: Record<HouseSystem, Calc<HousePlacement>>;
  motion: "direct" | "retrograde" | "stationary" | "not_applicable" | "unknown";
  dignity: Calc<DignityState>;
}

export interface House {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  cusp: Calc<SignPosition>;
  end: Calc<SignPosition>;
  rulerTraditional: Calc<PlanetId>;
  rulerModern: Calc<PlanetId>;
  occupants: PointId[];
  interceptedSigns: Sign[];
}

export interface HouseChart {
  system: HouseSystem;
  status: "calculated" | "fallback" | "unavailable";
  fallbackFrom: HouseSystem | null;
  reason: CalcReason;
  houses: HouseMap<House>;
}

export type AspectKind =
  | "conjunction" | "opposition" | "trine" | "square" | "sextile"
  | "quincunx" | "semisextile" | "semisquare" | "sesquiquadrate"
  | "quintile" | "biquintile";

export interface Aspect {
  id: string;
  a: PointId;
  b: PointId;
  kind: AspectKind;
  exactAngleDegrees: number;
  actualAngleDegrees: number;
  orbDegrees: number;
  allowedOrbDegrees: number;
  phase: "applying" | "separating" | "exact" | "unknown";
  class: "major" | "minor";
  character: "flowing" | "challenging" | "contextual" | "adjusting" | "creative";
  strength: number;
  ruleRefs: string[];
}

export interface DeclinationAspect {
  id: string;
  a: PointId;
  b: PointId;
  kind: "parallel" | "contra_parallel";
  orbDegrees: number;
  allowedOrbDegrees: number;
  strength: number;
}

export type PatternKind =
  | "stellium" | "t_square" | "grand_trine" | "grand_cross" | "yod"
  | "kite" | "mystic_rectangle" | "grand_sextile" | "thor_hammer";

export interface AspectPattern {
  id: string;
  kind: PatternKind;
  points: PointId[];
  aspects: string[];
  element: string | null;
  modality: string | null;
  focalPoint: PointId | null;
  strength: number;
  ruleRefs: string[];
}

export type LunarPhaseName =
  | "new" | "crescent" | "first_quarter" | "gibbous"
  | "full" | "disseminating" | "last_quarter" | "balsamic";

export interface LunarPhase {
  angleDegrees: Calc<number>;
  phase: Calc<LunarPhaseName>;
  illumination: Calc<number>;
  ageDays: Calc<number>;
  waxing: Calc<boolean>;
}

export interface NatalEclipse {
  kind: "solar" | "lunar";
  type: "partial" | "total" | "annular" | "hybrid" | "penumbral";
  exactUtcIso: string;
  birthOffsetSeconds: number;
  magnitude: number | null;
  node: "north" | "south";
  sunMoonAngleDegrees: number;
  nodeDistanceDegrees: number;
}

export interface PrenatalEclipse {
  kind: "solar" | "lunar";
  type: string;
  exactUtcIso: string;
  daysBeforeBirth: number;
  zodiac: Zodiac;
  position: SignPosition;
  node: "north" | "south";
  magnitude: number | null;
}

export interface MutualReception {
  a: PlanetId;
  b: PlanetId;
  system: "traditional" | "modern";
  ruleRefs: string[];
}

export interface DominantPlanet {
  planet: PlanetId;
  score: number;
  factors: string[];
}

export interface DominantSign {
  sign: Sign;
  score: number;
  factors: string[];
}

export interface DerivedChart {
  sect: Calc<"day" | "night">;
  chartRuler: {
    traditional: Calc<PlanetId>;
    modern: Calc<PlanetId>;
  };
  dispositors: {
    traditional: Record<PlanetId, PlanetId>;
    modern: Record<PlanetId, PlanetId>;
    finalTraditional: PlanetId | null;
    finalModern: PlanetId | null;
  };
  mutualReceptions: MutualReception[];
  balances: {
    elements: { fire: number; earth: number; air: number; water: number };
    modalities: { cardinal: number; fixed: number; mutable: number };
    polarities: { active: number; receptive: number };
    hemispheres: { eastern: number; western: number; northern: number; southern: number };
    houseModes: { angular: number; succedent: number; cadent: number };
  };
  dominantPlanets: DominantPlanet[];
  dominantSigns: DominantSign[];
  retrogradePlanets: PlanetId[];
  unaspectedPlanets: PlanetId[];
  jonesPattern: Calc<"bowl" | "bucket" | "bundle" | "locomotive" | "see_saw" | "splash" | "splay">;
  lots: {
    fortune: Calc<AstrologicalPoint>;
    spirit: Calc<AstrologicalPoint>;
  };
}

export interface ZodiacCalculation {
  zodiac: Zodiac;
  ayanamsha: Ayanamsha | null;
  ayanamshaDegrees: Calc<number>;
  points: PointMap<AstrologicalPoint>;
  houses: Record<HouseSystem, HouseChart>;
  aspects: Aspect[];
  declinationAspects: DeclinationAspect[];
  patterns: AspectPattern[];
  lunarPhase: LunarPhase;
  eclipses: {
    atBirth: Calc<NatalEclipse>;
    prenatalSolar: Calc<PrenatalEclipse>;
    prenatalLunar: Calc<PrenatalEclipse>;
  };
  derived: DerivedChart;
}

export type TropicalCalculation = ZodiacCalculation & { zodiac: "tropical"; ayanamsha: null };
export type SiderealCalculation = ZodiacCalculation & { zodiac: "sidereal"; ayanamsha: Ayanamsha };

export type CompatibilityDomain =
  | "overall" | "romantic" | "sexual" | "emotional" | "communication"
  | "intellectual" | "friendship" | "business" | "domestic" | "long_term"
  | "conflict_resolution" | "spiritual";
export type CompatibilityLevel = "high" | "medium" | "low";
export type CompatibilityRelation = "compatible" | "neutral" | "incompatible";

export interface ScoreFactor {
  id: string;
  ruleId: string;
  weight: number;
  value: number;
  contribution: number;
  sourceRefs: JsonRef[];
}

export interface CompatibilityScore {
  sign: Sign;
  score: number;
  rank: number;
  level: CompatibilityLevel;
  relation: CompatibilityRelation;
  factors: ScoreFactor[];
}

export interface CompatibilityDomainScores {
  domain: CompatibilityDomain;
  ranked: Sign[];
  signs: SignMap<CompatibilityScore>;
}

export interface CompatibilityMatrix {
  zodiac: Zodiac;
  domains: Record<CompatibilityDomain, CompatibilityDomainScores>;
}
