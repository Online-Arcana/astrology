import { modernCoRulers, traditionalRulers } from "../rules/rulership.js";
import type { JsonRef } from "../types/base.js";
import type {
  AstrologicalPoint,
  CompatibilityDomain,
  CompatibilityMatrix,
  PlanetId,
  PointId,
  PointMap,
  ScoreFactor,
  Sign,
  Zodiac,
} from "../types/astro.js";
import { signs } from "../zodiac/position.js";
import { compatibilityDomains, compatibilityRules, type SignRelation } from "./catalogue.js";
import { compatibilityProfile, rankCompatibility, type RawCompatibility } from "./rank.js";

interface PendingFactor {
  id: string;
  ruleId: string;
  weight: number;
  value: number;
  sourceRefs: JsonRef[];
}

const signIndex = new Map(signs.map((sign, index) => [sign, index]));

const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

export const signRelation = (a: Sign, b: Sign): SignRelation => {
  const left = signIndex.get(a);
  const right = signIndex.get(b);
  if (left === undefined || right === undefined) throw new Error("Unknown zodiac sign");
  const raw = Math.abs(left - right);
  const step = Math.min(raw, 12 - raw);
  switch (step) {
    case 0: return "conjunction";
    case 1: return "semisextile";
    case 2: return "sextile";
    case 3: return "square";
    case 4: return "trine";
    case 5: return "quincunx";
    case 6: return "opposition";
    default: throw new Error(`Invalid sign distance ${step}`);
  }
};

const pointRef = (zodiac: Zodiac, point: PointId): JsonRef =>
  `#/astral-calculation/systems/${zodiac}/points/${point}/position`;

const relationFactor = (
  zodiac: Zodiac,
  domain: CompatibilityDomain,
  candidate: Sign,
  point: PointId,
  pointSign: Sign,
  weight: number,
  role: "point" | "traditional_ruler" | "modern_co_ruler",
): PendingFactor => {
  const relation = signRelation(candidate, pointSign);
  const value = compatibilityRules[domain].relationValues[relation];
  return {
    id: `${domain}.${candidate}.${role}.${point}`,
    ruleId: `${compatibilityProfile}#${domain}.${role}.${relation}`,
    weight,
    value,
    sourceRefs: [pointRef(zodiac, point)],
  };
};

const availableSign = (points: PointMap<AstrologicalPoint>, point: PointId): Sign | null =>
  points[point].position.value?.sign ?? null;

const completeFactors = (pending: readonly PendingFactor[]): { score: number; factors: ScoreFactor[] } => {
  const totalWeight = pending.reduce((sum, factor) => sum + factor.weight, 0);
  if (!(totalWeight > 0)) throw new Error("Compatibility scoring has no available factors");
  const factors = pending.map((factor): ScoreFactor => ({
    ...factor,
    contribution: round(factor.weight * factor.value / totalWeight * 100),
  }));
  return {
    score: round(pending.reduce((sum, factor) => sum + factor.weight * factor.value, 0) / totalWeight * 100),
    factors,
  };
};

const scoreSign = (
  zodiac: Zodiac,
  domain: CompatibilityDomain,
  candidate: Sign,
  points: PointMap<AstrologicalPoint>,
): RawCompatibility => {
  const rule = compatibilityRules[domain];
  const pending: PendingFactor[] = [];

  for (const { point, weight } of rule.points) {
    const pointSign = availableSign(points, point);
    if (pointSign === null) continue;
    pending.push(relationFactor(zodiac, domain, candidate, point, pointSign, weight, "point"));
  }

  const traditionalRuler = traditionalRulers[candidate];
  const traditionalSign = availableSign(points, traditionalRuler);
  if (traditionalSign !== null) {
    pending.push(relationFactor(
      zodiac,
      domain,
      candidate,
      traditionalRuler,
      traditionalSign,
      rule.traditionalRulerWeight,
      "traditional_ruler",
    ));
  }

  const modernCoRuler = modernCoRulers[candidate];
  if (modernCoRuler !== undefined && rule.modernCoRulerWeight > 0) {
    const modernSign = availableSign(points, modernCoRuler);
    if (modernSign !== null) {
      pending.push(relationFactor(
        zodiac,
        domain,
        candidate,
        modernCoRuler,
        modernSign,
        rule.modernCoRulerWeight,
        "modern_co_ruler",
      ));
    }
  }

  const completed = completeFactors(pending);
  return { sign: candidate, ...completed };
};

export const calculateCompatibilityDomain = (
  zodiac: Zodiac,
  domain: CompatibilityDomain,
  points: PointMap<AstrologicalPoint>,
) => rankCompatibility(
  zodiac,
  domain,
  signs.map((sign) => scoreSign(zodiac, domain, sign, points)),
);

export const calculateCompatibility = (
  zodiac: Zodiac,
  points: PointMap<AstrologicalPoint>,
): CompatibilityMatrix => {
  const domains = {} as CompatibilityMatrix["domains"];
  for (const domain of compatibilityDomains) {
    domains[domain] = calculateCompatibilityDomain(zodiac, domain, points);
  }
  return { zodiac, domains };
};

export const candidateRulers = (sign: Sign): { traditional: PlanetId; modern: PlanetId | null } => ({
  traditional: traditionalRulers[sign],
  modern: modernCoRulers[sign] ?? null,
});
