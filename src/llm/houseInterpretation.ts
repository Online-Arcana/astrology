import type { InterpretationUnit } from "../types/file.js";

export interface HouseMeaning {
  number: number;
  title: string;
  meaning: string;
}

const meanings: Readonly<Record<number, Omit<HouseMeaning, "number">>> = {
  1: { title: "Self and identity", meaning: "identity, self-presentation, personal style, first impressions and the instinctive way you approach life" },
  2: { title: "Money, possessions and values", meaning: "personal resources, money, possessions, material security, self-worth and what you consider valuable" },
  3: { title: "Communication and everyday life", meaning: "communication, learning, siblings, neighbours, short journeys and the way you process and exchange everyday information" },
  4: { title: "Home, family and roots", meaning: "home, family, ancestry, private life and the emotional foundations that create a sense of belonging" },
  5: { title: "Creativity, pleasure and romance", meaning: "creativity, play, pleasure, dating, self-expression, children and the things that make life feel vivid" },
  6: { title: "Work, routines and wellbeing", meaning: "daily routines, practical work, service, habits, health and the systems that keep ordinary life functioning" },
  7: { title: "Partnerships and close relationships", meaning: "committed one-to-one relationships, partnership, collaboration, negotiation and qualities encountered through other people" },
  8: { title: "Intimacy, shared resources and change", meaning: "intimacy, shared money and obligations, trust, vulnerability, inheritance, loss and deep personal transformation" },
  9: { title: "Beliefs, travel and higher learning", meaning: "worldview, philosophy, religion, higher education, long-distance travel and experiences that broaden your understanding" },
  10: { title: "Career, reputation and public life", meaning: "career, vocation, ambition, reputation, responsibility and the role you build in the wider world" },
  11: { title: "Friendships, community and future goals", meaning: "friendships, groups, networks, communities, collective causes and hopes or long-term goals pursued with others" },
  12: { title: "Inner life, retreat and hidden patterns", meaning: "solitude, retreat, the unconscious, hidden patterns, endings and experiences that happen away from public view" },
};

export const houseNumberFromUnitId = (id: string): number | null => {
  const match = /(?:^|\.)house\.(\d+)(?:\.|$)/u.exec(id);
  if (match?.[1] === undefined) return null;
  const number = Number.parseInt(match[1], 10);
  return meanings[number] === undefined ? null : number;
};

export const houseMeaningForUnit = (unit: InterpretationUnit): HouseMeaning | null => {
  const number = houseNumberFromUnitId(unit.id);
  if (number === null) return null;
  const selected = meanings[number];
  return selected === undefined ? null : { number, ...selected };
};

export const houseInterpretationRules = (unit: InterpretationUnit): string[] => {
  const house = houseMeaningForUnit(unit);
  if (house === null) return [];
  return [
    `This is House ${house.number}. Its customer-facing life area is "${house.title}": ${house.meaning}.`,
    `Use "${house.title}" or an equally plain-English life-area phrase as the title. Never put ${unit.zodiac}, "House ${house.number}", or an internal unit label in the title.`,
    "The summary must lead with a concrete personal takeaway about how this life area tends to operate for the person. Do not lead with the cusp sign, ruler, occupants or a definition of the house.",
    "The detail must interpret the supplied cusp sign and its ruler, then incorporate occupants and relevant aspects when they are available. Explain what those facts change about the person's behaviour, needs, choices or recurring patterns.",
    "An empty house is not an unavailable interpretation. Interpret its cusp sign and ruler rather than saying only that no planets are placed there.",
    "Do not merely name placements, list chart mechanics, or explain what the house means in generic astrology. Every technical fact mentioned must immediately support a personalised conclusion.",
    "Across summary and detail, include multiple direct personal claims using you or your that still make sense if the technical labels are removed.",
  ];
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const personalMeaningSentence = (sentence: string): boolean => {
  const lower = sentence.toLocaleLowerCase("en-GB");
  if (!/\b(?:you|your)\b/u.test(lower)) return false;
  if (/\b(?:house|cusp|placement|ruler|planet|zodiac|tropical|sidereal)\b/u.test(lower)) return false;
  return /\b(?:tend|prefer|approach|express|seek|need|value|protect|pursue|handle|build|relate|respond|feel|communicate|learn|create|trust|share|believe|aim|connect|withdraw|manage|appear|come across|work|notice|focus|move|adapt|choose|develop|experience)\b/u.test(lower);
};

const sentences = (value: string): string[] => value
  .split(/(?<=[.!?])\s+/u)
  .map((sentence) => sentence.trim())
  .filter((sentence) => sentence.length > 0);

export const auditHouseInterpretation = (
  unitId: string,
  value: unknown,
): string[] => {
  const number = houseNumberFromUnitId(unitId);
  if (number === null || !record(value)) return [];

  const errors: string[] = [];
  const title = typeof value["title"] === "string" ? value["title"].trim() : "";
  const summary = typeof value["summary"] === "string" ? value["summary"].trim() : "";
  const detail = typeof value["detail"] === "string" ? value["detail"].trim() : "";

  if (/\b(?:tropical|sidereal)\b|\bhouse\s+\d+\b/iu.test(title)) {
    errors.push(`House ${number} title must use a plain-English life-area name rather than a zodiac or house-number label`);
  }

  const summaryPersonal = sentences(summary).filter(personalMeaningSentence).length;
  const detailPersonal = sentences(detail).filter(personalMeaningSentence).length;
  if (summaryPersonal < 1) {
    errors.push(`House ${number} summary must contain a direct personalised takeaway rather than a placement list or generic house definition`);
  }
  if (detailPersonal < 2) {
    errors.push(`House ${number} detail must contain at least two chart-specific personal conclusions beyond technical labels`);
  }

  const combined = `${summary} ${detail}`.toLocaleLowerCase("en-GB");
  if (/\b(?:the|this|your)\s+(?:\d+(?:st|nd|rd|th)\s+)?house\s+(?:is|represents|describes|corresponds to|relates to)\b/u.test(combined)
      && summaryPersonal + detailPersonal < 4) {
    errors.push(`House ${number} interpretation relies too heavily on defining the house instead of interpreting this person's chart`);
  }

  return errors;
};

export const housePromptCatalogue = "astral-house-interpretation/1.0.0" as const;
