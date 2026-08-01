import type { CompatibilityDomain, PointId } from "../types/astro.js";

export type SignRelation =
  | "conjunction"
  | "semisextile"
  | "sextile"
  | "square"
  | "trine"
  | "quincunx"
  | "opposition";

export interface CompatibilityPointWeight {
  point: PointId;
  weight: number;
}

export interface CompatibilityDomainRule {
  points: readonly CompatibilityPointWeight[];
  traditionalRulerWeight: number;
  modernCoRulerWeight: number;
  relationValues: Readonly<Record<SignRelation, number>>;
}

export const compatibilityDomains = [
  "overall",
  "romantic",
  "sexual",
  "emotional",
  "communication",
  "intellectual",
  "friendship",
  "business",
  "domestic",
  "long_term",
  "conflict_resolution",
  "spiritual",
] as const satisfies readonly CompatibilityDomain[];

const values = (
  conjunction: number,
  semisextile: number,
  sextile: number,
  square: number,
  trine: number,
  quincunx: number,
  opposition: number,
): Readonly<Record<SignRelation, number>> => ({
  conjunction,
  semisextile,
  sextile,
  square,
  trine,
  quincunx,
  opposition,
});

export const compatibilityRules: Readonly<Record<CompatibilityDomain, CompatibilityDomainRule>> = {
  overall: {
    points: [
      { point: "sun", weight: 2.5 },
      { point: "moon", weight: 2.5 },
      { point: "ascendant", weight: 1.5 },
      { point: "mercury", weight: 1 },
      { point: "venus", weight: 1.5 },
      { point: "mars", weight: 1 },
      { point: "jupiter", weight: 1 },
      { point: "saturn", weight: 1 },
    ],
    traditionalRulerWeight: 1.5,
    modernCoRulerWeight: 0.5,
    relationValues: values(0.92, 0.45, 0.78, 0.34, 0.90, 0.40, 0.62),
  },
  romantic: {
    points: [
      { point: "venus", weight: 3 },
      { point: "moon", weight: 2.5 },
      { point: "sun", weight: 1.5 },
      { point: "mars", weight: 1.5 },
      { point: "ascendant", weight: 1 },
      { point: "saturn", weight: 0.75 },
    ],
    traditionalRulerWeight: 1.25,
    modernCoRulerWeight: 0.5,
    relationValues: values(0.96, 0.43, 0.80, 0.45, 0.94, 0.36, 0.84),
  },
  sexual: {
    points: [
      { point: "mars", weight: 3 },
      { point: "venus", weight: 2.5 },
      { point: "pluto", weight: 1.5 },
      { point: "moon", weight: 1 },
      { point: "ascendant", weight: 0.75 },
      { point: "lilith_true", weight: 0.75 },
    ],
    traditionalRulerWeight: 1,
    modernCoRulerWeight: 0.75,
    relationValues: values(0.92, 0.50, 0.72, 0.78, 0.86, 0.43, 0.96),
  },
  emotional: {
    points: [
      { point: "moon", weight: 4 },
      { point: "venus", weight: 1.5 },
      { point: "sun", weight: 1 },
      { point: "neptune", weight: 1 },
      { point: "ascendant", weight: 1 },
    ],
    traditionalRulerWeight: 1,
    modernCoRulerWeight: 0.5,
    relationValues: values(0.96, 0.38, 0.84, 0.20, 1, 0.24, 0.46),
  },
  communication: {
    points: [
      { point: "mercury", weight: 4 },
      { point: "moon", weight: 1 },
      { point: "sun", weight: 1 },
      { point: "uranus", weight: 1 },
      { point: "ascendant", weight: 0.75 },
    ],
    traditionalRulerWeight: 1.25,
    modernCoRulerWeight: 0.5,
    relationValues: values(0.90, 0.55, 0.90, 0.34, 0.92, 0.44, 0.66),
  },
  intellectual: {
    points: [
      { point: "mercury", weight: 3 },
      { point: "jupiter", weight: 2 },
      { point: "uranus", weight: 2 },
      { point: "sun", weight: 1 },
      { point: "saturn", weight: 1 },
    ],
    traditionalRulerWeight: 1.25,
    modernCoRulerWeight: 0.5,
    relationValues: values(0.86, 0.58, 0.92, 0.52, 0.94, 0.60, 0.76),
  },
  friendship: {
    points: [
      { point: "sun", weight: 2 },
      { point: "moon", weight: 1.5 },
      { point: "mercury", weight: 2 },
      { point: "jupiter", weight: 2 },
      { point: "uranus", weight: 1 },
      { point: "ascendant", weight: 0.5 },
    ],
    traditionalRulerWeight: 1,
    modernCoRulerWeight: 0.5,
    relationValues: values(0.88, 0.55, 0.92, 0.38, 0.96, 0.48, 0.68),
  },
  business: {
    points: [
      { point: "mercury", weight: 2.5 },
      { point: "saturn", weight: 3 },
      { point: "jupiter", weight: 2 },
      { point: "mars", weight: 1 },
      { point: "midheaven", weight: 1.5 },
      { point: "sun", weight: 1 },
    ],
    traditionalRulerWeight: 1.5,
    modernCoRulerWeight: 0.25,
    relationValues: values(0.82, 0.56, 0.92, 0.60, 0.90, 0.62, 0.78),
  },
  domestic: {
    points: [
      { point: "moon", weight: 3.5 },
      { point: "venus", weight: 2 },
      { point: "saturn", weight: 2 },
      { point: "ascendant", weight: 1 },
      { point: "sun", weight: 1 },
      { point: "imum_coeli", weight: 1.5 },
    ],
    traditionalRulerWeight: 1,
    modernCoRulerWeight: 0.25,
    relationValues: values(0.96, 0.34, 0.84, 0.18, 0.98, 0.22, 0.42),
  },
  long_term: {
    points: [
      { point: "saturn", weight: 3 },
      { point: "venus", weight: 2 },
      { point: "moon", weight: 2 },
      { point: "sun", weight: 1.5 },
      { point: "jupiter", weight: 1 },
      { point: "ascendant", weight: 0.75 },
    ],
    traditionalRulerWeight: 1.5,
    modernCoRulerWeight: 0.25,
    relationValues: values(0.90, 0.38, 0.82, 0.30, 0.96, 0.32, 0.58),
  },
  conflict_resolution: {
    points: [
      { point: "mercury", weight: 3 },
      { point: "mars", weight: 2.5 },
      { point: "saturn", weight: 2 },
      { point: "moon", weight: 1.5 },
      { point: "venus", weight: 1 },
    ],
    traditionalRulerWeight: 1.25,
    modernCoRulerWeight: 0.25,
    relationValues: values(0.86, 0.50, 0.90, 0.48, 0.94, 0.56, 0.66),
  },
  spiritual: {
    points: [
      { point: "jupiter", weight: 3 },
      { point: "neptune", weight: 3 },
      { point: "moon", weight: 1.5 },
      { point: "sun", weight: 1 },
      { point: "north_node_true", weight: 1 },
      { point: "pluto", weight: 0.5 },
    ],
    traditionalRulerWeight: 1,
    modernCoRulerWeight: 0.75,
    relationValues: values(0.90, 0.56, 0.84, 0.32, 0.98, 0.62, 0.72),
  },
};
