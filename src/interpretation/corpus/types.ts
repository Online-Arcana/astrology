import type { JsonRef } from "../../types/base.js";

export type WorldviewCategory =
  | "religious_doctrine"
  | "religious_agency"
  | "divine_agency"
  | "karma_or_reincarnation"
  | "soul_assumption"
  | "fate_or_predestination"
  | "supernatural_agency"
  | "cosmic_intentionality"
  | "spiritual_worldview";

export type WorldviewSeverity = "reject" | "review";

export interface WorldviewFinding {
  category: WorldviewCategory;
  severity: WorldviewSeverity;
  phrase: string;
  reason: string;
  path?: string;
}

export interface WorldviewTextAudit {
  safe: boolean;
  requiresReview: boolean;
  findings: WorldviewFinding[];
}

export interface SourceNeutralityAudit {
  religiousDoctrine: boolean;
  religiousAgency: boolean;
  divineAgency: boolean;
  karmaOrReincarnation: boolean;
  soulAssumption: boolean;
  fateOrPredestination: boolean;
  supernaturalAgency: boolean;
  cosmicIntentionality: boolean;
  assumesSpiritualWorldview: boolean;
  safeForAgnosticCorpus: boolean;
  requiresReview: boolean;
  confidence: number;
  findings: WorldviewFinding[];
}

export type CorpusSourceRole = "calculation" | "semantic" | "architecture";
export type CorpusReviewStatus = "approved" | "pending" | "rejected";

export interface CorpusSource {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  editionOrDate: string | null;
  role: CorpusSourceRole;
  reviewStatus: CorpusReviewStatus;
  allowedSections: string[];
  notes: string[];
}

export type CorpusAtomKind =
  | "entity"
  | "domain"
  | "style"
  | "relation"
  | "condition"
  | "derived-construct";

export interface CorpusAtom {
  id: string;
  kind: CorpusAtomKind;
  displayName: string;
  plainEnglish: string;
  aliases: string[];
  internalIds: string[];
  claimIds: string[];
  doNotInfer: string[];
  relatedAtomIds: string[];
  sourceIds: string[];
  reviewStatus: CorpusReviewStatus;
}

export type CorpusClaimCategory =
  | "core"
  | "constructive"
  | "difficult"
  | "developmental"
  | "interaction";

export type CorpusClaimConfidence = "core" | "well-supported" | "school-specific" | "experimental";

export interface CorpusClaim {
  id: string;
  atomId: string;
  category: CorpusClaimCategory;
  proposition: string;
  tags: string[];
  sourceRefs: string[];
  neutrality: {
    religious: false;
    spiritual: false;
    karmic: false;
    fatalistic: false;
    supernatural: false;
  };
  confidence: CorpusClaimConfidence;
}

export interface Proposition {
  id: string;
  text: string;
  tags: string[];
  sourceClaimIds: string[];
}

export interface InterpretationMapIngredient {
  kind: string;
  atomId: string;
  technicalId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface InterpretationMap {
  unitId: string;
  subject: {
    title: string;
    plainEnglishDomain: string;
    technicalLabel?: string;
  };
  /**
   * Private chart-specific composition emitted by the built-in compiler.
   * Optional only so external/test providers created before corpus 0.2 remain
   * source-compatible; production maps produced by this repository include it.
   */
  composition?: {
    ingredients: InterpretationMapIngredient[];
  };
  chartEvidence: JsonRef[];
  semantics: {
    core: Proposition[];
    detail: Proposition[];
    themes: Proposition[];
    strengths: Proposition[];
    tensions: Proposition[];
  };
  provenance: {
    corpusAtomIds: string[];
    sourceClaimIds: string[];
    corpusVersion: string;
  };
  neutrality: {
    worldview: "agnostic";
  };
  forbiddenClaims: string[];
}

export const agnosticNeutrality = {
  worldview: "agnostic",
} as const;
