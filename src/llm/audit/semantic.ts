import { normaliseText } from "./text.js";

export type SemanticRole = "strength" | "tension" | "theme";

export interface SemanticProfile {
  id: string;
  field?: string;
  fieldLexicons?: Readonly<Record<string, readonly string[]>>;
}

export interface SemanticIssue {
  code: "wrong_role" | "wrong_field";
  message: string;
}

const strengthTerms = [
  "ability", "advantage", "asset", "capacity", "clarity", "confidence", "courage", "discipline", "ease",
  "effective", "gift", "initiative", "insight", "reliable", "resilience", "resource", "stable", "steadiness",
  "strength", "support", "talent", "fortaleza", "capacidad", "confianza", "valor", "disciplina", "facilidad",
  "talento", "resiliencia", "claridad", "equilibrio", "iniciativa",
] as const;

const tensionTerms = [
  "blind spot", "block", "challenge", "conflict", "difficulty", "excess", "friction", "frustration", "imbalance",
  "impatience", "instability", "pressure", "rigid", "risk", "struggle", "tension", "volatile", "vulnerable",
  "bloqueo", "conflicto", "dificultad", "exceso", "friccion", "frustracion", "desequilibrio", "impaciencia",
  "inestabilidad", "presion", "rigidez", "riesgo", "tension", "vulnerabilidad",
] as const;

const themeTerms = [
  "approach", "development", "direction", "drive", "dynamic", "emphasis", "expression", "focus", "identity",
  "interplay", "needs", "orientation", "pattern", "priorities", "purpose", "rhythm", "style", "tendency", "theme",
  "desarrollo", "direccion", "dinamica", "enfasis", "expresion", "identidad", "necesidades", "orientacion",
  "patron", "prioridades", "proposito", "ritmo", "tendencia", "tema",
] as const;

const strengthFrames = [
  /\b(?:supports?|enables?|allows?|provides?|helps?|favours?|favors?|strengthens?|improves?|grounds?|stabilises?|stabilizes?|builds?|encourages?)\b/u,
  /\b(?:apoya|permite|proporciona|ayuda|favorece|fortalece|mejora|estabiliza|fomenta)\b/u,
] as const;

const tensionFrames = [
  /\b(?:can|could|may|might)\s+(?:become|create|cause|lead to|turn into|produce|intensify|undermine|distort|overwhelm|complicate)\b/u,
  /\b(?:too|overly|excessive(?:ly)?|without|unless|but|however|yet|risk of|tendency to|hard to|difficulty with|struggle to)\b/u,
  /\b(?:undermines?|disrupts?|blocks?|strains?|limits?|destabilises?|destabilizes?|overextends?|overreacts?|avoids?|withdraws?)\b/u,
  /\b(?:puede|podria|podría)\s+(?:volverse|crear|causar|llevar a|producir|intensificar|socavar|distorsionar|abrumar|complicar)\b/u,
  /\b(?:demasiado|excesivo|excesiva|sin|a menos que|pero|sin embargo|riesgo de|tendencia a|dificultad para)\b/u,
] as const;

const countTerms = (value: string, terms: readonly string[]): number => {
  const padded = ` ${normaliseText(value)} `;
  return terms.reduce((count, term) => {
    const candidate = normaliseText(term);
    return candidate.length > 0 && padded.includes(` ${candidate} `) ? count + 1 : count;
  }, 0);
};

const countFrames = (value: string, patterns: readonly RegExp[]): number =>
  patterns.reduce((count, pattern) => count + (pattern.test(value) ? 1 : 0), 0);

export const semanticRole = (id: string): SemanticRole | null => {
  const path = normaliseText(id);
  if (/\b(?:strengths?|assets?|gifts?|advantages?|turn ons?|best expression|suitable fields?)\b/u.test(path)) return "strength";
  if (/\b(?:tensions?|difficulties|risks?|blind spots?|frustrations?|turn offs?|contradictions?|growth edges?)\b/u.test(path)) return "tension";
  if (/\b(?:themes?|emphasis|patterns?|styles?|needs|dynamic|summary|detail|overview|essence|narrative|synthesis|portrait|arc)\b/u.test(path)) return "theme";
  return null;
};

const roleTerms = (role: SemanticRole): readonly string[] => {
  switch (role) {
    case "strength": return strengthTerms;
    case "tension": return tensionTerms;
    case "theme": return themeTerms;
  }
};

const roleFrames = (role: SemanticRole): readonly RegExp[] => {
  switch (role) {
    case "strength": return strengthFrames;
    case "tension": return tensionFrames;
    case "theme": return [];
  }
};

const scoreRole = (value: string, role: SemanticRole): number =>
  countTerms(value, roleTerms(role)) + countFrames(value, roleFrames(role));

export const semanticIssues = (value: string, profile: SemanticProfile): SemanticIssue[] => {
  const normal = normaliseText(value);
  if (normal.split(" ").filter(Boolean).length < 8) return [];
  const issues: SemanticIssue[] = [];
  const role = semanticRole(profile.id);
  if (role === "strength" || role === "tension") {
    const opposite: SemanticRole = role === "strength" ? "tension" : "strength";
    const expectedScore = scoreRole(normal, role);
    const oppositeScore = scoreRole(normal, opposite);
    if (expectedScore === 0 && oppositeScore >= 3) {
      issues.push({
        code: "wrong_role",
        message: `${profile.id} strongly describes ${opposite} material instead of ${role} material`,
      });
    }
  }

  if (profile.field !== undefined && profile.fieldLexicons !== undefined) {
    const ownScore = countTerms(normal, profile.fieldLexicons[profile.field] ?? []);
    let strongest: { field: string; score: number } | null = null;
    for (const [field, terms] of Object.entries(profile.fieldLexicons)) {
      if (field === profile.field) continue;
      const score = countTerms(normal, terms);
      if (strongest === null || score > strongest.score) strongest = { field, score };
    }
    if (ownScore === 0 && strongest !== null && strongest.score >= 3) {
      issues.push({
        code: "wrong_field",
        message: `${profile.id} fits ${strongest.field} more strongly than ${profile.field}`,
      });
    }
  }
  return issues;
};
