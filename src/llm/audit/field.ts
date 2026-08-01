import { forbiddenPatterns, unwantedExamples } from "./catalogue.js";
import { cosine, normaliseText, sentences } from "./text.js";

export type AuditCode =
  | "empty"
  | "placeholder"
  | "format"
  | "process_narration"
  | "disclaimer"
  | "irrelevant"
  | "duplicate"
  | "cross_field_leakage";

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
  priorFields?: readonly string[];
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

const forbidden = (sentence: string): boolean => forbiddenPatterns.some((pattern) => pattern.test(sentence));
const boilerplate = (sentence: string): boolean => unwantedExamples.some((example) => cosine(sentence, example) >= 0.72);

const clean = (value: string): { value: string; repaired: boolean; removed: boolean } => {
  let repaired = false;
  let text = value.replaceAll("```json", "").replaceAll("```", "").trim();
  if (text !== value.trim()) repaired = true;
  const parts = sentences(text);
  const kept: string[] = [];
  let removed = false;
  for (const sentence of parts) {
    if (forbidden(sentence) || boilerplate(sentence)) {
      removed = true;
      repaired = true;
      continue;
    }
    const stripped = sentence.replace(label, "").trim();
    if (stripped !== sentence) repaired = true;
    if (kept.length > 0 && normaliseText(kept[kept.length - 1] as string) === normaliseText(stripped)) {
      repaired = true;
      continue;
    }
    if (stripped) kept.push(stripped);
  }
  text = kept.join(" ").trim();
  return { value: text, repaired, removed };
};

export const auditField = (input: string, profile: FieldProfile): FieldAudit => {
  const issues: AuditIssue[] = [];
  const cleaned = clean(input);
  const value = cleaned.value;
  if (!value) issues.push({ code: "empty", message: `${profile.id} is empty after audit`, repairable: false });
  if (placeholders.test(value)) issues.push({ code: "placeholder", message: `${profile.id} contains a placeholder`, repairable: false });
  if (badFormat.test(value)) issues.push({ code: "format", message: `${profile.id} contains forbidden formatting`, repairable: true });
  if (cleaned.removed) issues.push({ code: "process_narration", message: `${profile.id} contained process narration or boilerplate`, repairable: true });
  if (profile.minLength !== undefined && value.length < profile.minLength) {
    issues.push({ code: "empty", message: `${profile.id} is too short`, repairable: false });
  }
  if (profile.maxLength !== undefined && value.length > profile.maxLength) {
    issues.push({ code: "format", message: `${profile.id} is too long`, repairable: false });
  }
  const normal = normaliseText(value);
  if (profile.lexicon.length > 0 && normal.split(" ").length >= 8) {
    const relevant = profile.lexicon.some((term) => normal.includes(normaliseText(term)));
    if (!relevant) issues.push({ code: "irrelevant", message: `${profile.id} does not fit its semantic field`, repairable: false });
  }
  for (const prior of profile.priorFields ?? []) {
    if (value.length >= 60 && prior.length >= 60 && cosine(value, prior) >= 0.92) {
      issues.push({ code: "cross_field_leakage", message: `${profile.id} is a near-duplicate of another field`, repairable: false });
      break;
    }
  }
  const unsafe = issues.some((issue) => !issue.repairable);
  return { valid: !unsafe && !badFormat.test(value), value, repaired: cleaned.repaired, issues };
};

export const auditList = (items: readonly string[], profile: FieldProfile): { valid: boolean; values: string[]; issues: AuditIssue[] } => {
  const values: string[] = [];
  const issues: AuditIssue[] = [];
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const result = auditField(item, { ...profile, id: `${profile.id}[${index}]` });
    issues.push(...result.issues);
    const key = normaliseText(result.value);
    if (seen.has(key)) issues.push({ code: "duplicate", message: `${profile.id} contains duplicate entries`, repairable: true });
    else if (result.value) {
      seen.add(key);
      values.push(result.value);
    }
  });
  return { valid: issues.every((issue) => issue.repairable) && values.length > 0, values, issues };
};
