import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import { corpusSources } from "../sources.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";
import { angleAtoms, angleClaims } from "./angles.js";
import { aspectAtoms, aspectClaims } from "./aspects.js";
import { bodyAtoms, bodyClaims } from "./bodies.js";
import { domainAtoms, domainClaims, projectDomainSource } from "./domains.js";
import { houseAtoms, houseClaims } from "./houses.js";
import { patternAtoms, patternClaims, patternSources } from "./patterns.js";
import { pointAtoms, pointClaims } from "./points.js";
import { signAtoms, signClaims } from "./signs.js";

/**
 * Reviewed semantic data that has actually been approved for corpus use.
 *
 * This list is intentionally incomplete while the remaining rare points,
 * angles and derived constructs are researched. Production callers compile
 * with requireComplete=true and therefore fail closed until the complete corpus
 * has been reviewed.
 */
export const reviewedCorpusSources: readonly CorpusSource[] = [
  ...corpusSources,
  projectDomainSource,
  ...patternSources,
] as const;

export const reviewedCorpusAtoms: readonly CorpusAtom[] = [
  ...bodyAtoms,
  ...pointAtoms,
  ...angleAtoms,
  ...signAtoms,
  ...houseAtoms,
  ...aspectAtoms,
  ...patternAtoms,
  ...domainAtoms,
] as const;

export const reviewedCorpusClaims: readonly CorpusClaim[] = [
  ...bodyClaims,
  ...pointClaims,
  ...angleClaims,
  ...signClaims,
  ...houseClaims,
  ...aspectClaims,
  ...patternClaims,
  ...domainClaims,
] as const;

export const compileReviewedCorpus = (
  requireComplete = false,
): CompiledInterpretationCorpus => compileInterpretationCorpus({
  sources: reviewedCorpusSources,
  atoms: reviewedCorpusAtoms,
  claims: reviewedCorpusClaims,
  requireComplete,
});
