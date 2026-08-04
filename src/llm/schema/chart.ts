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
import type { JsonRef } from "../../types/base.js";
import type { InterpretationUnit } from "../../types/file.js";
import { signs } from "../../zodiac/position.js";
import type { StrictShape } from "../orchestrate/types.js";
import {
  list,
  literal,
  nullableText,
  object,
  strictShape,
  text,
  textEnum,
  type Schema,
} from "./build.js";

const refs = (
  allowed: readonly JsonRef[],
): Schema => allowed.length === 0
  ? list(text(), 0, 0)
  : list(textEnum(allowed), 1);

const sectionProperties = (
  allowed: readonly JsonRef[],
): Record<string, Schema> => ({
  status: {
    type: "string",
    enum: ["written", "unavailable", "not_applicable"],
  },
  title: text(),
  summary: nullableText(),
  detail: nullableText(),
  themes: list(text()),
  strengths: list(text()),
  tensions: list(text()),
  sourceRefs: refs(allowed),
});

const sectionShape = (
  name: string,
  allowed: readonly JsonRef[],
): StrictShape<object> =>
  strictShape(
    name,
    object(sectionProperties(allowed)),
    parseStrictSection,
  ) as StrictShape<object>;

const romance = (
  allowed: readonly JsonRef[],
): Schema => object({
  ...sectionProperties(allowed),
  affectionStyle: nullableText(),
  courtshipStyle: nullableText(),
  attachmentNeeds: nullableText(),
  preferredPartnerQualities: list(text()),
  relationshipStrengths: list(text()),
  relationshipDifficulties: list(text()),
  commitmentPattern: nullableText(),
});

const sexuality = (
  allowed: readonly JsonRef[],
): Schema => object({
  ...sectionProperties(allowed),
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

const career = (
  allowed: readonly JsonRef[],
): Schema => object({
  ...sectionProperties(allowed),
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

const money = (
  allowed: readonly JsonRef[],
): Schema => object({
  ...sectionProperties(allowed),
  earningStyle: nullableText(),
  spendingStyle: nullableText(),
  securityNeeds: nullableText(),
  riskTolerance: nullableText(),
  materialStrengths: list(text()),
  financialBlindSpots: list(text()),
});

const synthesis = (
  allowed: readonly JsonRef[],
): Schema => object({
  centralThemes: list(text()),
  contradictions: list(text()),
  gifts: list(text()),
  growthEdges: list(text()),
  narrative: text(),
  sourceRefs: refs(allowed),
});

const compatibilityOverview = (
  allowed: readonly JsonRef[],
): Schema => object({
  overview: text(),
  sourceRefs: refs(allowed),
});

const signCompatibility = (
  sign: Sign,
  allowed: readonly JsonRef[],
): Schema => object({
  sign: literal(sign),
  summary: text(),
  dynamic: text(),
  strengths: list(text()),
  tensions: list(text()),
  attraction: nullableText(),
  sustainability: nullableText(),
  bestExpression: text(),
  sourceRefs: refs(allowed),
});

const crossSystem = (
  allowed: readonly JsonRef[],
): Schema => object({
  sharedThemes: list(text()),
  tropicalEmphasis: list(text()),
  siderealEmphasis: list(text()),
  apparentContradictions: list(text()),
  reconciliations: list(text()),
  synthesis: text(),
  sourceRefs: refs(allowed),
});

const finalSynthesis = (
  allowed: readonly JsonRef[],
): Schema => object({
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
  sourceRefs: refs(allowed),
});

const safeName = (
  id: string,
): string => id
  .replaceAll(/[^A-Za-z0-9_-]/gu, "_")
  .slice(0, 64);

const expectedSign = (
  id: string,
): Sign => {
  const value = id.split(".").at(-1);
  if (!value || !signs.includes(value as Sign)) {
    throw new Error(
      `Compatibility unit ${id} has no valid sign`,
    );
  }
  return value as Sign;
};

export const shapeForUnit = (
  unit: InterpretationUnit,
  allowedSourceRefs: readonly JsonRef[] = unit.allowedSourceRefs,
): StrictShape<object> => {
  const name = safeName(unit.id);

  switch (unit.section) {
    case "life.romance":
      return strictShape(
        name,
        romance(allowedSourceRefs),
        parseRomanticInterpretation,
      ) as StrictShape<object>;

    case "life.sexuality":
      return strictShape(
        name,
        sexuality(allowedSourceRefs),
        parseSexualInterpretation,
      ) as StrictShape<object>;

    case "life.careerAndVocation":
      return strictShape(
        name,
        career(allowedSourceRefs),
        parseCareerInterpretation,
      ) as StrictShape<object>;

    case "life.moneyAndMaterialSecurity":
      return strictShape(
        name,
        money(allowedSourceRefs),
        parseMoneyInterpretation,
      ) as StrictShape<object>;

    case "synthesis":
      return strictShape(
        name,
        synthesis(allowedSourceRefs),
        parseSystemSynthesis,
      ) as StrictShape<object>;

    case "compatibility.overview":
      return strictShape(
        name,
        compatibilityOverview(allowedSourceRefs),
        parseCompatibilityOverview,
      ) as StrictShape<object>;

    case "compatibility.sign": {
      const sign = expectedSign(unit.id);
      return strictShape(
        name,
        signCompatibility(sign, allowedSourceRefs),
        (value) => parseSignCompatibility(value, sign),
      ) as StrictShape<object>;
    }

    case "crossSystem":
      return strictShape(
        name,
        crossSystem(allowedSourceRefs),
        parseCrossSystem,
      ) as StrictShape<object>;

    case "finalSynthesis":
      return strictShape(
        name,
        finalSynthesis(allowedSourceRefs),
        parseFinalSynthesis,
      ) as StrictShape<object>;

    default:
      return sectionShape(name, allowedSourceRefs);
  }
};
