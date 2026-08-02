import type { PlanetId, Sign } from "../types/astro.js";

export const dignityProfile = "traditional_dignity/1.0.0" as const;
export const boundsProfile = "egyptian_bounds/1.0.0" as const;
export const facesProfile = "chaldean_faces/1.0.0" as const;
export const triplicityProfile = "dorothean_triplicity/1.0.0" as const;

export type Element = "fire" | "earth" | "air" | "water";

export interface TriplicityRule {
  day: PlanetId;
  night: PlanetId;
  participating: PlanetId;
}

export interface BoundSegment {
  ruler: PlanetId;
  start: number;
  end: number;
}

export const signElements: Readonly<Record<Sign, Element>> = {
  aries: "fire",
  taurus: "earth",
  gemini: "air",
  cancer: "water",
  leo: "fire",
  virgo: "earth",
  libra: "air",
  scorpio: "water",
  sagittarius: "fire",
  capricorn: "earth",
  aquarius: "air",
  pisces: "water",
};

export const triplicityRules: Readonly<Record<Element, TriplicityRule>> = {
  fire: { day: "sun", night: "jupiter", participating: "saturn" },
  earth: { day: "venus", night: "moon", participating: "mars" },
  air: { day: "saturn", night: "mercury", participating: "jupiter" },
  water: { day: "venus", night: "mars", participating: "moon" },
};

export const exaltationRulers: Readonly<Partial<Record<Sign, PlanetId>>> = {
  aries: "sun",
  taurus: "moon",
  cancer: "jupiter",
  virgo: "mercury",
  libra: "saturn",
  capricorn: "mars",
  pisces: "venus",
};

export const detrimentSigns: Readonly<Partial<Record<PlanetId, readonly Sign[]>>> = {
  sun: ["aquarius"],
  moon: ["capricorn"],
  mercury: ["sagittarius", "pisces"],
  venus: ["aries", "scorpio"],
  mars: ["taurus", "libra"],
  jupiter: ["gemini", "virgo"],
  saturn: ["cancer", "leo"],
};

export const fallSigns: Readonly<Partial<Record<PlanetId, readonly Sign[]>>> = {
  sun: ["libra"],
  moon: ["scorpio"],
  mercury: ["pisces"],
  venus: ["virgo"],
  mars: ["cancer"],
  jupiter: ["capricorn"],
  saturn: ["aries"],
};

export const egyptianBounds: Readonly<Record<Sign, readonly BoundSegment[]>> = {
  aries: [
    { ruler: "jupiter", start: 0, end: 6 },
    { ruler: "venus", start: 6, end: 12 },
    { ruler: "mercury", start: 12, end: 20 },
    { ruler: "mars", start: 20, end: 25 },
    { ruler: "saturn", start: 25, end: 30 },
  ],
  taurus: [
    { ruler: "venus", start: 0, end: 8 },
    { ruler: "mercury", start: 8, end: 14 },
    { ruler: "jupiter", start: 14, end: 22 },
    { ruler: "saturn", start: 22, end: 27 },
    { ruler: "mars", start: 27, end: 30 },
  ],
  gemini: [
    { ruler: "mercury", start: 0, end: 6 },
    { ruler: "jupiter", start: 6, end: 12 },
    { ruler: "venus", start: 12, end: 17 },
    { ruler: "mars", start: 17, end: 24 },
    { ruler: "saturn", start: 24, end: 30 },
  ],
  cancer: [
    { ruler: "mars", start: 0, end: 7 },
    { ruler: "venus", start: 7, end: 13 },
    { ruler: "mercury", start: 13, end: 19 },
    { ruler: "jupiter", start: 19, end: 26 },
    { ruler: "saturn", start: 26, end: 30 },
  ],
  leo: [
    { ruler: "jupiter", start: 0, end: 6 },
    { ruler: "venus", start: 6, end: 11 },
    { ruler: "saturn", start: 11, end: 18 },
    { ruler: "mercury", start: 18, end: 24 },
    { ruler: "mars", start: 24, end: 30 },
  ],
  virgo: [
    { ruler: "mercury", start: 0, end: 7 },
    { ruler: "venus", start: 7, end: 17 },
    { ruler: "jupiter", start: 17, end: 21 },
    { ruler: "mars", start: 21, end: 28 },
    { ruler: "saturn", start: 28, end: 30 },
  ],
  libra: [
    { ruler: "saturn", start: 0, end: 6 },
    { ruler: "mercury", start: 6, end: 14 },
    { ruler: "jupiter", start: 14, end: 21 },
    { ruler: "venus", start: 21, end: 28 },
    { ruler: "mars", start: 28, end: 30 },
  ],
  scorpio: [
    { ruler: "mars", start: 0, end: 7 },
    { ruler: "venus", start: 7, end: 11 },
    { ruler: "mercury", start: 11, end: 19 },
    { ruler: "jupiter", start: 19, end: 24 },
    { ruler: "saturn", start: 24, end: 30 },
  ],
  sagittarius: [
    { ruler: "jupiter", start: 0, end: 12 },
    { ruler: "venus", start: 12, end: 17 },
    { ruler: "mercury", start: 17, end: 21 },
    { ruler: "saturn", start: 21, end: 26 },
    { ruler: "mars", start: 26, end: 30 },
  ],
  capricorn: [
    { ruler: "mercury", start: 0, end: 7 },
    { ruler: "jupiter", start: 7, end: 14 },
    { ruler: "venus", start: 14, end: 22 },
    { ruler: "saturn", start: 22, end: 26 },
    { ruler: "mars", start: 26, end: 30 },
  ],
  aquarius: [
    { ruler: "mercury", start: 0, end: 7 },
    { ruler: "venus", start: 7, end: 13 },
    { ruler: "jupiter", start: 13, end: 20 },
    { ruler: "mars", start: 20, end: 25 },
    { ruler: "saturn", start: 25, end: 30 },
  ],
  pisces: [
    { ruler: "venus", start: 0, end: 12 },
    { ruler: "jupiter", start: 12, end: 16 },
    { ruler: "mercury", start: 16, end: 19 },
    { ruler: "mars", start: 19, end: 28 },
    { ruler: "saturn", start: 28, end: 30 },
  ],
};

export const chaldeanFaceSequence = [
  "mars", "sun", "venus", "mercury", "moon", "saturn", "jupiter",
] as const satisfies readonly PlanetId[];
