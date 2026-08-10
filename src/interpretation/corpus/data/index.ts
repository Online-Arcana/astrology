import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import { corpusSources } from "../sources.js";
import type { CorpusAtom, CorpusClaim } from "../types.js";
import { angleAtoms, angleClaims } from "./angles.js";
import { aspectAtoms, aspectClaims } from "./aspects.js";
import { bodyAtoms, bodyClaims } from "./bodies.js";
import { houseAtoms, houseClaims } from "./houses.js";
import { pointAtoms, pointClaims } from "./points.js";
import { signAtoms, signClaims } from "./signs.js";

/**
 * Reviewed semantic data that has actually been approved for corpus use.
 *
 * This list is intentionally incomplete while the remaining points, angles,
 * patterns, derived constructs, life domains and synthesis units are researched.
 * Production callers compile with requireComplete=true and therefore fail closed
 * until the complete corpus has been reviewed.
 */
export const reviewedCorpusAtoms: readonly CorpusAtom[] = [
  ...bodyAtoms,
  ...pointAtoms,
  ...angleAtoms,
  ...signAtoms,
  ...houseAtoms,
  ...aspectAtoms,
] as const;

export const reviewedCorpusClaims: readonly CorpusClaim[] = [
  ...bodyClaims,
  ...pointClaims,
  ...angleClaims,
  ...signClaims,
  ...houseClaims,
  ...aspectClaims,
] as const;

export const compileReviewedCorpus = (
  requireComplete = false,
): CompiledInterpretationCorpus => compileInterpretationCorpus({
  sources: corpusSources,
  atoms: reviewedCorpusAtoms,
  claims: reviewedCorpusClaims,
  requireComplete,
});
