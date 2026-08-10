import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

interface PatternSeed {
  id: string;
  displayName: string;
  url: string;
  definition: string;
  tags: string[];
  doNotInfer?: string[];
  notes?: string[];
}

const seeds: readonly PatternSeed[] = [
  {
    id: "stellium",
    displayName: "Stellium",
    url: "https://www.astro.com/astrowiki/en/Stellium",
    definition: "A stellium concentrates several connected planets in one area, giving particular emphasis to the sign, house and planetary principles involved while making their effects strongly interdependent.",
    tags: ["concentration", "emphasis", "focal area", "interdependent principles"],
    doNotInfer: ["a guaranteed talent", "a guaranteed crisis"],
    notes: ["Approved only for the opening interpretation on emphasis and reciprocal planetary effects."],
  },
  {
    id: "t-square",
    displayName: "T-square",
    url: "https://www.astro.com/astrowiki/en/T-Square",
    definition: "A T-square concentrates the tension of an opposition through a third focal planet that squares both ends, making the focal point a major channel for the competing pressures in the figure.",
    tags: ["tension", "focal point", "competing pressures", "active response"],
    doNotInfer: ["an unavoidable event", "punishment", "a cosmic test"],
    notes: ["Approved only for the structural/focal interpretation. Compulsion or inevitability wording is not imported."],
  },
  {
    id: "grand-trine",
    displayName: "Grand Trine",
    url: "https://www.astro.com/astrowiki/en/Grand_Trine",
    definition: "A Grand Trine links three principles through mutually supportive trines, creating an area of comparatively easy cooperation that may become so familiar that its capacities are taken for granted or underused.",
    tags: ["support", "ease", "cooperation", "available capacity", "underuse"],
    doNotInfer: ["a cosmic gift", "grace", "guaranteed talent", "guaranteed success"],
    notes: ["Approved only for the neutral interpretation of support, comfort and possible underuse. Esoteric, divine-number, grace and cosmic-gift wording is excluded."],
  },
  {
    id: "grand-cross",
    displayName: "Grand Cross",
    url: "https://www.astro.com/astrowiki/en/Grand_Cross",
    definition: "A Grand Cross combines multiple squares and oppositions into a stable but demanding configuration, concentrating several competing pressures that require sustained effort and adjustment.",
    tags: ["competing pressures", "stability", "inflexibility", "effort", "adjustment"],
    doNotInfer: ["an unavoidable fate", "punishment", "guaranteed hardship"],
    notes: ["Approved for the description of stability, inflexibility, effort and commitment. Inevitability wording is excluded."],
  },
  {
    id: "yod",
    displayName: "Yod",
    url: "https://www.astro.com/astrowiki/en/Yod",
    definition: "A Yod combines two quincunxes with a sextile, placing subtle adjustment pressure on the focal planet while the sextile provides a potentially constructive exchange between the other two principles.",
    tags: ["adjustment", "subtle tension", "focal point", "constructive exchange"],
    doNotInfer: ["Finger of God", "divine task", "destiny", "a life mission assigned from outside"],
    notes: ["Approved only for the neutral quincunx/sextile/focal-point description. The Finger of God name and divine-task quotation are excluded."],
  },
  {
    id: "kite",
    displayName: "Kite",
    url: "https://www.astro.com/astrowiki/en/Kite",
    definition: "A Kite adds an opposition and two sextiles to a Grand Trine, introducing tension and a focal direction that can help mobilise capacities that might otherwise remain comfortable but inactive.",
    tags: ["mobilisation", "focal direction", "support plus tension", "constructive expression"],
    doNotInfer: ["guaranteed success", "destined development"],
    notes: ["Approved for the neutral interaction of trines, sextiles, opposition and focal planet."],
  },
  {
    id: "mystic-rectangle",
    displayName: "Mystic Rectangle",
    url: "https://www.astro.com/astrowiki/en/Rectangle",
    definition: "A Mystic Rectangle combines two oppositions with trines and sextiles, giving the tensions alternative supportive routes through which they can be expressed or balanced constructively.",
    tags: ["opposition tension", "alternative routes", "support", "constructive balance"],
    doNotInfer: ["mystical ability", "spiritual gifts", "divine balance"],
    notes: ["Approved only for the trine/sextile relief of opposition tension. The historical 'practical mysticism' label is not imported as a claim."],
  },
  {
    id: "grand-sextile",
    displayName: "Grand Sextile",
    url: "https://www.astro.com/astrowiki/en/Grand_Sextile",
    definition: "A Grand Sextile links six planets through a network of sextiles and trines, increasing the number of supportive connections and creating several routes for coordinated activity.",
    tags: ["supportive network", "coordination", "opportunity", "activity"],
    doNotInfer: ["guaranteed opportunity", "guaranteed success", "a special destiny"],
    notes: ["Approved for the neutral interpretation of strengthened sextile support and coordinated activity."],
  },
  {
    id: "thor-hammer",
    displayName: "Thor's Hammer",
    url: "https://www.astro.com/astrowiki/en/Thor%27s_Hammer",
    definition: "Thor's Hammer combines a square with two sesquiquadrates to a focal planet, creating a concentrated dynamic tension whose expression depends strongly on how the focal principle is handled.",
    tags: ["dynamic tension", "focal point", "pressure", "constructive outlet"],
    doNotInfer: ["Norse religious meaning", "violence", "rebellion as inevitable", "a guaranteed crisis"],
    notes: ["Approved only for the geometric pattern and the neutral idea of concentrated tension with a focal outlet. Mythology and behavioural determinism are excluded."],
  },
] as const;

const sourceId = (id: string): string => `semantic.astrodienst.pattern.${id}`;

export const patternSources: readonly CorpusSource[] = seeds.map((seed) => ({
  id: sourceId(seed.id),
  title: `${seed.displayName} - Astrodienst Astrowiki`,
  author: null,
  publisher: "Astrodienst",
  editionOrDate: null,
  role: "semantic" as const,
  reviewStatus: "approved" as const,
  allowedSections: ["interpretation-core"],
  notes: [
    `Reviewed public source: ${seed.url}`,
    ...(seed.notes ?? []),
    "Approval is limited to the project-distilled neutral proposition; other text on the page is not approved automatically.",
  ],
}));

export const patternClaims: readonly CorpusClaim[] = seeds.map((seed) => ({
  id: `pattern.${seed.id}.core.structure`,
  atomId: `pattern.${seed.id}`,
  category: "interaction" as const,
  proposition: seed.definition,
  tags: [...seed.tags],
  sourceRefs: [`${sourceId(seed.id)}#interpretation-core`],
  neutrality: neutral,
  confidence: "school-specific" as const,
}));

export const patternAtoms: readonly CorpusAtom[] = seeds.map((seed) => ({
  id: `pattern.${seed.id}`,
  kind: "derived-construct" as const,
  displayName: seed.displayName,
  plainEnglish: seed.tags.slice(0, 4).join(", "),
  aliases: [seed.displayName],
  internalIds: [seed.id.replaceAll("-", "_")],
  claimIds: [`pattern.${seed.id}.core.structure`],
  doNotInfer: [...(seed.doNotInfer ?? [])],
  relatedAtomIds: [],
  sourceIds: [sourceId(seed.id)],
  reviewStatus: "approved" as const,
}));
