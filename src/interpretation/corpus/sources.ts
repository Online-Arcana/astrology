import { reviewedCorpusSources } from "./data/index.js";
import type { CorpusSource } from "./types.js";

/**
 * Compatibility/query facade for corpus source metadata.
 *
 * The source of truth is `data/xml/sources.xml`. This module deliberately does
 * not define source records in TypeScript; it only queries the records parsed
 * from that XML manifest.
 */
export const corpusSources: readonly CorpusSource[] = reviewedCorpusSources;

export const corpusSource = (id: string): CorpusSource | null =>
  corpusSources.find((source) => source.id === id) ?? null;

export const approvedSemanticSource = (id: string): CorpusSource | null => {
  const source = corpusSource(id);
  return source?.role === "semantic" && source.reviewStatus === "approved" ? source : null;
};
