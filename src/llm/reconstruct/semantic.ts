import type { InterpretationMap, Proposition } from "../../interpretation/corpus/types.js";
import { auditWorldviewText } from "../../interpretation/corpus/worldview.js";

const machineLike = /(?:#\/|\b(?:claim|atom|source|calculation|variant|corpus|schema|json)\b|^[a-z]+(?:[._][a-z0-9_-]+)+$)/iu;

const cleanConcept = (raw: string): string | null => {
  const value = raw
    .replaceAll("_", " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  if (value.length < 2 || value.length > 80 || machineLike.test(value)) return null;
  const worldview = auditWorldviewText(value);
  return worldview.safe && !worldview.requiresReview ? value : null;
};

const bucket = (
  map: InterpretationMap,
  names: readonly (keyof InterpretationMap["semantics"])[],
): Proposition[] => names.flatMap((name) => map.semantics[name]);

const concepts = (
  map: InterpretationMap,
  names: readonly (keyof InterpretationMap["semantics"])[],
): string[] => {
  const tags = bucket(map, names)
    .flatMap(({ tags }) => tags)
    .map(cleanConcept)
    .filter((value): value is string => value !== null);
  const unique = [...new Set(tags.map((value) => value.toLocaleLowerCase("en-GB")))];
  if (unique.length > 0) return unique.slice(0, 4);
  const domain = cleanConcept(map.subject.plainEnglishDomain);
  return domain === null ? [] : [domain];
};

const phrase = (values: readonly string[]): string => {
  if (values.length === 0) return "the patterns described here";
  if (values.length === 1) return values[0] as string;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
};

const thematic = new Set([
  "themes", "centralThemes", "definingThemes", "vocationalThemes",
]);
const constructive = new Set([
  "strengths", "gifts", "strongestAssets", "relationshipStrengths", "careerStrengths",
  "materialStrengths", "bestExpression",
]);
const difficult = new Set([
  "tensions", "contradictions", "growthEdges", "recurringTensions", "relationshipDifficulties",
  "careerRisks", "financialBlindSpots", "likelyFrustrations",
]);
const detail = new Set([
  "detail", "narrative", "dynamic", "sustainability",
]);

const specialised = (
  key: string,
  meaning: string,
): string | null => {
  switch (key) {
    case "affectionStyle": return `You may express affection through ${meaning}, with context shaping which form feels most natural.`;
    case "courtshipStyle": return `You may approach early romantic connection through ${meaning}, while allowing mutual interest to develop at a workable pace.`;
    case "attachmentNeeds": return `You may feel more secure in close relationships when ${meaning} can be expressed without crowding out other needs.`;
    case "preferredPartnerQualities": return `You may value partners who can engage constructively with ${meaning}.`;
    case "commitmentPattern": return `You may approach commitment by finding a sustainable balance around ${meaning}.`;
    case "desireStyle": return `Your desire may be shaped by ${meaning}, with its expression changing according to context and trust.`;
    case "libidoPattern": return `Your level of desire may shift with ${meaning} rather than following one fixed pattern.`;
    case "initiationStyle": return `You may feel most comfortable initiating intimacy when there is enough room for ${meaning} to be expressed clearly and mutually.`;
    case "preferredPace": return `You may prefer an intimate pace that gives ${meaning} enough room to develop without pressure.`;
    case "physicalAffection": return `You may experience physical affection most naturally through ${meaning}.`;
    case "likelyTurnOns": return `You may respond positively when ${meaning} is present in a mutually wanted interaction.`;
    case "likelyTurnOffs": return `You may lose interest when the difficult side of ${meaning} begins to undermine comfort, trust or responsiveness.`;
    case "experimentationStyle": return `You may explore novelty most comfortably when ${meaning} can be approached deliberately and with clear boundaries.`;
    case "emotionalSexConnection": return `You may experience emotional and sexual connection as strongest when ${meaning} can coexist with trust and direct communication.`;
    case "controlAndSurrender": return `You may approach control and surrender by keeping ${meaning} compatible with explicit choice, trust and reversibility.`;
    case "powerDynamics": return `You may engage with power dynamics most constructively when ${meaning} remains compatible with mutual respect and clear agreement.`;
    case "exclusivityPattern": return `Your preferences around exclusivity may be influenced by ${meaning}, especially when expectations are made explicit.`;
    case "sexualCommunication": return `You may communicate about intimacy most effectively when you can name how ${meaning} affects your preferences and boundaries.`;
    case "vocationalThemes": return `You may repeatedly encounter vocational themes involving ${meaning}.`;
    case "suitableFields": return `You may be drawn towards work that gives constructive expression to ${meaning}.`;
    case "preferredWorkEnvironment": return `You may work best in environments that give ${meaning} a practical and sustainable outlet.`;
    case "leadershipStyle": return `You may lead most effectively when ${meaning} is expressed deliberately rather than automatically.`;
    case "authorityRelationship": return `Your response to authority may be shaped by how well it accommodates ${meaning}.`;
    case "ambitionPattern": return `Your ambition may become clearer when ${meaning} is connected to goals you can pursue deliberately.`;
    case "publicReputation": return `You may become known for the way you consistently express ${meaning} in visible situations.`;
    case "earningStyle": return `Your earning style may be strongest when ${meaning} can be translated into useful and repeatable contribution.`;
    case "spendingStyle": return `Your spending choices may reflect how you balance ${meaning} with practical priorities.`;
    case "securityNeeds": return `You may feel materially safer when your approach to ${meaning} leaves enough room for stability and future choice.`;
    case "riskTolerance": return `Your tolerance for material risk may change according to how confidently you can manage ${meaning}.`;
    case "attraction": return `You may find attraction develops through ${meaning}, with mutual responsiveness determining how strongly it grows.`;
    case "relationshipPattern": return `You may experience close relationships through themes of ${meaning}, with communication and context shaping their expression.`;
    case "sexualPattern": return `You may experience intimacy through themes of ${meaning}, with consent, trust and communication shaping their expression.`;
    case "friendshipPattern": return `You may experience friendship through themes of ${meaning}, especially where expectations and independence can be discussed openly.`;
    case "vocationalPattern": return `You may experience work through themes of ${meaning}, with environment and responsibility shaping how they are expressed.`;
    case "moneyPattern": return `You may approach material choices through themes of ${meaning}, with planning and context helping you decide how to respond.`;
    case "developmentalArc": return `You may develop through a more conscious and flexible relationship with ${meaning}.`;
    case "closingPortrait": return `You may become more effective as you recognise how ${meaning} appears in different contexts and choose your response deliberately.`;
    default: return null;
  }
};

const safeMapOwnedFallback = (
  map: InterpretationMap,
  key: string,
): string => {
  if (key === "title") return map.subject.title;
  const domain = cleanConcept(map.subject.plainEnglishDomain)
    ?? cleanConcept(map.subject.title)
    ?? "this chart pattern";
  return `You may notice ${domain} becoming relevant here, with context shaping how you choose to respond.`;
};

/**
 * Deterministic prose belongs to the interpretive voice, not to source text.
 * The map contributes approved concepts; fixed application templates own the
 * sentence structure. Proposition text is intentionally never copied here.
 *
 * Once an InterpretationMap has passed validation, deterministic reconstruction
 * must remain inside that semantic authority. A corpus-backed unit must never
 * fall through to the legacy XML topic interpolation simply because one prose
 * template was rejected by the worldview scanner.
 */
export const semanticFallbackText = (
  map: InterpretationMap,
  key: string,
): string => {
  if (key === "title") return map.subject.title;

  const buckets: readonly (keyof InterpretationMap["semantics"])[] = constructive.has(key)
    ? ["strengths", "core", "themes"]
    : difficult.has(key)
      ? ["tensions", "detail", "themes"]
      : thematic.has(key)
        ? ["themes", "core", "detail"]
        : ["core", "detail", "themes", "strengths", "tensions"];
  const meaning = phrase(concepts(map, buckets));

  let value: string;
  const specific = specialised(key, meaning);
  if (specific !== null) {
    value = specific;
  } else if (constructive.has(key)) {
    value = `You may use ${meaning} as constructive resources when you act deliberately and stay responsive to context.`;
  } else if (difficult.has(key)) {
    value = `You may need to balance ${meaning}, especially when one tendency starts to crowd out other needs.`;
  } else if (thematic.has(key)) {
    value = `You may repeatedly notice themes involving ${meaning}.`;
  } else if (detail.has(key)) {
    value = `You may experience ${meaning} differently across situations; deliberate choices can help you decide which expression fits the context best.`;
  } else if (key === "essence" || key === "summary" || key === "overview") {
    value = `You may notice ${meaning} as a recurring part of this area of your life.`;
  } else {
    value = `You may notice ${meaning} becoming relevant here, with circumstances shaping how you choose to express it.`;
  }

  const worldview = auditWorldviewText(value);
  if (worldview.safe && !worldview.requiresReview) return value;

  const fallback = safeMapOwnedFallback(map, key);
  const fallbackAudit = auditWorldviewText(fallback);
  if (fallbackAudit.safe && !fallbackAudit.requiresReview) return fallback;

  // validateInterpretationMap() has already required an agnostic subject. This
  // final sentence is deliberately minimal but still map-owned and never uses
  // an internal unit label or the legacy XML catalogue.
  return `You may notice ${map.subject.plainEnglishDomain} in this part of your experience.`;
};
