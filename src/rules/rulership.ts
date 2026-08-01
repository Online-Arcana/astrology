import type { PlanetId, Sign } from "../types/astro.js";

export const rulershipProfile = "western_rulership/1.0.0" as const;

export const traditionalRulers: Readonly<Record<Sign, PlanetId>> = {
  aries: "mars",
  taurus: "venus",
  gemini: "mercury",
  cancer: "moon",
  leo: "sun",
  virgo: "mercury",
  libra: "venus",
  scorpio: "mars",
  sagittarius: "jupiter",
  capricorn: "saturn",
  aquarius: "saturn",
  pisces: "jupiter",
};

export const modernRulers: Readonly<Record<Sign, PlanetId>> = {
  ...traditionalRulers,
  scorpio: "pluto",
  aquarius: "uranus",
  pisces: "neptune",
};
