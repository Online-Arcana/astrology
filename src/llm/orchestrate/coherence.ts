import { duplicateMatch, type NarrativeEntry } from "../audit/duplicate.js";
import { normaliseText } from "../audit/text.js";
import type { UnitResult } from "./types.js";

export type CoherenceScope = "lane" | "wave";

export interface CoherenceIssue {
  scope: CoherenceScope;
  code: "duplicate" | "contradiction";
  units: string[];
  paths: string[];
  message: string;
}

interface UnitNarrative extends NarrativeEntry {
  unitId: string;
}

const structural = new Set(["status", "sign", "domain"]);

const narratives = (
  value: unknown,
  unitId: string,
  path = unitId,
  key: string | null = null,
): UnitNarrative[] => {
  if (key === "sourceRefs") return [];
  if (typeof value === "string") {
    return key !== null && structural.has(key) || value.length < 60 ? [] : [{ unitId, path, value }];
  }
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => narratives(item, unitId, `${path}[${index}]`, null));
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([childKey, child]) => narratives(child, unitId, `${path}.${childKey}`, childKey));
};

const negated = (value: string): string => normaliseText(value)
  .replaceAll(/\b(?:do not|does not|cannot|can not|never|no longer|not)\b/gu, "")
  .replaceAll(/\b(?:no|sin|nunca|jamás)\b/gu, "")
  .replaceAll(/\s+/gu, " ")
  .trim();

const hasNegation = (value: string): boolean =>
  /\b(?:do not|does not|cannot|can not|never|not|no|sin|nunca|jamás)\b/iu.test(value);

const contradiction = (left: string, right: string): boolean => {
  if (hasNegation(left) === hasNegation(right)) return false;
  const baseLeft = negated(left);
  const baseRight = negated(right);
  if (baseLeft.length < 40 || baseRight.length < 40) return false;
  const leftWords = new Set(baseLeft.split(" "));
  const rightWords = new Set(baseRight.split(" "));
  let shared = 0;
  for (const word of leftWords) if (word.length > 3 && rightWords.has(word)) shared += 1;
  return shared >= 7;
};

export const coherenceIssues = (
  units: Readonly<Record<string, UnitResult<object>>>,
  scope: CoherenceScope,
): CoherenceIssue[] => {
  const entries = Object.values(units).flatMap((unit) => narratives(unit.value, unit.id));
  const issues: CoherenceIssue[] = [];
  const prior: UnitNarrative[] = [];

  for (const entry of entries) {
    const duplicate = duplicateMatch(entry.value, entry.path, prior);
    if (duplicate !== null) {
      const matched = prior.find(({ path }) => path === duplicate.path);
      if (matched !== undefined && matched.unitId !== entry.unitId) {
        issues.push({
          scope,
          code: "duplicate",
          units: [matched.unitId, entry.unitId],
          paths: [matched.path, entry.path],
          message: `${entry.path} duplicates ${matched.path} at ${duplicate.score.toFixed(4)}`,
        });
      }
    }
    for (const candidate of prior) {
      if (candidate.unitId === entry.unitId || !contradiction(candidate.value, entry.value)) continue;
      issues.push({
        scope,
        code: "contradiction",
        units: [candidate.unitId, entry.unitId],
        paths: [candidate.path, entry.path],
        message: `${entry.path} appears to contradict ${candidate.path}`,
      });
      break;
    }
    prior.push(entry);
  }

  return issues;
};

export const conflictingUnits = (issues: readonly CoherenceIssue[]): Set<string> => new Set(
  issues.flatMap(({ units }) => units.slice(1)),
);
