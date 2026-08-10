import type { CorpusSource } from "./types.js";

/**
 * Source approval is deliberately document-level. A shared domain or publisher
 * never grants automatic permission for another document to enter the semantic
 * corpus.
 *
 * Semantic candidates stay pending until the exact edition/sections have been
 * reviewed and passage-level worldview neutrality has been verified.
 */
export const corpusSources: readonly CorpusSource[] = [
  {
    id: "technical.swisseph.programming-interface",
    title: "Swiss Ephemeris Programming Interface",
    author: "Astrodienst",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "calculation",
    reviewStatus: "approved",
    allowedSections: [
      "planetary and lunar calculations",
      "lunar nodes",
      "houses",
      "Vertex and Antivertex geometry",
      "coordinate systems",
    ],
    notes: [
      "Calculation reference only. This approval does not extend to interpretation prose on other Astrodienst documents or AstroWiki pages.",
    ],
  },
  {
    id: "semantic.tompkins.contemporary-handbook",
    title: "The Contemporary Astrologer's Handbook",
    author: "Sue Tompkins",
    publisher: null,
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "pending",
    allowedSections: [],
    notes: [
      "Candidate source for planets, signs, houses, elements, modes, aspects, nodes and synthesis.",
      "Do not ingest until exact edition and approved sections have passed passage-level worldview review.",
    ],
  },
  {
    id: "semantic.tompkins.aspects",
    title: "Aspects in Astrology",
    author: "Sue Tompkins",
    publisher: null,
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "pending",
    allowedSections: [],
    notes: [
      "Candidate source for planetary principles and aspect composition.",
      "Combination essays must be distilled into atoms/operators rather than copied as canned readings.",
    ],
  },
  {
    id: "semantic.hand.horoscope-symbols",
    title: "Horoscope Symbols",
    author: "Robert Hand",
    publisher: null,
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "pending",
    allowedSections: [],
    notes: [
      "Candidate source for fundamental symbolic principles, planets/points, aspects, signs, angles and houses.",
      "No semantic claim may compile until exact passages are reviewed and provenance is recorded.",
    ],
  },
  {
    id: "semantic.martin.mapping-psyche-2",
    title: "Mapping the Psyche, Volume 2",
    author: "Clare Martin",
    publisher: "Centre for Psychological Astrology",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "pending",
    allowedSections: [],
    notes: [
      "Candidate source for aspects, houses, angles and lunar nodes.",
      "Any spiritual, karmic, fatalistic or supernatural passage is dropped rather than sanitised for ingestion.",
    ],
  },
  {
    id: "architecture.hall-shaw.valens-combination",
    title: "The logic of planetary combination in Vettius Valens",
    author: "Hall and Shaw",
    publisher: "arXiv",
    editionOrDate: "2022",
    role: "architecture",
    reviewStatus: "approved",
    allowedSections: ["combinatorial structure"],
    notes: [
      "Architecture reference only. It may support atom/operator composition design but is not an interpretation-semantic source.",
    ],
  },
] as const;

export const corpusSource = (id: string): CorpusSource | null =>
  corpusSources.find((source) => source.id === id) ?? null;

export const approvedSemanticSource = (id: string): CorpusSource | null => {
  const source = corpusSource(id);
  return source?.role === "semantic" && source.reviewStatus === "approved" ? source : null;
};
