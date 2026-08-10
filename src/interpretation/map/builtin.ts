import { compileReviewedCorpus } from "../corpus/data/index.js";
import type { CompiledInterpretationCorpus } from "../corpus/compile.js";
import { semanticProviderFromCorpus, type InterpretationSemanticProvider } from "./provider.js";

/**
 * The checked-in corpus is compiled once when the interpretation runtime is
 * loaded. `requireComplete=true` makes an incomplete or invalid corpus a startup
 * error rather than silently returning to model-owned astrology semantics.
 */
export const productionInterpretationCorpus: CompiledInterpretationCorpus = compileReviewedCorpus(true);

export const productionSemanticProvider: InterpretationSemanticProvider = semanticProviderFromCorpus(
  productionInterpretationCorpus,
);
