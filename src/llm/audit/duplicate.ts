import { withoutInternalReferences } from "./reference.js";
import { cosine, normaliseText } from "./text.js";

export interface NarrativeEntry {
  path: string;
  value: string;
}

export type DuplicateKind = "exact" | "near";

export interface DuplicateMatch {
  path: string;
  score: number;
  threshold: number;
  kind: DuplicateKind;
}

const words = (value: string): Set<string> => new Set(
  normaliseText(withoutInternalReferences(value))
    .split(" ")
    .filter((word) => word.length > 2),
);

const jaccard = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const word of left) if (right.has(word)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
};

export const normaliseNarrative = (value: string): string =>
  normaliseText(withoutInternalReferences(value));

export const duplicateMatch = (
  value: string,
  path: string,
  prior: readonly NarrativeEntry[],
): DuplicateMatch | null => {
  const normal = normaliseNarrative(value);
  if (normal.length < 60) return null;
  const currentWords = words(value);
  let best: DuplicateMatch | null = null;

  for (const candidate of prior) {
    if (candidate.path === path) continue;
    const candidateNormal = normaliseNarrative(candidate.value);
    if (candidateNormal.length < 60) continue;

    if (normal === candidateNormal) {
      return { path: candidate.path, score: 1, threshold: 1, kind: "exact" };
    }

    const score = cosine(normal, candidateNormal);
    const overlap = jaccard(currentWords, words(candidate.value));
    const threshold = normal.length >= 180 && candidateNormal.length >= 180 ? 0.92 : 0.94;

    if (score < threshold || overlap < 0.68) continue;
    const match: DuplicateMatch = { path: candidate.path, score, threshold, kind: "near" };
    if (best === null || match.score > best.score) best = match;
  }

  return best;
};
