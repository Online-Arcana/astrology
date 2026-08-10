import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import { corpusSources } from "../sources.js";
import type { CorpusAtom, CorpusClaim } from "../types.js";
import { bodyAtoms, bodyClaims } from "./bodies.js";

/**
 * Reviewed semantic data that has actually been approved for corpus use.
 *
 * This list is intentionally incomplete while the remaining points, signs,
 * houses, aspects and derived constructs are researched. Production callers
 * should compile with requireComplete=true and will therefore fail closed until
 * the complete corpus has been reviewed.
 */
export const reviewedCorpusAtoms: readonly CorpusAtom[] = [
  ...bodyAtoms,
] as const;

export const reviewedCorpusClaims: readonly CorpusClaim[] = [
  ...bodyClaims,
] as const;

export const compileReviewedCorpus = (
  requireComplete = false,
): CompiledInterpretationCorpus => compileInterpretationCorpus({
  sources: corpusSources,
  atoms: reviewedCorpusAtoms,
  claims: reviewedCorpusClaims,
  requireComplete,
});
