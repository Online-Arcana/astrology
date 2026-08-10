import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

const elementSource = "semantic.astrodienst.brief-intro-elements";

export const balanceConditionSource: CorpusSource = {
  id: "semantic.project.chart-balance-categories",
  title: "Chart balance category definitions",
  author: "Online Arcana",
  publisher: "Online Arcana",
  editionOrDate: "2026-08-10",
  role: "semantic",
  reviewStatus: "approved",
  allowedSections: [
    "polarity-active", "polarity-receptive",
    "hemisphere-eastern", "hemisphere-western", "hemisphere-northern", "hemisphere-southern",
    "house-mode-angular", "house-mode-succedent", "house-mode-cadent",
  ],
  notes: [
    "Project-owned definitions of categories used by src/derived/calculate.ts.",
    "Polarity, hemisphere and house-mode scores are descriptive weighted groupings. They do not independently authorise personality traits, diagnoses or predictions.",
  ],
};

export const conditionClaims: readonly CorpusClaim[] = [
  {
    id: "condition.element-fire.core.style",
    atomId: "condition.element-fire",
    category: "core",
    proposition: "Fire is used as an expression-style category associated with energetic, initiating and outwardly expressive qualities.",
    tags: ["energy", "initiative", "expression", "fire"],
    sourceRefs: [`${elementSource}#fire-style`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "condition.element-earth.core.style",
    atomId: "condition.element-earth",
    category: "core",
    proposition: "Earth is used as an expression-style category associated with practical, concrete and materially grounded qualities.",
    tags: ["practicality", "concreteness", "material focus", "earth"],
    sourceRefs: [`${elementSource}#earth-style`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "condition.element-air.core.style",
    atomId: "condition.element-air",
    category: "core",
    proposition: "Air is used as an expression-style category associated with thought, communication and exchange of ideas or information.",
    tags: ["thought", "communication", "ideas", "exchange", "air"],
    sourceRefs: [`${elementSource}#air-style`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "condition.element-water.core.style",
    atomId: "condition.element-water",
    category: "core",
    proposition: "Water is used as an expression-style category associated with feeling, sensitivity and responsiveness to emotional context.",
    tags: ["feeling", "sensitivity", "emotional context", "water"],
    sourceRefs: [`${elementSource}#water-style`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "condition.modality-cardinal.core.style",
    atomId: "condition.modality-cardinal",
    category: "core",
    proposition: "Cardinal is used as a modality category associated with initiating, starting or setting activity in motion.",
    tags: ["initiation", "starting", "movement", "cardinal"],
    sourceRefs: [`${elementSource}#cardinal-mode`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "condition.modality-fixed.core.style",
    atomId: "condition.modality-fixed",
    category: "core",
    proposition: "Fixed is used as a modality category associated with sustaining, maintaining or stabilising an existing direction.",
    tags: ["sustaining", "maintaining", "stability", "fixed"],
    sourceRefs: [`${elementSource}#fixed-mode`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "condition.modality-mutable.core.style",
    atomId: "condition.modality-mutable",
    category: "core",
    proposition: "Mutable is used as a modality category associated with adaptation, transition and adjustment to changing conditions.",
    tags: ["adaptation", "transition", "adjustment", "mutable"],
    sourceRefs: [`${elementSource}#mutable-mode`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  ...([
    ["polarity-active", "Active polarity", "the weighted share of chart points falling in signs classified as active", "polarity-active"],
    ["polarity-receptive", "Receptive polarity", "the weighted share of chart points falling in signs classified as receptive", "polarity-receptive"],
    ["hemisphere-eastern", "Eastern hemisphere", "the weighted share of planets placed in houses 10, 11, 12, 1, 2 or 3", "hemisphere-eastern"],
    ["hemisphere-western", "Western hemisphere", "the weighted share of planets placed in houses 4, 5, 6, 7, 8 or 9", "hemisphere-western"],
    ["hemisphere-northern", "Northern hemisphere", "the weighted share of planets placed in houses 1 through 6", "hemisphere-northern"],
    ["hemisphere-southern", "Southern hemisphere", "the weighted share of planets placed in houses 7 through 12", "hemisphere-southern"],
    ["house-mode-angular", "Angular houses", "the weighted share of planets placed in angular houses", "house-mode-angular"],
    ["house-mode-succedent", "Succedent houses", "the weighted share of planets placed in succedent houses", "house-mode-succedent"],
    ["house-mode-cadent", "Cadent houses", "the weighted share of planets placed in cadent houses", "house-mode-cadent"],
  ] as const).map(([id, label, definition, section]) => ({
    id: `condition.${id}.core.grouping`,
    atomId: `condition.${id}`,
    category: "core" as const,
    proposition: `${label} is ${definition} in the project's chart-balance calculation.`,
    tags: [label.toLocaleLowerCase("en-GB"), "weighted grouping", "chart balance"],
    sourceRefs: [`${balanceConditionSource.id}#${section}`],
    neutrality: neutral,
    confidence: "core" as const,
  })),
] as const;

const claimsFor = (atomId: string): string[] =>
  conditionClaims.filter((claim) => claim.atomId === atomId).map((claim) => claim.id);

const condition = (
  id: string,
  displayName: string,
  plainEnglish: string,
  sourceId: string,
): CorpusAtom => ({
  id: `condition.${id}`,
  kind: "condition",
  displayName,
  plainEnglish,
  aliases: [displayName],
  internalIds: [id],
  claimIds: claimsFor(`condition.${id}`),
  doNotInfer: ["a fixed personality", "a good or bad score", "causal effects", "prediction"],
  relatedAtomIds: [],
  sourceIds: [sourceId],
  reviewStatus: "approved",
});

export const conditionAtoms: readonly CorpusAtom[] = [
  condition("element-fire", "Fire", "energetic, initiating and outwardly expressive style", elementSource),
  condition("element-earth", "Earth", "practical, concrete and materially grounded style", elementSource),
  condition("element-air", "Air", "thought, communication and exchange-oriented style", elementSource),
  condition("element-water", "Water", "feeling, sensitivity and emotionally responsive style", elementSource),
  condition("modality-cardinal", "Cardinal", "initiation and starting activity", elementSource),
  condition("modality-fixed", "Fixed", "sustaining and stabilising activity", elementSource),
  condition("modality-mutable", "Mutable", "adaptation and adjustment to change", elementSource),
  condition("polarity-active", "Active polarity", "weighted active-sign grouping", balanceConditionSource.id),
  condition("polarity-receptive", "Receptive polarity", "weighted receptive-sign grouping", balanceConditionSource.id),
  condition("hemisphere-eastern", "Eastern hemisphere", "weighted houses 10 through 3 grouping", balanceConditionSource.id),
  condition("hemisphere-western", "Western hemisphere", "weighted houses 4 through 9 grouping", balanceConditionSource.id),
  condition("hemisphere-northern", "Northern hemisphere", "weighted houses 1 through 6 grouping", balanceConditionSource.id),
  condition("hemisphere-southern", "Southern hemisphere", "weighted houses 7 through 12 grouping", balanceConditionSource.id),
  condition("house-mode-angular", "Angular houses", "weighted angular-house grouping", balanceConditionSource.id),
  condition("house-mode-succedent", "Succedent houses", "weighted succedent-house grouping", balanceConditionSource.id),
  condition("house-mode-cadent", "Cadent houses", "weighted cadent-house grouping", balanceConditionSource.id),
] as const;
