import type { AstralFile, CompatibilityDomainScores, Sign } from "../types/index.js";

const signs: readonly Sign[] = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

export const generatedNamePattern = /^[\p{L}\p{N}]+-[\p{L}\p{N}]+-[\p{L}\p{N}]+$/u;

export const compatibilityValid = (domain: CompatibilityDomainScores): boolean => {
  if (domain.ranked.length !== 12 || new Set(domain.ranked).size !== 12) return false;
  if (!signs.every((sign) => domain.ranked.includes(sign) && domain.signs[sign].sign === sign)) return false;
  const ranks = signs.map((sign) => domain.signs[sign].rank).sort((a, b) => a - b);
  return ranks.every((rank, index) => rank === index + 1)
    && signs.every((sign) => domain.signs[sign].score >= 0 && domain.signs[sign].score <= 100);
};

export const rootShapeValid = (file: AstralFile): boolean => {
  const keys = Object.keys(file);
  return keys.length === 5
    && keys[0] === "schema"
    && keys[1] === "astral-calculation"
    && keys[2] === "astral-chart"
    && keys[3] === "crc"
    && keys[4] === "authority"
    && file.schema === "astral/1.0.0";
};
