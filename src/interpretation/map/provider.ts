import type { AstralCalculation, InterpretationUnit } from "../../types/file.js";
import type { CompiledInterpretationCorpus } from "../corpus/compile.js";
import type { InterpretationMap } from "../corpus/types.js";
import { compileInterpretationMap } from "./compile.js";
import { decomposeInterpretationUnit } from "./decompose.js";

export interface InterpretationSemanticProvider {
  /**
   * Return the complete neutral semantic map for one planned interpretation unit.
   * Implementations must fail closed rather than returning a partial map.
   */
  mapFor(calculation: AstralCalculation, unit: InterpretationUnit): InterpretationMap;
}

export const semanticProviderFromCorpus = (
  corpus: CompiledInterpretationCorpus,
): InterpretationSemanticProvider => {
  if (corpus.worldview !== "agnostic") {
    throw new Error("Interpretation semantic provider requires an agnostic compiled corpus");
  }
  return {
    mapFor: (calculation, unit) => compileInterpretationMap(
      corpus,
      decomposeInterpretationUnit(calculation, unit),
    ),
  };
};
