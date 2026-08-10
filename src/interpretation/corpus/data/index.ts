import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import { corpusSources } from "../sources.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";
import { angleAtoms, angleClaims, angleSources } from "./angles.js";
import { aspectAtoms, aspectClaims } from "./aspects.js";
import { bodyAtoms, bodyClaims } from "./bodies.js";
import { balanceConditionSource, conditionAtoms, conditionClaims } from "./conditions.js";
import { derivedAtoms, derivedClaims, derivedSources } from "./derived.js";
import { domainAtoms, domainClaims, projectDomainSource } from "./domains.js";
import { eclipseAtoms, eclipseClaims, eclipseSources } from "./eclipses.js";
import { houseAtoms, houseClaims } from "./houses.js";
import { patternAtoms, patternClaims, patternSources } from "./patterns.js";
import { pointAtoms, pointClaims, pointSources } from "./points.js";
import { signAtoms, signClaims } from "./signs.js";

/** Reviewed semantic data approved for production corpus compilation. */
export const reviewedCorpusSources: readonly CorpusSource[] = [
  ...corpusSources,
  projectDomainSource,
  balanceConditionSource,
  ...pointSources,
  ...angleSources,
  ...patternSources,
  ...derivedSources,
  ...eclipseSources,
] as const;

export const reviewedCorpusAtoms: readonly CorpusAtom[] = [
  ...bodyAtoms,
  ...pointAtoms,
  ...angleAtoms,
  ...signAtoms,
  ...houseAtoms,
  ...aspectAtoms,
  ...conditionAtoms,
  ...patternAtoms,
  ...derivedAtoms,
  ...eclipseAtoms,
  ...domainAtoms,
] as const;

export const reviewedCorpusClaims: readonly CorpusClaim[] = [
  ...bodyClaims,
  ...pointClaims,
  ...angleClaims,
  ...signClaims,
  ...houseClaims,
  ...aspectClaims,
  ...conditionClaims,
  ...patternClaims,
  ...derivedClaims,
  ...eclipseClaims,
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
