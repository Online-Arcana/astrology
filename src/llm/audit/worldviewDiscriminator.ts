import { strictShape } from "../schema/build.js";
import type { StrictShape } from "../orchestrate/types.js";

export interface InterpretationWorldviewAudit {
  assumesReligion: boolean;
  assumesDeity: boolean;
  assumesDivineAgency: boolean;
  assumesSoulMetaphysics: boolean;
  assumesKarma: boolean;
  assumesReincarnation: boolean;
  assumesFate: boolean;
  assumesPredestination: boolean;
  assumesCosmicIntentionality: boolean;
  assumesSupernaturalCausation: boolean;
  couldBeReadAgnostically: boolean;
  confidence: number;
}

const boolean = { type: "boolean" } as const;
const confidence = { type: "number", minimum: 0, maximum: 1 } as const;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assumesReligion: boolean,
    assumesDeity: boolean,
    assumesDivineAgency: boolean,
    assumesSoulMetaphysics: boolean,
    assumesKarma: boolean,
    assumesReincarnation: boolean,
    assumesFate: boolean,
    assumesPredestination: boolean,
    assumesCosmicIntentionality: boolean,
    assumesSupernaturalCausation: boolean,
    couldBeReadAgnostically: boolean,
    confidence,
  },
  required: [
    "assumesReligion",
    "assumesDeity",
    "assumesDivineAgency",
    "assumesSoulMetaphysics",
    "assumesKarma",
    "assumesReincarnation",
    "assumesFate",
    "assumesPredestination",
    "assumesCosmicIntentionality",
    "assumesSupernaturalCausation",
    "couldBeReadAgnostically",
    "confidence",
  ],
} as const;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const booleanAt = (value: Record<string, unknown>, key: keyof InterpretationWorldviewAudit): boolean => {
  const selected = value[key];
  if (typeof selected !== "boolean") throw new TypeError(`Worldview discriminator ${key} must be boolean`);
  return selected;
};

const parse = (value: unknown): InterpretationWorldviewAudit => {
  if (!record(value)) throw new TypeError("Worldview discriminator output must be an object");
  const rawConfidence = value["confidence"];
  if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence) || rawConfidence < 0 || rawConfidence > 1) {
    throw new TypeError("Worldview discriminator confidence must be a number from 0 to 1");
  }
  return {
    assumesReligion: booleanAt(value, "assumesReligion"),
    assumesDeity: booleanAt(value, "assumesDeity"),
    assumesDivineAgency: booleanAt(value, "assumesDivineAgency"),
    assumesSoulMetaphysics: booleanAt(value, "assumesSoulMetaphysics"),
    assumesKarma: booleanAt(value, "assumesKarma"),
    assumesReincarnation: booleanAt(value, "assumesReincarnation"),
    assumesFate: booleanAt(value, "assumesFate"),
    assumesPredestination: booleanAt(value, "assumesPredestination"),
    assumesCosmicIntentionality: booleanAt(value, "assumesCosmicIntentionality"),
    assumesSupernaturalCausation: booleanAt(value, "assumesSupernaturalCausation"),
    couldBeReadAgnostically: booleanAt(value, "couldBeReadAgnostically"),
    confidence: rawConfidence,
  };
};

export const worldviewDiscriminatorShape: StrictShape<InterpretationWorldviewAudit> = strictShape(
  "interpretation_worldview_audit",
  schema as unknown as Record<string, unknown>,
  parse,
);

export const worldviewDiscriminatorInput = (
  unitId: string,
  candidate: object,
  reasons: readonly string[],
): object => ({
  instructions: [
    "Classify only whether the supplied astrology interpretation imposes a religious, spiritual, karmic, fatalistic or supernatural worldview.",
    "Do not judge whether astrology itself is true or false and do not rewrite the interpretation.",
    "A technical proper name such as Part of Spirit is allowed when it is only the conventional name of an astrological point.",
    "Reject claims of God or divine intention, souls, karma, reincarnation, fate, predestination, supernatural intervention or a universe/cosmos that intentionally sends lessons, people or events.",
    "Also reject unnamed intentional metaphysics such as claiming an encounter was placed in someone's path or necessarily happened for a pre-existing cosmic reason.",
    "Ordinary psychological language about development, relationships, values, choices, change, meaning and personally consequential events is agnostic when it does not assert a metaphysical cause.",
    "Return only the strict classification schema.",
  ].join("\n"),
  unitId,
  deterministicReviewReasons: [...reasons],
  candidate,
});

const assumptionKeys = [
  "assumesReligion",
  "assumesDeity",
  "assumesDivineAgency",
  "assumesSoulMetaphysics",
  "assumesKarma",
  "assumesReincarnation",
  "assumesFate",
  "assumesPredestination",
  "assumesCosmicIntentionality",
  "assumesSupernaturalCausation",
] as const satisfies readonly (keyof InterpretationWorldviewAudit)[];

export const worldviewDiscriminatorErrors = (audit: InterpretationWorldviewAudit): string[] => {
  const assumed = assumptionKeys.filter((key) => audit[key] === true);
  if (assumed.length === 0 && audit.couldBeReadAgnostically) return [];
  const details = assumed.length === 0 ? "could not be read agnostically" : `assumed ${assumed.join(", ")}`;
  return [`Worldview discriminator rejected the interpretation because it ${details} (confidence ${audit.confidence.toFixed(2)})`];
};
