export const internalReferencePattern = /#\/[\p{L}\p{N}_~./-]+/gu;

export interface ReferenceLeak {
  path: string;
  references: string[];
}

export const leakedReferences = (value: string, path: string): ReferenceLeak | null => {
  const matches = [...value.matchAll(internalReferencePattern)].map(([match]) => match);
  return matches.length === 0 ? null : { path, references: [...new Set(matches)] };
};

export const withoutInternalReferences = (value: string): string => value
  .replaceAll(internalReferencePattern, " ")
  .replaceAll(/\s+([,.;:!?])/gu, "$1")
  .replaceAll(/\s+/gu, " ")
  .trim();
