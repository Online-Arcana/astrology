import { requiredCorpusAtomIds } from "./requirements.js";
import type {
  CorpusAtom,
  CorpusClaim,
  CorpusSource,
  InterpretationMap,
} from "./types.js";
import { assertAgnosticText, auditSourceNeutrality, auditWorldviewObject } from "./worldview.js";

export const corpusPolicyVersion = "astral-corpus-policy/1.0.0" as const;
export const interpretationCorpusVersion = "astral-interpretation-corpus/0.1.0" as const;

export interface CorpusBuildInput {
  sources: readonly CorpusSource[];
  atoms: readonly CorpusAtom[];
  claims: readonly CorpusClaim[];
  /** Production builds set this to true. Test and review tooling may compile partial corpora. */
  requireComplete?: boolean;
}

export interface CompiledInterpretationCorpus {
  schema: "astral-interpretation-corpus/1.0.0";
  policyVersion: typeof corpusPolicyVersion;
  corpusVersion: typeof interpretationCorpusVersion;
  worldview: "agnostic";
  sources: readonly CorpusSource[];
  atoms: Readonly<Record<string, CorpusAtom>>;
  claims: Readonly<Record<string, CorpusClaim>>;
}

const unique = <T extends { id: string }>(values: readonly T[], kind: string): Map<string, T> => {
  const output = new Map<string, T>();
  for (const value of values) {
    if (output.has(value.id)) throw new Error(`Duplicate ${kind} ID ${value.id}`);
    output.set(value.id, value);
  }
  return output;
};

const sourceIdFromRef = (ref: string): string => ref.split("#", 1)[0] ?? ref;

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

const validateAtom = (
  atom: CorpusAtom,
  sources: ReadonlyMap<string, CorpusSource>,
): void => {
  if (atom.reviewStatus !== "approved") {
    throw new Error(`Corpus atom ${atom.id} is not approved for production compilation`);
  }
  if (atom.plainEnglish.trim().length === 0) throw new Error(`Corpus atom ${atom.id} has no plain-English semantic label`);
  assertAgnosticText(atom.plainEnglish, `Corpus atom ${atom.id}`);
  if (atom.sourceIds.length === 0) throw new Error(`Corpus atom ${atom.id} has no semantic source provenance`);
  for (const sourceId of atom.sourceIds) {
    const source = sources.get(sourceId);
    if (source === undefined) throw new Error(`Corpus atom ${atom.id} references unknown source ${sourceId}`);
    if (source.role !== "semantic" || source.reviewStatus !== "approved") {
      throw new Error(`Corpus atom ${atom.id} references source ${sourceId} that is not an approved semantic source`);
    }
  }
};

const validateClaimProvenance = (
  claim: CorpusClaim,
  sources: ReadonlyMap<string, CorpusSource>,
): void => {
  for (const ref of claim.sourceRefs) {
    const sourceId = sourceIdFromRef(ref);
    const source = sources.get(sourceId);
    if (source === undefined) throw new Error(`Corpus claim ${claim.id} references unknown source ${sourceId}`);
    if (source.role !== "semantic" || source.reviewStatus !== "approved") {
      throw new Error(`Corpus claim ${claim.id} references source ${sourceId} that is not an approved semantic source`);
    }
  }
};

export const compileInterpretationCorpus = (
  input: CorpusBuildInput,
): CompiledInterpretationCorpus => {
  const sources = unique(input.sources, "source");
  const atoms = unique(input.atoms, "atom");
  const claims = unique(input.claims, "claim");

  for (const atom of atoms.values()) validateAtom(atom, sources);
  for (const claim of claims.values()) {
    validateCorpusClaim(claim);
    validateClaimProvenance(claim, sources);
    const atom = atoms.get(claim.atomId);
    if (atom === undefined) throw new Error(`Corpus claim ${claim.id} references unknown atom ${claim.atomId}`);
    if (!atom.claimIds.includes(claim.id)) {
      throw new Error(`Corpus claim ${claim.id} is not declared by atom ${claim.atomId}`);
    }
  }

  for (const atom of atoms.values()) {
    if (atom.claimIds.length === 0) throw new Error(`Corpus atom ${atom.id} has no semantic claims`);
    for (const claimId of atom.claimIds) {
      const claim = claims.get(claimId);
      if (claim === undefined) throw new Error(`Corpus atom ${atom.id} references missing claim ${claimId}`);
      if (claim.atomId !== atom.id) throw new Error(`Corpus atom ${atom.id} owns claim ${claimId} assigned to ${claim.atomId}`);
    }
  }

  if (input.requireComplete === true) {
    const missing = requiredCorpusAtomIds.filter((id) => !atoms.has(id));
    if (missing.length > 0) {
      throw new Error(`Production corpus is incomplete; missing required atoms: ${missing.join(", ")}`);
    }
  }

  return {
    schema: "astral-interpretation-corpus/1.0.0",
    policyVersion: corpusPolicyVersion,
    corpusVersion: interpretationCorpusVersion,
    worldview: "agnostic",
    sources: [...sources.values()],
    atoms: Object.fromEntries([...atoms.entries()]),
    claims: Object.fromEntries([...claims.entries()]),
  };
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