import {
  parseCareerInterpretation,
  parseCompatibilityOverview,
  parseCrossSystem,
  parseFinalSynthesis,
  parseMoneyInterpretation,
  parseRomanticInterpretation,
  parseSexualInterpretation,
  parseSignCompatibility,
  parseStrictSection,
  parseSystemSynthesis,
} from "../../chart/parse.js";
import type { Sign } from "../../types/astro.js";
import type { InterpretationUnit } from "../../types/file.js";
import { signs } from "../../zodiac/position.js";
import type { StrictShape } from "../orchestrate/types.js";
import { list, literal, nullableText, object, strictShape, text, type Schema } from "./build.js";

const sectionProperties: Record<string, Schema> = {
  status: { type: "string", enum: ["written", "unavailable", "not_applicable"] },
  title: text(),
  summary: nullableText(),
  detail: nullableText(),
  themes: list(text()),
  strengths: list(text()),
  tensions: list(text()),
  sourceRefs: list(text(), 1),
};

const section = object(sectionProperties);
const sectionShape = (name: string): StrictShape<object> =>
  strictShape(name, section, parseStrictSection) as StrictShape<object>;

const romance = object({
  ...sectionProperties,
  affectionStyle: nullableText(),
  courtshipStyle: nullableText(),
  attachmentNeeds: nullableText(),
  preferredPartnerQualities: list(text()),
  relationshipStrengths: list(text()),
  relationshipDifficulties: list(text()),
  commitmentPattern: nullableText(),
});

const sexuality = object({
  ...sectionProperties,
  desireStyle: nullableText(),
  libidoPattern: nullableText(),
  initiationStyle: nullableText(),
  preferredPace: nullableText(),
  physicalAffection: nullableText(),
  likelyTurnOns: list(text()),
  likelyTurnOffs: list(text()),
  experimentationStyle: nullableText(),
  emotionalSexConnection: nullableText(),
  controlAndSurrender: nullableText(),
  powerDynamics: nullableText(),
  exclusivityPattern: nullableText(),
  sexualCommunication: nullableText(),
  likelyFrustrations: list(text()),
});

const career = object({
  ...sectionProperties,
  vocationalThemes: list(text()),
  suitableFields: list(text()),
  preferredWorkEnvironment: nullableText(),
  leadershipStyle: nullableText(),
  authorityRelationship: nullableText(),
  ambitionPattern: nullableText(),
  publicReputation: nullableText(),
  careerStrengths: list(text()),
  careerRisks: list(text()),
});

const money = object({
  ...sectionProperties,
  earningStyle: nullableText(),
  spendingStyle: nullableText(),
  securityNeeds: nullableText(),
  riskTolerance: nullableText(),
  materialStrengths: list(text()),
  financialBlindSpots: list(text()),
});

const synthesis = object({
  centralThemes: list(text()),
  contradictions: list(text()),
  gifts: list(text()),
  growthEdges: list(text()),
  narrative: text(),
  sourceRefs: list(text(), 1),
});

const compatibilityOverview = object({
  overview: text(),
  sourceRefs: list(text(), 1),
});

const signCompatibility = (sign: Sign): Schema => object({
  sign: literal(sign),
  summary: text(),
  dynamic: text(),
  strengths: list(text()),
  tensions: list(text()),
  attraction: nullableText(),
  sustainability: nullableText(),
  bestExpression: text(),
  sourceRefs: list(text(), 1),
});

const crossSystem = object({
  sharedThemes: list(text()),
  tropicalEmphasis: list(text()),
  siderealEmphasis: list(text()),
  apparentContradictions: list(text()),
  reconciliations: list(text()),
  synthesis: text(),
  sourceRefs: list(text(), 1),
});

const finalSynthesis = object({
  essence: text(),
  definingThemes: list(text()),
  strongestAssets: list(text()),
  recurringTensions: list(text()),
  relationshipPattern: text(),
  sexualPattern: text(),
  friendshipPattern: text(),
  vocationalPattern: text(),
  moneyPattern: text(),
  developmentalArc: text(),
  closingPortrait: text(),
  sourceRefs: list(text(), 1),
});

const safeName = (id: string): string => id.replaceAll(/[^A-Za-z0-9_-]/gu, "_").slice(0, 64);

const expectedSign = (id: string): Sign => {
  const value = id.split(".").at(-1);
  if (!value || !signs.includes(value as Sign)) throw new Error(`Compatibility unit ${id} has no valid sign`);
  return value as Sign;
};

export const shapeForUnit = (unit: InterpretationUnit): StrictShape<object> => {
  const name = safeName(unit.id);
  switch (unit.section) {
    case "life.romance":
      return strictShape(name, romance, parseRomanticInterpretation) as StrictShape<object>;
    case "life.sexuality":
      return strictShape(name, sexuality, parseSexualInterpretation) as StrictShape<object>;
    case "life.careerAndVocation":
      return strictShape(name, career, parseCareerInterpretation) as StrictShape<object>;
    case "life.moneyAndMaterialSecurity":
      return strictShape(name, money, parseMoneyInterpretation) as StrictShape<object>;
    case "synthesis":
      return strictShape(name, synthesis, parseSystemSynthesis) as StrictShape<object>;
    case "compatibility.overview":
      return strictShape(name, compatibilityOverview, parseCompatibilityOverview) as StrictShape<object>;
    case "compatibility.sign": {
      const sign = expectedSign(unit.id);
      return strictShape(name, signCompatibility(sign), (value) => parseSignCompatibility(value, sign)) as StrictShape<object>;
    }
    case "crossSystem":
      return strictShape(name, crossSystem, parseCrossSystem) as StrictShape<object>;
    case "finalSynthesis":
      return strictShape(name, finalSynthesis, parseFinalSynthesis) as StrictShape<object>;
    default:
      return sectionShape(name);
  }
};
