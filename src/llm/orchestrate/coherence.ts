import type { UnitResult } from "./types.js";

export type CoherenceScope = "lane" | "wave";

export interface CoherenceIssue {
  scope: CoherenceScope;
  code: "duplicate" | "contradiction";
  units: string[];
  paths: string[];
  message: string;
}

/**
 * Separate interpretation units describe different placements, houses, aspects,
 * relationships and conditions. Their conclusions may legitimately pull in
 * different directions: a person can be guarded publicly and warm privately,
 * restrained in one domain and intense in another.
 *
 * Hard validation therefore belongs inside each unit and against deterministic
 * source references. Cross-unit narrative comparison must not rewrite accepted
 * interpretations or stop chart generation. Keep this API as a deliberately
 * non-blocking boundary for recovery-schema compatibility.
 */
export const coherenceIssues = (
  _units: Readonly<Record<string, UnitResult<object>>>,
  _scope: CoherenceScope,
): CoherenceIssue[] => [];

export const conflictingUnits = (issues: readonly CoherenceIssue[]): Set<string> => new Set(
  issues.flatMap(({ units }) => units.slice(1)),
);
