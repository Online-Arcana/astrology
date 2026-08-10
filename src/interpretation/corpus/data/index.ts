import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import { corpusSources } from "../sources.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";
import { angleAtoms, angleClaims, angleSources } from "./angles.js";
import { aspectAtoms, aspectClaims } from "./aspects.js";
import { bodyAtoms, bodyClaims } from "./bodies.js";
import { derivedAtoms, derivedClaims, derivedSources } from "./derived.js";
import { domainAtoms, domainClaims, projectDomainSource } from "./domains.js";
import { houseAtoms, houseClaims } from "./houses.js";
import { patternAtoms, patternClaims, patternSources } from "./patterns.js";
import { pointAtoms, pointClaims, pointSources } from "./points.js";
import { signAtoms, signClaims } from "./signs.js";

/**
 * Reviewed semantic data that has actually been approved for corpus use.
 *
 * The only required semantic atoms intentionally left incomplete here are the
 * eclipse units. Production callers compile with requireComplete=true and
 * therefore remain fail-closed until those have defensible agnostic semantics.
 */
export const reviewedCorpusSources: readonly CorpusSource[] = [
  ...corpusSources,
  projectDomainSource,
  ...pointSources,
  ...angleSources,
  ...patternSources,
  ...derivedSources,
] as const;

export const reviewedCorpusAtoms: readonly CorpusAtom[] = [
  ...bodyAtoms,
  ...pointAtoms,
  ...angleAtoms,
  ...signAtoms,
  ...houseAtoms,
  ...aspectAtoms,
  ...patternAtoms,
  ...derivedAtoms,
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
  ...derivedClaims,
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
