import { compileInterpretationCorpus, type CompiledInterpretationCorpus } from "../compile.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";
import { parseReviewedCorpusXml } from "../xml.js";
import {
  corpusSourceManifestName,
  corpusSourceManifestXml,
  corpusXmlDocuments,
} from "./xml.generated.js";

const parsed = parseReviewedCorpusXml(
  corpusSourceManifestXml,
  corpusSourceManifestName,
  corpusXmlDocuments,
);

/** The authored production corpus is XML; these arrays are parsed runtime records. */
export const reviewedCorpusOrigin = "xml" as const;
export const reviewedCorpusSources: readonly CorpusSource[] = parsed.sources;
export const reviewedCorpusAtoms: readonly CorpusAtom[] = parsed.atoms;
export const reviewedCorpusClaims: readonly CorpusClaim[] = parsed.claims;
export const reviewedCorpusCategories: readonly string[] = parsed.categories;

export const compileReviewedCorpus = (
  requireComplete = false,
): CompiledInterpretationCorpus => compileInterpretationCorpus({
  sources: reviewedCorpusSources,
  atoms: reviewedCorpusAtoms,
  claims: reviewedCorpusClaims,
  requireComplete,
});
