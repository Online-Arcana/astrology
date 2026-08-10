import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import { corpusSources } from "../sources.js";
import type { CorpusAtom, CorpusClaim } from "../types.js";
import { bodyAtoms, bodyClaims } from "./bodies.js";
import { pointAtoms, pointClaims } from "./points.js";

/**
 * Reviewed semantic data that has actually been approved for corpus use.
 *
 * This list is intentionally incomplete while the remaining points, angles,
 * signs, houses, aspects and derived constructs are researched. Production
 * callers compile with requireComplete=true and therefore fail closed until
 * the complete corpus has been reviewed.
 */
export const reviewedCorpusAtoms: readonly CorpusAtom[] = [
  ...bodyAtoms,
  ...pointAtoms,
] as const;

export const reviewedCorpusClaims: readonly CorpusClaim[] = [
  ...bodyClaims,
  ...pointClaims,
] as const;

export const compileReviewedCorpus = (
  requireComplete = false,
): CompiledInterpretationCorpus => compileInterpretationCorpus({
  sources: corpusSources,
  atoms: reviewedCorpusAtoms,
  claims: reviewedCorpusClaims,
  requireComplete,
});
