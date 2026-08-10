import type { CorpusAtom, CorpusClaim } from "../types.js";

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

const source = "semantic.astrodienst.brief-intro-signs";

interface SignSeed {
  id: string;
  displayName: string;
  proposition: string;
  tags: string[];
  doNotInfer?: string[];
}

const seeds: readonly SignSeed[] = [
  {
    id: "aries",
    displayName: "Aries",
    proposition: "Aries describes an energetic, initiating and direct style that tends to act quickly and can become impulsive when speed outruns reflection.",
    tags: ["initiative", "energy", "directness", "courage", "impulsiveness"],
    doNotInfer: ["aggression is inevitable", "natural superiority", "a fixed personality"],
  },
  {
    id: "taurus",
    displayName: "Taurus",
    proposition: "Taurus describes a steadfast, deliberate and security-oriented style that values stability, continuity and tangible comfort.",
    tags: ["steadiness", "security", "stability", "deliberation", "comfort"],
    doNotInfer: ["materialism as a moral flaw", "wealth", "a fixed personality"],
  },
  {
    id: "gemini",
    displayName: "Gemini",
    proposition: "Gemini describes a communicative, mobile and learning-oriented style that tends to move readily among ideas, information and changing interests.",
    tags: ["communication", "mobility", "learning", "wit", "variety"],
    doNotInfer: ["dishonesty", "two personalities", "a fixed personality"],
  },
  {
    id: "cancer",
    displayName: "Cancer",
    proposition: "Cancer describes an emotionally responsive, closeness-seeking and security-oriented style that gives weight to familiarity and personal connection.",
    tags: ["emotional response", "security", "closeness", "family orientation", "persistence"],
    doNotInfer: ["a required family role", "maternal identity", "a fixed personality"],
  },
  {
    id: "leo",
    displayName: "Leo",
    proposition: "Leo describes an expressive, generous and organising style that is comfortable with visibility, leadership and taking a central role.",
    tags: ["expression", "generosity", "organisation", "visibility", "leadership"],
    doNotInfer: ["narcissism", "fame", "natural superiority", "a fixed personality"],
  },
  {
    id: "virgo",
    displayName: "Virgo",
    proposition: "Virgo describes a precise, differentiating and practical style that pays close attention to what is useful, necessary or in need of refinement.",
    tags: ["precision", "differentiation", "practicality", "usefulness", "critical evaluation"],
    doNotInfer: ["perfectionism as inevitable", "servitude", "a fixed personality"],
  },
  {
    id: "libra",
    displayName: "Libra",
    proposition: "Libra describes a tactful, proportion-seeking and relational style that gives weight to balance, harmony and consideration of more than one side.",
    tags: ["balance", "harmony", "tact", "proportion", "comparison"],
    doNotInfer: ["indecision is inevitable", "a required romantic orientation", "a fixed personality"],
  },
  {
    id: "scorpio",
    displayName: "Scorpio",
    proposition: "Scorpio describes an intense, passionate and penetrating style that tends to engage deeply rather than superficially with demanding material.",
    tags: ["intensity", "passion", "depth", "penetrating focus", "extremity"],
    doNotInfer: ["occult ability", "dangerousness", "vengefulness", "supernatural sensitivity", "a fixed personality"],
  },
  {
    id: "sagittarius",
    displayName: "Sagittarius",
    proposition: "Sagittarius describes a freedom-seeking, mobile and exploratory style that tends to welcome movement, variety and a broader field of experience.",
    tags: ["freedom", "movement", "exploration", "cheerfulness", "variety"],
    doNotInfer: ["religious faith", "good luck", "a destined journey", "a fixed personality"],
  },
  {
    id: "capricorn",
    displayName: "Capricorn",
    proposition: "Capricorn describes an enduring, ambitious and goal-directed style that tends to apply effort steadily toward defined aims.",
    tags: ["endurance", "ambition", "goals", "persistence", "purposeful effort"],
    doNotInfer: ["status seeking as inevitable", "destined success", "a fixed life purpose", "a fixed personality"],
  },
  {
    id: "aquarius",
    displayName: "Aquarius",
    proposition: "Aquarius describes a communicative, progressive and group-oriented style that gives weight to ideas, collective concerns and change beyond established convention.",
    tags: ["communication", "progressive ideas", "groups", "collective concerns", "innovation"],
    doNotInfer: ["a universal spirit", "spiritual mission", "political ideology", "a fixed personality"],
  },
  {
    id: "pisces",
    displayName: "Pisces",
    proposition: "Pisces describes a sensitive, compassionate and adaptable style that tends to respond readily to emotional context and the needs of other people.",
    tags: ["sensitivity", "compassion", "adaptability", "helpfulness", "sociability"],
    doNotInfer: ["religious faith", "psychic ability", "spiritual sensitivity as fact", "a fixed personality"],
  },
] as const;

export const signClaims: readonly CorpusClaim[] = seeds.map((seed) => ({
  id: `sign.${seed.id}.core.style`,
  atomId: `sign.${seed.id}`,
  category: "core" as const,
  proposition: seed.proposition,
  tags: [...seed.tags],
  sourceRefs: [`${source}#sign-${seed.id}-summary`],
  neutrality: neutral,
  confidence: "well-supported" as const,
}));

export const signAtoms: readonly CorpusAtom[] = seeds.map((seed) => ({
  id: `sign.${seed.id}`,
  kind: "style" as const,
  displayName: seed.displayName,
  plainEnglish: seed.tags.slice(0, 4).join(", "),
  aliases: [seed.displayName],
  internalIds: [seed.id],
  claimIds: [`sign.${seed.id}.core.style`],
  doNotInfer: [...(seed.doNotInfer ?? []), "literal causal effects from sign placement"],
  relatedAtomIds: [],
  sourceIds: [source],
  reviewStatus: "approved" as const,
}));
