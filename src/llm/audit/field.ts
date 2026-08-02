import { forbiddenPatterns, unwantedExamples } from "./catalogue.js";
import { duplicateMatch, type NarrativeEntry } from "./duplicate.js";
import { leakedReferences } from "./reference.js";
import { semanticIssues } from "./semantic.js";
import { cosine, normaliseText, sentences } from "./text.js";

export type AuditCode =
  | "empty"
  | "placeholder"
  | "format"
  | "process_narration"
  | "disclaimer"
  | "irrelevant"
  | "duplicate"
  | "cross_field_leakage"
  | "reference_leakage"
  | "impersonal_voice"
  | "technical_opening"
  | "technical_density";

export interface AuditIssue {
  code: AuditCode;
  message: string;
  repairable: boolean;
}

export interface FieldProfile {
  id: string;
  lexicon: readonly string[];
  minLength?: number;
  maxLength?: number;
  priorFields?: readonly NarrativeEntry[];
  fieldLexicons?: Readonly<Record<string, readonly string[]>>;
  semanticField?: string;
}

export interface FieldAudit {
  valid: boolean;
  value: string;
  repaired: boolean;
  issues: AuditIssue[];
}

const placeholders = /^(?:n\/a|none|unknown|tbd|todo|placeholder|\.\.\.)$/iu;
const badFormat = /```|^\s{0,3}#{1,6}\s|^\s*[-*+]\s+/mu;
const label = /^\s*[\p{L}\p{N} _-]{2,40}:\s*/u;
const secondPerson = /\b(?:you|your|yours|yourself|tú|tu|tus|te|ti|usted|ustedes|su|sus|contigo)\b/iu;
const impersonal = /\b(?:the native|this placement (?:indicates|suggests|shows|reveals)|this aspect (?:indicates|suggests|shows|reveals)|the chart (?:indicates|suggests|shows|reveals)|one may find|the individual)\b/iu;
const technicalTerms = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
  "ascendant", "descendant", "midheaven", "house", "houses", "aspect", "aspects", "conjunction", "opposition", "trine", "square", "sextile",
  "sol", "luna", "mercurio", "marte", "júpiter", "saturno", "urano", "neptuno", "plutón", "ascendente", "casa", "casas", "aspecto", "aspectos",
] as const;
const escapedTechnicalTerms = technicalTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
const technicalOpening = new RegExp(
  `^(?:the|el|la|los|las)?\\s*(?:(?:${escapedTechnicalTerms.join("|")})\\b|(?:a|an|un|una)?\\s*(?:planet|sign|house|aspect|placement|chart|planeta|signo|casa|aspecto|posición)\\b)`,
  "iu",
);

const forbidden = (sentence: string): boolean => forbiddenPatterns.some((pattern) => pattern.test(sentence));
const boilerplate = (sentence: string): boolean => unwantedExamples.some((example) => cosine(sentence, example) >= 0.72);

const countTerms = (value: string, terms: readonly string[]): number => {
  const padded = ` ${normaliseText(value)} `;
  return terms.reduce((count, term) => {
    const candidate = normaliseText(term);
    return candidate.length > 0 && padded.includes(` ${candidate} `) ? count + 1 : count;
  }, 0);
};

const isTitle = (id: string): boolean => /(?:^|\.)title$/iu.test(id);

const clean = (value: string): { value: string; repaired: boolean; removed: boolean } => {
  let repaired = false;
  let text = value.replaceAll("```json", "").replaceAll("```", "").trim();
  if (text !== value.trim()) repaired = true;
  const kept: string[] = [];
  let removed = false;
  for (const sentence of sentences(text)) {
    if (forbidden(sentence) || boilerplate(sentence)) {
      removed = true;
      repaired = true;
      continue;
    }
    const stripped = sentence.replace(label, "").trim();
    if (stripped !== sentence) repaired = true;
    if (kept.length > 0 && normaliseText(kept.at(-1) ?? "") === normaliseText(stripped)) {
      repaired = true;
      continue;
    }
    if (stripped.length > 0) kept.push(stripped);
  }
  text = kept.join(" ").trim();
  return { value: text, repaired, removed };
};

const styleIssues = (value: string, id: string): AuditIssue[] => {
  if (isTitle(id)) return [];
  const issues: AuditIssue[] = [];
  const leak = leakedReferences(value, id);
  if (leak !== null) {
    issues.push({
      code: "reference_leakage",
      message: `${id} contains internal JSON references outside sourceRefs: ${leak.references.join(", ")}`,
      repairable: false,
    });
  }
  if (value.length < 36) return issues;
  if (impersonal.test(value)) {
    issues.push({
      code: "impersonal_voice",
      message: `${id} describes the chart impersonally instead of speaking to the person`,
      repairable: false,
    });
  }
  if (sentences(value).some((sentence) => technicalOpening.test(sentence))) {
    issues.push({
      code: "technical_opening",
      message: `${id} leads with chart mechanics instead of human meaning`,
      repairable: false,
    });
  }
  if (value.length >= 60 && !secondPerson.test(value)) {
    issues.push({
      code: "impersonal_voice",
      message: `${id} must use direct second-person language`,
      repairable: false,
    });
  }
  const normal = normaliseText(value);
  const wordCount = normal.split(" ").filter(Boolean).length;
  const technicalCount = countTerms(normal, technicalTerms);
  if (wordCount >= 20 && technicalCount >= 5 && technicalCount / wordCount > 0.16) {
    issues.push({
      code: "technical_density",
      message: `${id} is excessively technical for user-facing interpretation`,
      repairable: false,
    });
  }
  return issues;
};

export const auditField = (input: string, profile: FieldProfile): FieldAudit => {
  const issues: AuditIssue[] = [];
  const cleaned = clean(input);
  const value = cleaned.value;
  if (value.length === 0) issues.push({ code: "empty", message: `${profile.id} is empty after audit`, repairable: false });
  if (placeholders.test(value)) issues.push({ code: "placeholder", message: `${profile.id} contains a placeholder`, repairable: false });
  if (badFormat.test(value)) issues.push({ code: "format", message: `${profile.id} contains forbidden formatting`, repairable: true });
  if (cleaned.removed) issues.push({ code: "process_narration", message: `${profile.id} contained process narration or boilerplate`, repairable: true });
  if (profile.minLength !== undefined && value.length < profile.minLength) {
    issues.push({ code: "empty", message: `${profile.id} is too short`, repairable: false });
  }
  if (profile.maxLength !== undefined && value.length > profile.maxLength) {
    issues.push({ code: "format", message: `${profile.id} is too long`, repairable: false });
  }

  issues.push(...styleIssues(value, profile.id));
  issues.push(...semanticIssues(value, {
    id: profile.id,
    ...(profile.semanticField === undefined ? {} : { field: profile.semanticField }),
    ...(profile.fieldLexicons === undefined ? {} : { fieldLexicons: profile.fieldLexicons }),
  }).map((issue): AuditIssue => ({
    code: "irrelevant",
    message: issue.message,
    repairable: false,
  })));

  const duplicate = duplicateMatch(value, profile.id, profile.priorFields ?? []);
  if (duplicate !== null) {
    issues.push({
      code: "cross_field_leakage",
      message: `${profile.id} is a ${duplicate.kind} duplicate of ${duplicate.path} (score ${duplicate.score.toFixed(4)}, threshold ${duplicate.threshold.toFixed(4)})`,
      repairable: false,
    });
  }

  const unsafe = issues.some((issue) => !issue.repairable);
  return { valid: !unsafe && !badFormat.test(value), value, repaired: cleaned.repaired, issues };
};

export const auditList = (
  items: readonly string[],
  profile: FieldProfile,
): { valid: boolean; values: string[]; issues: AuditIssue[] } => {
  const values: string[] = [];
  const issues: AuditIssue[] = [];
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const id = `${profile.id}[${index}]`;
    const result = auditField(item, { ...profile, id });
    issues.push(...result.issues);
    const key = normaliseText(result.value);
    if (seen.has(key)) {
      issues.push({ code: "duplicate", message: `${profile.id} contains duplicate entries`, repairable: true });
    } else if (result.value.length > 0) {
      seen.add(key);
      values.push(result.value);
    }
  });
  return { valid: issues.every((issue) => issue.repairable) && values.length > 0, values, issues };
};

export type { NarrativeEntry } from "./duplicate.js";
