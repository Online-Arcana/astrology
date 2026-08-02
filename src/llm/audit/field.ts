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

type SemanticRole = "strength" | "tension" | "theme";

const placeholders = /^(?:n\/a|none|unknown|tbd|todo|placeholder|\.\.\.)$/iu;
const badFormat = /```|^\s{0,3}#{1,6}\s|^\s*[-*+]\s+/mu;
const label = /^\s*[\p{L}\p{N} _-]{2,40}:\s*/u;

const strengthTerms = [
  "ability",
  "advantage",
  "asset",
  "balance",
  "capacity",
  "clarity",
  "confidence",
  "courage",
  "discipline",
  "ease",
  "effective",
  "gift",
  "initiative",
  "insight",
  "reliable",
  "resilience",
  "resource",
  "stable",
  "steadiness",
  "strength",
  "support",
  "talent",
  "fortaleza",
  "capacidad",
  "confianza",
  "valor",
  "disciplina",
  "facilidad",
  "talento",
  "resiliencia",
  "claridad",
  "equilibrio",
  "iniciativa",
] as const;

const tensionTerms = [
  "blind spot",
  "block",
  "challenge",
  "conflict",
  "difficulty",
  "excess",
  "friction",
  "frustration",
  "imbalance",
  "impatience",
  "instability",
  "pressure",
  "rigid",
  "risk",
  "struggle",
  "tension",
  "volatile",
  "vulnerable",
  "bloqueo",
  "conflicto",
  "dificultad",
  "exceso",
  "friccion",
  "frustracion",
  "desequilibrio",
  "impaciencia",
  "inestabilidad",
  "presion",
  "rigidez",
  "riesgo",
  "tension",
  "vulnerabilidad",
] as const;

const themeTerms = [
  "approach",
  "development",
  "direction",
  "drive",
  "dynamic",
  "emphasis",
  "expression",
  "focus",
  "identity",
  "interplay",
  "needs",
  "orientation",
  "pattern",
  "priorities",
  "purpose",
  "rhythm",
  "style",
  "tendency",
  "theme",
  "desarrollo",
  "direccion",
  "dinamica",
  "enfasis",
  "expresion",
  "identidad",
  "necesidades",
  "orientacion",
  "patron",
  "prioridades",
  "proposito",
  "ritmo",
  "tendencia",
  "tema",
] as const;

const forbidden = (sentence: string): boolean => forbiddenPatterns.some((pattern) => pattern.test(sentence));
const boilerplate = (sentence: string): boolean => unwantedExamples.some((example) => cosine(sentence, example) >= 0.72);

const has = (value: string, terms: readonly string[]): boolean =>
  terms.some((term) => {
    const normal = normaliseText(term);
    return normal.length > 0 && value.includes(normal);
  });

const roleFor = (id: string): SemanticRole | null => {
  const path = normaliseText(id);
  if (/\b(?:strengths?|assets?|gifts?|advantages?|turn ons?|best expression|suitable fields?)\b/u.test(path)) {
    return "strength";
  }
  if (/\b(?:tensions?|difficulties|risks?|blind spots?|frustrations?|turn offs?|contradictions?|growth edges?)\b/u.test(path)) {
    return "tension";
  }
  if (/\b(?:themes?|emphasis|patterns?|styles?|needs|dynamic|summary|detail|overview|essence|narrative|synthesis|portrait|arc)\b/u.test(path)) {
    return "theme";
  }
  return null;
};

const termsFor = (role: SemanticRole): readonly string[] => {
  switch (role) {
    case "strength":
      return strengthTerms;
    case "tension":
      return tensionTerms;
    case "theme":
      return themeTerms;
  }
};

const oppositeTermsFor = (role: SemanticRole): readonly string[] => {
  if (role === "strength") return tensionTerms;
  if (role === "tension") return strengthTerms;
  return [];
};

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
  if (normal.split(" ").length >= 8) {
    const role = roleFor(profile.id);
    const grounded = profile.lexicon.length === 0 || has(normal, profile.lexicon);
    if (role === "strength" || role === "tension") {
      const fits = has(normal, termsFor(role));
      const opposite = has(normal, oppositeTermsFor(role));
      if (opposite && !fits) {
        const expected = role === "strength" ? "a strength" : "a tension";
        issues.push({
          code: "irrelevant",
          message: `${profile.id} appears to describe the opposite semantic role instead of ${expected}`,
          repairable: false,
        });
      }
    } else {
      const roleFit = role === null ? false : has(normal, termsFor(role));
      if (!grounded && !roleFit) {
        issues.push({ code: "irrelevant", message: `${profile.id} does not fit its semantic field`, repairable: false });
      }
    }
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
