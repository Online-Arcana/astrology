import type { JsonRef } from "../types/base.js";
import type {
  CareerInterpretation,
  CompatibilityDomainInterpretation,
  CrossSystemInterpretation,
  FinalSynthesis,
  MoneyInterpretation,
  RomanticInterpretation,
  Section,
  SexualInterpretation,
  SignCompatibilityInterpretation,
  SystemInterpretation,
} from "../types/chart.js";
import type { CompatibilityDomain, Sign } from "../types/astro.js";

const sectionKeys = [
  "status",
  "title",
  "summary",
  "detail",
  "themes",
  "strengths",
  "tensions",
  "sourceRefs",
] as const;

const record = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value as Record<string, unknown>;
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[], name: string): void => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${name} has unexpected or missing fields`);
  }
};

const text = (value: unknown, name: string): string => {
  if (typeof value !== "string") throw new TypeError(`${name} must be text`);
  return value;
};

const nullableText = (value: unknown, name: string): string | null => {
  if (value === null) return null;
  return text(value, name);
};

const textList = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`${name} must be a text array`);
  }
  return [...value];
};

const refs = (value: unknown, name: string): JsonRef[] => textList(value, name).map((item) => {
  if (!item.startsWith("#/")) throw new TypeError(`${name} contains a non-local JSON reference`);
  return item as JsonRef;
});

const status = (value: unknown): Section["status"] => {
  if (value !== "written" && value !== "unavailable" && value !== "not_applicable") {
    throw new TypeError("Section status is invalid");
  }
  return value;
};

const sectionFrom = (value: Record<string, unknown>): Section => ({
  status: status(value["status"]),
  title: text(value["title"], "Section title"),
  summary: nullableText(value["summary"], "Section summary"),
  detail: nullableText(value["detail"], "Section detail"),
  themes: textList(value["themes"], "Section themes"),
  strengths: textList(value["strengths"], "Section strengths"),
  tensions: textList(value["tensions"], "Section tensions"),
  sourceRefs: refs(value["sourceRefs"], "Section sourceRefs"),
});

export const parseStrictSection = (input: unknown): Section => {
  const value = record(input, "Section");
  exactKeys(value, sectionKeys, "Section");
  return sectionFrom(value);
};

export const parseRomanticInterpretation = (input: unknown): RomanticInterpretation => {
  const value = record(input, "Romantic interpretation");
  exactKeys(value, [
    ...sectionKeys,
    "affectionStyle",
    "courtshipStyle",
    "attachmentNeeds",
    "preferredPartnerQualities",
    "relationshipStrengths",
    "relationshipDifficulties",
    "commitmentPattern",
  ], "Romantic interpretation");
  return {
    ...sectionFrom(value),
    affectionStyle: nullableText(value["affectionStyle"], "affectionStyle"),
    courtshipStyle: nullableText(value["courtshipStyle"], "courtshipStyle"),
    attachmentNeeds: nullableText(value["attachmentNeeds"], "attachmentNeeds"),
    preferredPartnerQualities: textList(value["preferredPartnerQualities"], "preferredPartnerQualities"),
    relationshipStrengths: textList(value["relationshipStrengths"], "relationshipStrengths"),
    relationshipDifficulties: textList(value["relationshipDifficulties"], "relationshipDifficulties"),
    commitmentPattern: nullableText(value["commitmentPattern"], "commitmentPattern"),
  };
};

export const parseSexualInterpretation = (input: unknown): SexualInterpretation => {
  const value = record(input, "Sexual interpretation");
  exactKeys(value, [
    ...sectionKeys,
    "desireStyle",
    "libidoPattern",
    "initiationStyle",
    "preferredPace",
    "physicalAffection",
    "likelyTurnOns",
    "likelyTurnOffs",
    "experimentationStyle",
    "emotionalSexConnection",
    "controlAndSurrender",
    "powerDynamics",
    "exclusivityPattern",
    "sexualCommunication",
    "likelyFrustrations",
  ], "Sexual interpretation");
  return {
    ...sectionFrom(value),
    desireStyle: nullableText(value["desireStyle"], "desireStyle"),
    libidoPattern: nullableText(value["libidoPattern"], "libidoPattern"),
    initiationStyle: nullableText(value["initiationStyle"], "initiationStyle"),
    preferredPace: nullableText(value["preferredPace"], "preferredPace"),
    physicalAffection: nullableText(value["physicalAffection"], "physicalAffection"),
    likelyTurnOns: textList(value["likelyTurnOns"], "likelyTurnOns"),
    likelyTurnOffs: textList(value["likelyTurnOffs"], "likelyTurnOffs"),
    experimentationStyle: nullableText(value["experimentationStyle"], "experimentationStyle"),
    emotionalSexConnection: nullableText(value["emotionalSexConnection"], "emotionalSexConnection"),
    controlAndSurrender: nullableText(value["controlAndSurrender"], "controlAndSurrender"),
    powerDynamics: nullableText(value["powerDynamics"], "powerDynamics"),
    exclusivityPattern: nullableText(value["exclusivityPattern"], "exclusivityPattern"),
    sexualCommunication: nullableText(value["sexualCommunication"], "sexualCommunication"),
    likelyFrustrations: textList(value["likelyFrustrations"], "likelyFrustrations"),
  };
};

export const parseCareerInterpretation = (input: unknown): CareerInterpretation => {
  const value = record(input, "Career interpretation");
  exactKeys(value, [
    ...sectionKeys,
    "vocationalThemes",
    "suitableFields",
    "preferredWorkEnvironment",
    "leadershipStyle",
    "authorityRelationship",
    "ambitionPattern",
    "publicReputation",
    "careerStrengths",
    "careerRisks",
  ], "Career interpretation");
  return {
    ...sectionFrom(value),
    vocationalThemes: textList(value["vocationalThemes"], "vocationalThemes"),
    suitableFields: textList(value["suitableFields"], "suitableFields"),
    preferredWorkEnvironment: nullableText(value["preferredWorkEnvironment"], "preferredWorkEnvironment"),
    leadershipStyle: nullableText(value["leadershipStyle"], "leadershipStyle"),
    authorityRelationship: nullableText(value["authorityRelationship"], "authorityRelationship"),
    ambitionPattern: nullableText(value["ambitionPattern"], "ambitionPattern"),
    publicReputation: nullableText(value["publicReputation"], "publicReputation"),
    careerStrengths: textList(value["careerStrengths"], "careerStrengths"),
    careerRisks: textList(value["careerRisks"], "careerRisks"),
  };
};

export const parseMoneyInterpretation = (input: unknown): MoneyInterpretation => {
  const value = record(input, "Money interpretation");
  exactKeys(value, [
    ...sectionKeys,
    "earningStyle",
    "spendingStyle",
    "securityNeeds",
    "riskTolerance",
    "materialStrengths",
    "financialBlindSpots",
  ], "Money interpretation");
  return {
    ...sectionFrom(value),
    earningStyle: nullableText(value["earningStyle"], "earningStyle"),
    spendingStyle: nullableText(value["spendingStyle"], "spendingStyle"),
    securityNeeds: nullableText(value["securityNeeds"], "securityNeeds"),
    riskTolerance: nullableText(value["riskTolerance"], "riskTolerance"),
    materialStrengths: textList(value["materialStrengths"], "materialStrengths"),
    financialBlindSpots: textList(value["financialBlindSpots"], "financialBlindSpots"),
  };
};

export const parseSystemSynthesis = (input: unknown): SystemInterpretation["synthesis"] => {
  const value = record(input, "System synthesis");
  exactKeys(value, ["centralThemes", "contradictions", "gifts", "growthEdges", "narrative", "sourceRefs"], "System synthesis");
  return {
    centralThemes: textList(value["centralThemes"], "centralThemes"),
    contradictions: textList(value["contradictions"], "contradictions"),
    gifts: textList(value["gifts"], "gifts"),
    growthEdges: textList(value["growthEdges"], "growthEdges"),
    narrative: text(value["narrative"], "narrative"),
    sourceRefs: refs(value["sourceRefs"], "sourceRefs"),
  };
};

export interface CompatibilityOverviewUnit {
  overview: string;
  sourceRefs: JsonRef[];
}

export const parseCompatibilityOverview = (input: unknown): CompatibilityOverviewUnit => {
  const value = record(input, "Compatibility overview");
  exactKeys(value, ["overview", "sourceRefs"], "Compatibility overview");
  return {
    overview: text(value["overview"], "overview"),
    sourceRefs: refs(value["sourceRefs"], "sourceRefs"),
  };
};

export const parseSignCompatibility = (
  input: unknown,
  expectedSign: Sign,
): SignCompatibilityInterpretation => {
  const value = record(input, "Sign compatibility interpretation");
  exactKeys(value, [
    "sign",
    "summary",
    "dynamic",
    "strengths",
    "tensions",
    "attraction",
    "sustainability",
    "bestExpression",
    "sourceRefs",
  ], "Sign compatibility interpretation");
  if (value["sign"] !== expectedSign) throw new TypeError(`Sign compatibility expected ${expectedSign}`);
  return {
    sign: expectedSign,
    summary: text(value["summary"], "summary"),
    dynamic: text(value["dynamic"], "dynamic"),
    strengths: textList(value["strengths"], "strengths"),
    tensions: textList(value["tensions"], "tensions"),
    attraction: nullableText(value["attraction"], "attraction"),
    sustainability: nullableText(value["sustainability"], "sustainability"),
    bestExpression: text(value["bestExpression"], "bestExpression"),
    sourceRefs: refs(value["sourceRefs"], "sourceRefs"),
  };
};

export const parseCrossSystem = (input: unknown): CrossSystemInterpretation => {
  const value = record(input, "Cross-system interpretation");
  exactKeys(value, [
    "sharedThemes",
    "tropicalEmphasis",
    "siderealEmphasis",
    "apparentContradictions",
    "reconciliations",
    "synthesis",
    "sourceRefs",
  ], "Cross-system interpretation");
  return {
    sharedThemes: textList(value["sharedThemes"], "sharedThemes"),
    tropicalEmphasis: textList(value["tropicalEmphasis"], "tropicalEmphasis"),
    siderealEmphasis: textList(value["siderealEmphasis"], "siderealEmphasis"),
    apparentContradictions: textList(value["apparentContradictions"], "apparentContradictions"),
    reconciliations: textList(value["reconciliations"], "reconciliations"),
    synthesis: text(value["synthesis"], "synthesis"),
    sourceRefs: refs(value["sourceRefs"], "sourceRefs"),
  };
};

export const parseFinalSynthesis = (input: unknown): FinalSynthesis => {
  const value = record(input, "Final synthesis");
  exactKeys(value, [
    "essence",
    "definingThemes",
    "strongestAssets",
    "recurringTensions",
    "relationshipPattern",
    "sexualPattern",
    "friendshipPattern",
    "vocationalPattern",
    "moneyPattern",
    "developmentalArc",
    "closingPortrait",
    "sourceRefs",
  ], "Final synthesis");
  return {
    essence: text(value["essence"], "essence"),
    definingThemes: textList(value["definingThemes"], "definingThemes"),
    strongestAssets: textList(value["strongestAssets"], "strongestAssets"),
    recurringTensions: textList(value["recurringTensions"], "recurringTensions"),
    relationshipPattern: text(value["relationshipPattern"], "relationshipPattern"),
    sexualPattern: text(value["sexualPattern"], "sexualPattern"),
    friendshipPattern: text(value["friendshipPattern"], "friendshipPattern"),
    vocationalPattern: text(value["vocationalPattern"], "vocationalPattern"),
    moneyPattern: text(value["moneyPattern"], "moneyPattern"),
    developmentalArc: text(value["developmentalArc"], "developmentalArc"),
    closingPortrait: text(value["closingPortrait"], "closingPortrait"),
    sourceRefs: refs(value["sourceRefs"], "sourceRefs"),
  };
};

export const compatibilityDomain = (
  domain: CompatibilityDomain,
  overview: CompatibilityOverviewUnit,
  signs: CompatibilityDomainInterpretation["signs"],
): CompatibilityDomainInterpretation => ({
  domain,
  overview: overview.overview,
  sourceRefs: overview.sourceRefs,
  signs,
});
