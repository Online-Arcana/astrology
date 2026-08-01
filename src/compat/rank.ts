import type {
  CompatibilityDomain,
  CompatibilityDomainScores,
  CompatibilityLevel,
  CompatibilityRelation,
  ScoreFactor,
  Sign,
} from "../types/astro.js";
import { signs } from "../zodiac/position.js";

export const compatibilityProfile = "western_compatibility/1.0.0" as const;

export interface RawCompatibility {
  sign: Sign;
  score: number;
  factors: ScoreFactor[];
}

const level = (score: number): CompatibilityLevel => score >= 67 ? "high" : score >= 34 ? "medium" : "low";
const relation = (value: CompatibilityLevel): CompatibilityRelation =>
  value === "high" ? "compatible" : value === "medium" ? "neutral" : "incompatible";

export const rankCompatibility = (
  zodiac: "tropical" | "sidereal",
  domain: CompatibilityDomain,
  raw: readonly RawCompatibility[],
): CompatibilityDomainScores => {
  if (raw.length !== 12 || new Set(raw.map((entry) => entry.sign)).size !== 12) {
    throw new Error(`${zodiac}.${domain} must contain every sign exactly once`);
  }
  const order = new Map(signs.map((sign, index) => [sign, index]));
  const ranked = [...raw]
    .map((entry) => ({ ...entry, score: Math.max(0, Math.min(100, entry.score)) }))
    .sort((a, b) => b.score - a.score || (order.get(a.sign) ?? 0) - (order.get(b.sign) ?? 0));
  const scoreMap = {} as CompatibilityDomainScores["signs"];
  ranked.forEach((entry, index) => {
    const compatibilityLevel = level(entry.score);
    scoreMap[entry.sign] = {
      sign: entry.sign,
      score: entry.score,
      rank: index + 1,
      level: compatibilityLevel,
      relation: relation(compatibilityLevel),
      factors: entry.factors,
    };
  });
  return { domain, ranked: ranked.map((entry) => entry.sign), signs: scoreMap };
};
