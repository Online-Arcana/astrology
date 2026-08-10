import {
  interpretationCorpusVersion,
  type CompiledInterpretationCorpus,
  validateInterpretationMap,
} from "../corpus/compile.js";
import type {
  CorpusAtom,
  CorpusClaim,
  InterpretationMap,
  Proposition,
} from "../corpus/types.js";
import { agnosticNeutrality } from "../corpus/types.js";
import type { DecomposedInterpretationUnit } from "./decompose.js";

const globalForbiddenClaims = [
  "religious doctrine or divine intention",
  "souls, soul contracts or soul purpose as metaphysical facts",
  "karma, karmic debt, reincarnation or past-life causation",
  "fate, destiny, predestination or events being meant to happen",
  "supernatural intervention or external spiritual agency",
  "the universe, cosmos or life intentionally sending lessons, people or events",
  "literal causal claims that an astrological placement makes an event or trait happen",
] as const;

const atomFor = (
  corpus: CompiledInterpretationCorpus,
  atomId: string,
): CorpusAtom => {
  const atom = corpus.atoms[atomId];
  if (atom === undefined) throw new Error(`Interpretation map requires missing corpus atom ${atomId}`);
  return atom;
};

const claimFor = (
  corpus: CompiledInterpretationCorpus,
  claimId: string,
): CorpusClaim => {
  const claim = corpus.claims[claimId];
  if (claim === undefined) throw new Error(`Interpretation map requires missing corpus claim ${claimId}`);
  return claim;
};

const proposition = (claim: CorpusClaim): Proposition => ({
  id: `proposition.${claim.id}`,
  text: claim.proposition,
  tags: [...claim.tags],
  sourceClaimIds: [claim.id],
});

const uniquePropositions = (values: readonly Proposition[]): Proposition[] => {
  const seen = new Set<string>();
  const output: Proposition[] = [];
  for (const value of values) {
    if (seen.has(value.id)) continue;
    seen.add(value.id);
    output.push(value);
  }
  return output;
};

const semanticBuckets = (
  corpus: CompiledInterpretationCorpus,
  atoms: readonly CorpusAtom[],
): InterpretationMap["semantics"] => {
  const core: Proposition[] = [];
  const detail: Proposition[] = [];
  const themes: Proposition[] = [];
  const strengths: Proposition[] = [];
  const tensions: Proposition[] = [];

  for (const atom of atoms) {
    for (const claimId of atom.claimIds) {
      const claim = claimFor(corpus, claimId);
      const value = proposition(claim);
      switch (claim.category) {
        case "core": core.push(value); break;
        case "constructive": strengths.push(value); break;
        case "difficult": tensions.push(value); break;
        case "developmental": detail.push(value); break;
        case "interaction": themes.push(value); break;
      }
    }
  }

  return {
    core: uniquePropositions(core),
    detail: uniquePropositions(detail),
    themes: uniquePropositions(themes),
    strengths: uniquePropositions(strengths),
    tensions: uniquePropositions(tensions),
  };
};

const uniqueAtoms = (values: readonly CorpusAtom[]): CorpusAtom[] => {
  const seen = new Set<string>();
  const output: CorpusAtom[] = [];
  for (const value of values) {
    if (seen.has(value.id)) continue;
    seen.add(value.id);
    output.push(value);
  }
  return output;
};

const titleFor = (atoms: readonly CorpusAtom[]): string =>
  atoms.map(({ displayName }) => displayName).join(" · ");

const domainFor = (atoms: readonly CorpusAtom[]): string =>
  atoms.map(({ plainEnglish }) => plainEnglish).join("; ");

export const compileInterpretationMap = (
  corpus: CompiledInterpretationCorpus,
  unit: DecomposedInterpretationUnit,
): InterpretationMap => {
  if (corpus.worldview !== "agnostic") throw new Error("Interpretation map compiler requires an agnostic corpus");
  const atoms = uniqueAtoms(unit.ingredients.map(({ atomId }) => atomFor(corpus, atomId)));
  if (atoms.length === 0) throw new Error(`Interpretation unit ${unit.unitId} has no semantic atoms`);

  const sourceClaimIds = [...new Set(atoms.flatMap(({ claimIds }) => claimIds))];
  const forbiddenClaims = [...new Set([
    ...globalForbiddenClaims,
    ...atoms.flatMap(({ doNotInfer }) => doNotInfer),
  ])];

  const map: InterpretationMap = {
    unitId: unit.unitId,
    subject: {
      title: titleFor(atoms),
      plainEnglishDomain: domainFor(atoms),
      technicalLabel: unit.unitId,
    },
    composition: {
      ingredients: unit.ingredients.map(({ kind, atomId, technicalId, metadata }) => ({
        kind,
        atomId,
        technicalId,
        metadata: { ...metadata },
      })),
    },
    chartEvidence: [...unit.evidenceRefs],
    semantics: semanticBuckets(corpus, atoms),
    provenance: {
      corpusAtomIds: atoms.map(({ id }) => id),
      sourceClaimIds,
      corpusVersion: corpus.corpusVersion ?? interpretationCorpusVersion,
    },
    neutrality: agnosticNeutrality,
    forbiddenClaims,
  };

  validateInterpretationMap(map);
  return map;
};

export const semanticPropositionTexts = (map: InterpretationMap): string[] => [
  ...map.semantics.core,
  ...map.semantics.detail,
  ...map.semantics.themes,
  ...map.semantics.strengths,
  ...map.semantics.tensions,
].map(({ text }) => text);
