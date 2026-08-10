import type { CorpusClaim, CorpusSource, InterpretationMap } from "./types.js";
import { assertAgnosticText, auditSourceNeutrality, auditWorldviewObject } from "./worldview.js";

export const corpusPolicyVersion = "astral-corpus-policy/1.0.0" as const;
export const interpretationCorpusVersion = "astral-interpretation-corpus/0.1.0" as const;

export const validateSourceForSemanticIngestion = (
  source: CorpusSource,
  passage: string,
): void => {
  if (source.role !== "semantic") {
    throw new Error(`Source ${source.id} is not approved for semantic corpus ingestion`);
  }
  if (source.reviewStatus !== "approved") {
    throw new Error(`Source ${source.id} has not been explicitly approved for semantic corpus ingestion`);
  }
  const audit = auditSourceNeutrality(passage);
  if (!audit.safeForAgnosticCorpus) {
    throw new Error(`Source passage ${source.id} failed worldview-neutrality policy`);
  }
};

export const validateCorpusClaim = (claim: CorpusClaim): void => {
  if (
    claim.neutrality.religious
    || claim.neutrality.spiritual
    || claim.neutrality.karmic
    || claim.neutrality.fatalistic
    || claim.neutrality.supernatural
  ) {
    throw new Error(`Corpus claim ${claim.id} carries a non-agnostic neutrality marker`);
  }
  assertAgnosticText(claim.proposition, `Corpus claim ${claim.id}`);
  if (claim.sourceRefs.length === 0) {
    throw new Error(`Corpus claim ${claim.id} requires at least one approved source reference`);
  }
};

export const validateInterpretationMap = (map: InterpretationMap): void => {
  if (map.neutrality.worldview !== "agnostic") {
    throw new Error(`Interpretation map ${map.unitId} must declare an agnostic worldview`);
  }
  if (map.provenance.corpusVersion.trim().length === 0) {
    throw new Error(`Interpretation map ${map.unitId} requires a corpus version`);
  }
  const audit = auditWorldviewObject(map, `interpretationMap.${map.unitId}`);
  if (!audit.safe || audit.requiresReview) {
    throw new Error(`Interpretation map ${map.unitId} failed worldview-neutrality policy`);
  }
};
