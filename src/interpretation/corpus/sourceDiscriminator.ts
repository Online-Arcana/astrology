import { strictShape } from "../../llm/schema/build.js";
import type { StrictShape } from "../../llm/orchestrate/types.js";
import type { SourceNeutralityAudit } from "./types.js";
import { auditSourceNeutrality } from "./worldview.js";

const boolean = { type: "boolean" } as const;
const confidence = { type: "number", minimum: 0, maximum: 1 } as const;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    religiousDoctrine: boolean,
    religiousAgency: boolean,
    divineAgency: boolean,
    karmaOrReincarnation: boolean,
    soulAssumption: boolean,
    fateOrPredestination: boolean,
    supernaturalAgency: boolean,
    cosmicIntentionality: boolean,
    assumesSpiritualWorldview: boolean,
    safeForAgnosticCorpus: boolean,
    requiresReview: boolean,
    confidence,
  },
  required: [
    "religiousDoctrine",
    "religiousAgency",
    "divineAgency",
    "karmaOrReincarnation",
    "soulAssumption",
    "fateOrPredestination",
    "supernaturalAgency",
    "cosmicIntentionality",
    "assumesSpiritualWorldview",
    "safeForAgnosticCorpus",
    "requiresReview",
    "confidence",
  ],
} as const;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bool = (value: Record<string, unknown>, key: keyof SourceNeutralityAudit): boolean => {
  const selected = value[key];
  if (typeof selected !== "boolean") throw new TypeError(`Source worldview discriminator ${String(key)} must be boolean`);
  return selected;
};

const parse = (value: unknown): SourceNeutralityAudit => {
  if (!record(value)) throw new TypeError("Source worldview discriminator output must be an object");
  const rawConfidence = value["confidence"];
  if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence) || rawConfidence < 0 || rawConfidence > 1) {
    throw new TypeError("Source worldview discriminator confidence must be a number from 0 to 1");
  }
  return {
    religiousDoctrine: bool(value, "religiousDoctrine"),
    religiousAgency: bool(value, "religiousAgency"),
    divineAgency: bool(value, "divineAgency"),
    karmaOrReincarnation: bool(value, "karmaOrReincarnation"),
    soulAssumption: bool(value, "soulAssumption"),
    fateOrPredestination: bool(value, "fateOrPredestination"),
    supernaturalAgency: bool(value, "supernaturalAgency"),
    cosmicIntentionality: bool(value, "cosmicIntentionality"),
    assumesSpiritualWorldview: bool(value, "assumesSpiritualWorldview"),
    safeForAgnosticCorpus: bool(value, "safeForAgnosticCorpus"),
    requiresReview: bool(value, "requiresReview"),
    confidence: rawConfidence,
    findings: [],
  };
};

export const sourceWorldviewDiscriminatorShape: StrictShape<SourceNeutralityAudit> = strictShape(
  "source_worldview_neutrality_audit",
  schema as unknown as Record<string, unknown>,
  parse,
);

export interface SourcePassageGate {
  deterministic: SourceNeutralityAudit;
  sendToDiscriminator: boolean;
  accepted: boolean;
  reasons: string[];
}

/**
 * First source-ingestion gate. A deterministic rejection is dropped immediately;
 * it is never sent to a distiller with instructions to remove the worldview.
 * A clean passage still requires an independent LLM classifier before extraction.
 */
export const deterministicSourcePassageGate = (passage: string): SourcePassageGate => {
  const deterministic = auditSourceNeutrality(passage);
  const accepted = false;
  if (!deterministic.safeForAgnosticCorpus) {
    return {
      deterministic,
      sendToDiscriminator: false,
      accepted,
      reasons: deterministic.findings.map(({ reason, phrase }) => `${reason} (${phrase})`),
    };
  }
  return {
    deterministic,
    sendToDiscriminator: true,
    accepted,
    reasons: ["Deterministic scan passed; independent worldview classification is still required before claim extraction"],
  };
};

export const sourceWorldviewDiscriminatorInput = (
  sourceId: string,
  passageId: string,
  passage: string,
): object => ({
  instructions: [
    "Classify whether this source passage can be used as semantic input for a completely worldview-agnostic astrology corpus.",
    "This is source screening, not rewriting. Do not sanitise, reinterpret or remove metaphysical content.",
    "Set safeForAgnosticCorpus false if the passage assumes, asserts or relies on religious doctrine or agency, divine intention, souls, karma, reincarnation, past lives, fate, destiny, predestination, supernatural causation, spiritual obligations or a purposeful universe/cosmos.",
    "A technical proper noun such as Part of Spirit does not itself make a passage unsafe if the surrounding semantic claim is entirely secular and experiential.",
    "A passage is unsafe even if the metaphysical claim is framed positively or poetically.",
    "If the passage is genuinely ambiguous about whether an external metaphysical cause is being asserted, set requiresReview true and safeForAgnosticCorpus false.",
    "Do not judge whether astrology itself is true or false. Classify only the worldview assumptions carried by the passage.",
    "Return only the strict classification schema.",
  ].join("\n"),
  sourceId,
  passageId,
  passage,
});

const assumed = (audit: SourceNeutralityAudit): string[] => [
  ["religiousDoctrine", audit.religiousDoctrine],
  ["religiousAgency", audit.religiousAgency],
  ["divineAgency", audit.divineAgency],
  ["karmaOrReincarnation", audit.karmaOrReincarnation],
  ["soulAssumption", audit.soulAssumption],
  ["fateOrPredestination", audit.fateOrPredestination],
  ["supernaturalAgency", audit.supernaturalAgency],
  ["cosmicIntentionality", audit.cosmicIntentionality],
  ["assumesSpiritualWorldview", audit.assumesSpiritualWorldview],
].filter((entry): entry is [string, true] => entry[1] === true).map(([key]) => key);

export const sourceDiscriminatorDecision = (
  audit: SourceNeutralityAudit,
): { accepted: boolean; reasons: string[] } => {
  const categories = assumed(audit);
  const accepted = audit.safeForAgnosticCorpus
    && !audit.requiresReview
    && categories.length === 0
    && audit.confidence >= 0.8;
  if (accepted) return { accepted: true, reasons: [] };
  const reasons = [
    ...(categories.length === 0 ? [] : [`worldview assumptions: ${categories.join(", ")}`]),
    ...(audit.requiresReview ? ["classifier requires human/project-policy review"] : []),
    ...(!audit.safeForAgnosticCorpus ? ["classifier marked passage unsafe for agnostic corpus"] : []),
    ...(audit.confidence < 0.8 ? [`classifier confidence ${audit.confidence.toFixed(2)} is below 0.80`] : []),
  ];
  return { accepted: false, reasons };
};
