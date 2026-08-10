import type { CorpusAtom, CorpusClaim } from "../types.js";

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

const source = "semantic.hand.transits-jupiter-angles";

export const angleClaims: readonly CorpusClaim[] = [
  {
    id: "angle.ascendant.core.presentation",
    atomId: "angle.ascendant",
    category: "core",
    proposition: "The Ascendant is associated with the part of personality that is presented outward and used in direct interaction with other people.",
    tags: ["self-presentation", "outward expression", "interaction", "visible personality"],
    sourceRefs: [`${source}#ascendant-presentation`],
    neutrality: neutral,
    confidence: "core",
  },
  {
    id: "angle.descendant.core.other-facing",
    atomId: "angle.descendant",
    category: "core",
    proposition: "The Descendant is associated with the other-facing side of interaction: how other people and the surrounding world seem to present themselves in relation to the chart owner.",
    tags: ["other people", "relational response", "interaction", "world-facing"],
    sourceRefs: [`${source}#descendant-world-facing`],
    neutrality: neutral,
    confidence: "well-supported",
  },
  {
    id: "angle.midheaven.core.direction",
    atomId: "angle.midheaven",
    category: "core",
    proposition: "The Midheaven is associated with public direction, career or profession, social role and the direction in which a person's visible activity develops.",
    tags: ["life direction", "career", "social role", "public activity"],
    sourceRefs: [`${source}#midheaven-life-direction`],
    neutrality: neutral,
    confidence: "core",
  },
  {
    id: "angle.imum-coeli.core.home-history",
    atomId: "angle.imum-coeli",
    category: "core",
    proposition: "The Imum Coeli is associated with the home-and-origin side of the MC-IC axis, including early and current home life and the background from which later public direction develops.",
    tags: ["home", "origins", "private foundation", "personal history"],
    sourceRefs: [`${source}#ic-home-history`],
    neutrality: neutral,
    confidence: "well-supported",
  },
] as const;

const claimsFor = (atomId: string): string[] =>
  angleClaims.filter((claim) => claim.atomId === atomId).map((claim) => claim.id);

export const angleAtoms: readonly CorpusAtom[] = [
  {
    id: "angle.ascendant",
    kind: "entity",
    displayName: "Ascendant",
    plainEnglish: "self-presentation and direct outward interaction",
    aliases: ["Ascendant", "Rising Sign", "ASC"],
    internalIds: ["ascendant"],
    claimIds: claimsFor("angle.ascendant"),
    doNotInfer: ["a fixed personality", "physical appearance as certainty", "the whole identity"],
    relatedAtomIds: ["angle.descendant"],
    sourceIds: [source],
    reviewStatus: "approved",
  },
  {
    id: "angle.descendant",
    kind: "entity",
    displayName: "Descendant",
    plainEnglish: "the other-facing side of interaction and relational response",
    aliases: ["Descendant", "DSC"],
    internalIds: ["descendant"],
    claimIds: claimsFor("angle.descendant"),
    doNotInfer: ["a destined partner", "soulmate", "the exact traits of a future spouse"],
    relatedAtomIds: ["angle.ascendant"],
    sourceIds: [source],
    reviewStatus: "approved",
  },
  {
    id: "angle.midheaven",
    kind: "entity",
    displayName: "Midheaven",
    plainEnglish: "public direction, career and social role",
    aliases: ["Midheaven", "Medium Coeli", "MC"],
    internalIds: ["midheaven"],
    claimIds: claimsFor("angle.midheaven"),
    doNotInfer: ["divine calling", "destined career", "one fixed life purpose"],
    relatedAtomIds: ["angle.imum-coeli"],
    sourceIds: [source],
    reviewStatus: "approved",
  },
  {
    id: "angle.imum-coeli",
    kind: "entity",
    displayName: "Imum Coeli",
    plainEnglish: "home, origins, private foundation and personal history",
    aliases: ["Imum Coeli", "IC"],
    internalIds: ["imum_coeli"],
    claimIds: claimsFor("angle.imum-coeli"),
    doNotInfer: ["ancestral karma", "past lives", "a predetermined family fate"],
    relatedAtomIds: ["angle.midheaven"],
    sourceIds: [source],
    reviewStatus: "approved",
  },
] as const;
