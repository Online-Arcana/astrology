import { compatibilityDomains } from "../../compat/catalogue.js";

const bodies = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

const points = [
  "north-node", "south-node", "black-moon-lilith", "part-of-fortune", "part-of-spirit",
] as const;

const angles = [
  "ascendant", "descendant", "midheaven", "imum-coeli", "vertex", "antivertex", "east-point",
] as const;

const signs = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

const aspects = [
  "conjunction", "opposition", "trine", "square", "sextile",
  "quincunx", "semisextile", "semisquare", "sesquiquadrate", "quintile", "biquintile",
] as const;

const patterns = [
  "stellium", "t-square", "grand-trine", "grand-cross", "yod",
  "kite", "mystic-rectangle", "grand-sextile", "thor-hammer",
] as const;

const derived = [
  "lunar-phase",
  "eclipses-at-birth",
  "eclipses-prenatal-solar",
  "eclipses-prenatal-lunar",
  "rulership-dignity",
  "chart-balance",
  "dominant-themes",
] as const;

const lifeDomains = [
  "identityAndPurpose",
  "emotionalNature",
  "mindAndCommunication",
  "romance",
  "sexuality",
  "committedPartnerships",
  "homeAndFamily",
  "childhoodPatterns",
  "creativityAndSelfExpression",
  "childrenAndNurturing",
  "friendship",
  "communityAndGroups",
  "workStyle",
  "careerAndVocation",
  "businessAndLeadership",
  "moneyAndMaterialSecurity",
  "publicLifeAndAmbition",
  "conflictAndAssertion",
  "growthAndOpportunity",
  "restrictionsAndResponsibility",
  "transformationAndCrisis",
  "spiritualityAndMeaning",
  "unconsciousPatterns",
  "wellbeingAndDailyRhythm",
  "developmentalDirection",
] as const;

export const requiredCorpusAtomIds: readonly string[] = [
  ...bodies.map((id) => `body.${id}`),
  ...points.map((id) => `point.${id}`),
  ...angles.map((id) => `angle.${id}`),
  ...signs.map((id) => `sign.${id}`),
  ...Array.from({ length: 12 }, (_, index) => `house.${index + 1}`),
  ...aspects.map((id) => `aspect.${id}`),
  ...patterns.map((id) => `pattern.${id}`),
  ...derived.map((id) => `derived.${id}`),
  ...lifeDomains.map((id) => `life-domain.${id}`),
  ...compatibilityDomains.map((id) => `compatibility-domain.${id.replaceAll("_", "-")}`),
  "synthesis.overview",
  "synthesis.system-synthesis",
  "synthesis.final-synthesis",
] as const;

export const requiredCorpusAtomSet = new Set(requiredCorpusAtomIds);
