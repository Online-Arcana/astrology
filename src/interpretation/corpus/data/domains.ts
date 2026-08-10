import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

interface DomainSeed {
  id: string;
  displayName: string;
  definition: string;
  tags: string[];
  doNotInfer?: string[];
}

const lifeSeeds: readonly DomainSeed[] = [
  { id: "identityAndPurpose", displayName: "Identity and direction", definition: "This section concerns identity, self-direction, priorities and the way a person chooses to orient their life.", tags: ["identity", "self-direction", "priorities", "chosen direction"], doNotInfer: ["divine purpose", "cosmic purpose", "one predetermined mission"] },
  { id: "emotionalNature", displayName: "Emotional nature", definition: "This section concerns emotional responses, moods, security needs and the way feelings are processed and expressed.", tags: ["emotions", "moods", "security", "emotional expression"] },
  { id: "mindAndCommunication", displayName: "Mind and communication", definition: "This section concerns thinking, learning, communication, information exchange and the way ideas are organised or expressed.", tags: ["thinking", "learning", "communication", "information"] },
  { id: "romance", displayName: "Romance", definition: "This section concerns romantic attraction, affection, courtship, attachment needs and patterns of romantic commitment.", tags: ["romance", "affection", "courtship", "attachment", "commitment"], doNotInfer: ["soulmates", "destined relationships", "a guaranteed partner"] },
  { id: "sexuality", displayName: "Sexuality", definition: "This section concerns consensual adult desire, intimate preferences, pace, communication, boundaries and sexual expression.", tags: ["desire", "intimacy", "consent", "boundaries", "sexual communication"], doNotInfer: ["sexual orientation from a chart", "consent", "a required sexual preference"] },
  { id: "committedPartnerships", displayName: "Committed partnerships", definition: "This section concerns durable one-to-one partnership, mutual expectations, commitment, autonomy and cooperation over time.", tags: ["partnership", "commitment", "mutual expectations", "autonomy", "cooperation"], doNotInfer: ["marriage is required", "a destined spouse"] },
  { id: "homeAndFamily", displayName: "Home and family", definition: "This section concerns home life, family relationships, private foundations and the practical or emotional conditions of belonging.", tags: ["home", "family", "belonging", "private life"] },
  { id: "childhoodPatterns", displayName: "Childhood patterns", definition: "This section concerns patterns associated with early home life, upbringing and responses that may have been shaped during childhood.", tags: ["childhood", "upbringing", "early patterns", "family background"], doNotInfer: ["recovered memories as fact", "parental blame as certainty"] },
  { id: "creativityAndSelfExpression", displayName: "Creativity and self-expression", definition: "This section concerns creative activity, play, visible self-expression and the ways a person develops or shares original work.", tags: ["creativity", "play", "self-expression", "original work"] },
  { id: "childrenAndNurturing", displayName: "Children and nurturing", definition: "This section concerns relationships with children, caregiving and the ways a person supports growth or development in others.", tags: ["children", "caregiving", "nurturing", "development"], doNotInfer: ["fertility", "pregnancy", "a guaranteed child"] },
  { id: "friendship", displayName: "Friendship", definition: "This section concerns friendship, companionship, mutual support and the expectations a person brings to non-romantic close relationships.", tags: ["friendship", "companionship", "mutual support", "social expectations"] },
  { id: "communityAndGroups", displayName: "Community and groups", definition: "This section concerns participation in groups, communities, networks and shared social activity.", tags: ["community", "groups", "networks", "social participation"] },
  { id: "workStyle", displayName: "Work style", definition: "This section concerns daily work habits, preferred working conditions, routines, task organisation and practical contribution.", tags: ["work habits", "routine", "organisation", "working conditions"] },
  { id: "careerAndVocation", displayName: "Career and vocation", definition: "This section concerns career direction, vocational interests, work environment, authority and the kinds of contribution a person may choose to develop.", tags: ["career", "vocation", "work environment", "authority", "contribution"], doNotInfer: ["a destined career", "a sacred calling", "one correct profession"] },
  { id: "businessAndLeadership", displayName: "Business and leadership", definition: "This section concerns leadership, collaboration, decision-making, responsibility and practical behaviour in business settings.", tags: ["leadership", "business", "collaboration", "decision-making", "responsibility"] },
  { id: "moneyAndMaterialSecurity", displayName: "Money and material security", definition: "This section concerns earning, spending, saving, material security, resource management and tolerance for financial uncertainty.", tags: ["money", "resources", "material security", "financial choices", "risk"], doNotInfer: ["financial advice", "guaranteed wealth", "guaranteed loss"] },
  { id: "publicLifeAndAmbition", displayName: "Public life and ambition", definition: "This section concerns public role, ambition, recognition, reputation and visible long-term goals.", tags: ["public role", "ambition", "recognition", "reputation", "goals"] },
  { id: "conflictAndAssertion", displayName: "Conflict and assertion", definition: "This section concerns assertion, disagreement, anger, boundary-setting, competition and responses to interpersonal pressure.", tags: ["assertion", "conflict", "anger", "boundaries", "competition"] },
  { id: "growthAndOpportunity", displayName: "Growth and opportunity", definition: "This section concerns learning, expansion, confidence, experimentation and the way a person approaches opportunities for development.", tags: ["growth", "learning", "confidence", "opportunity", "development"] },
  { id: "restrictionsAndResponsibility", displayName: "Restrictions and responsibility", definition: "This section concerns limits, obligations, discipline, responsibility and the practical adjustments required by constraints.", tags: ["limits", "obligations", "discipline", "responsibility", "constraints"], doNotInfer: ["punishment", "karmic debt", "a cosmic lesson"] },
  { id: "transformationAndCrisis", displayName: "Transformation and crisis", definition: "This section concerns intense change, crisis response, control, loss of an old structure and the practical process of rebuilding or adaptation.", tags: ["change", "crisis", "control", "restructuring", "adaptation"], doNotInfer: ["fated crisis", "spiritual rebirth", "death prediction"] },
  { id: "spiritualityAndMeaning", displayName: "Meaning and worldview", definition: "This section concerns meaning-making, worldview, reflection and any self-defined spiritual or religious questions only when those concerns are relevant to the person.", tags: ["meaning-making", "worldview", "reflection", "personal beliefs"], doNotInfer: ["religious belief", "spiritual belief", "a soul", "divine purpose", "cosmic intention"] },
  { id: "unconsciousPatterns", displayName: "Less conscious patterns", definition: "This section concerns recurring reactions, avoidance, private patterns and behaviour that may be easier to notice indirectly than deliberately.", tags: ["recurring reactions", "avoidance", "private patterns", "less conscious behaviour"], doNotInfer: ["clinical diagnosis", "repressed trauma as fact"] },
  { id: "wellbeingAndDailyRhythm", displayName: "Wellbeing and daily rhythm", definition: "This section concerns routine, rest, workload, everyday regulation and non-diagnostic patterns that may affect a person's sense of day-to-day wellbeing.", tags: ["routine", "rest", "workload", "daily rhythm", "wellbeing"], doNotInfer: ["medical diagnosis", "medical prognosis", "treatment advice"] },
  { id: "developmentalDirection", displayName: "Developmental direction", definition: "This section concerns skills, habits and choices that may become useful areas for deliberate development over time.", tags: ["development", "skills", "habits", "deliberate choices"], doNotInfer: ["destiny", "what a person is meant to become", "soul purpose"] },
] as const;

const compatibilitySeeds: readonly DomainSeed[] = [
  { id: "overall", displayName: "Overall compatibility", definition: "This domain summarises compatibility across the other relationship domains rather than treating one factor as decisive.", tags: ["overall compatibility", "mixed factors", "relationship context"] },
  { id: "romantic", displayName: "Romantic compatibility", definition: "This domain concerns romantic attraction, affection, courtship and relationship expectations.", tags: ["romance", "affection", "attraction", "relationship expectations"], doNotInfer: ["soulmates", "destined love"] },
  { id: "sexual", displayName: "Sexual compatibility", definition: "This domain concerns consensual adult attraction, desire, intimate pace, boundaries and sexual communication.", tags: ["sexual attraction", "desire", "boundaries", "communication"], doNotInfer: ["consent", "sexual orientation", "required sexual behaviour"] },
  { id: "emotional", displayName: "Emotional compatibility", definition: "This domain concerns emotional responsiveness, reassurance, closeness, autonomy and the handling of changing moods or needs.", tags: ["emotional response", "reassurance", "closeness", "autonomy"] },
  { id: "communication", displayName: "Communication compatibility", definition: "This domain concerns information exchange, conversational style, clarity, misunderstanding and the ability to discuss differences.", tags: ["communication", "clarity", "conversation", "misunderstanding"] },
  { id: "intellectual", displayName: "Intellectual compatibility", definition: "This domain concerns shared curiosity, exchange of ideas, learning style and the way two people approach reasoning or new information.", tags: ["ideas", "curiosity", "learning", "reasoning"] },
  { id: "friendship", displayName: "Friendship compatibility", definition: "This domain concerns companionship, mutual support, shared activity and the expectations involved in friendship.", tags: ["friendship", "companionship", "mutual support", "shared activity"] },
  { id: "business", displayName: "Business compatibility", definition: "This domain concerns practical collaboration, decision-making, reliability, responsibility and working toward shared business goals.", tags: ["business", "collaboration", "decisions", "reliability", "responsibility"] },
  { id: "domestic", displayName: "Domestic compatibility", definition: "This domain concerns shared home life, routines, practical responsibilities, comfort and everyday cohabitation.", tags: ["home", "routine", "shared responsibilities", "cohabitation"] },
  { id: "long-term", displayName: "Long-term compatibility", definition: "This domain concerns durability, commitment, adaptation, expectations and the ability to sustain a relationship over time.", tags: ["durability", "commitment", "adaptation", "expectations"] },
  { id: "conflict-resolution", displayName: "Conflict-resolution compatibility", definition: "This domain concerns disagreement, assertion, negotiation, repair and the way two people respond when their needs conflict.", tags: ["conflict", "negotiation", "repair", "assertion"] },
  { id: "spiritual", displayName: "Meaning and worldview compatibility", definition: "This domain concerns compatibility in meaning-making, worldview and self-defined beliefs; it does not assume that either person follows a spiritual or religious worldview.", tags: ["meaning-making", "worldview", "personal beliefs", "reflection"], doNotInfer: ["shared religion", "shared spiritual belief", "a karmic bond", "a soul connection"] },
] as const;

const synthesisSeeds: readonly DomainSeed[] = [
  { id: "overview", displayName: "Chart overview", definition: "This unit summarises the main supported themes of the selected chart system without introducing new chart facts.", tags: ["overview", "main themes", "selected chart system"] },
  { id: "system-synthesis", displayName: "System synthesis", definition: "This unit combines already interpreted units from one selected chart system into a coherent account while preserving contradictions and differences between fields.", tags: ["synthesis", "coherence", "contradictions", "selected chart system"] },
  { id: "final-synthesis", displayName: "Final synthesis", definition: "This unit combines the accepted chart and compatibility interpretations into a final summary without adding unsupported claims.", tags: ["final synthesis", "accepted interpretations", "summary", "no new claims"] },
] as const;

const lifeSection = (id: string): string => `life-${id.replaceAll(/([a-z])([A-Z])/gu, "$1-$2").toLocaleLowerCase("en-GB")}`;
const compatibilitySection = (id: string): string => `compatibility-${id}`;
const synthesisSection = (id: string): string => `synthesis-${id}`;

export const projectDomainSource: CorpusSource = {
  id: "semantic.project.interpretation-domain-taxonomy",
  title: "Interpretation domain taxonomy",
  author: "Online Arcana",
  publisher: "Online Arcana",
  editionOrDate: "2026-08-10",
  role: "semantic",
  reviewStatus: "approved",
  allowedSections: [
    ...lifeSeeds.map(({ id }) => lifeSection(id)),
    ...compatibilitySeeds.map(({ id }) => compatibilitySection(id)),
    ...synthesisSeeds.map(({ id }) => synthesisSection(id)),
  ],
  notes: [
    "Project-owned output taxonomy. It defines what a section is responsible for; it does not supply astrological meanings for chart factors.",
    "Astrological claims used inside these domains must still come from independently approved corpus atoms and chart evidence.",
  ],
};

const claimFor = (prefix: "life-domain" | "compatibility-domain" | "synthesis", seed: DomainSeed): CorpusClaim => ({
  id: `${prefix}.${seed.id}.scope`,
  atomId: `${prefix}.${seed.id}`,
  category: "core",
  proposition: seed.definition,
  tags: [...seed.tags],
  sourceRefs: [`${projectDomainSource.id}#${prefix === "life-domain" ? lifeSection(seed.id) : prefix === "compatibility-domain" ? compatibilitySection(seed.id) : synthesisSection(seed.id)}`],
  neutrality: neutral,
  confidence: "core",
});

const atomFor = (prefix: "life-domain" | "compatibility-domain" | "synthesis", seed: DomainSeed): CorpusAtom => ({
  id: `${prefix}.${seed.id}`,
  kind: prefix === "synthesis" ? "derived-construct" : "domain",
  displayName: seed.displayName,
  plainEnglish: seed.tags.slice(0, 4).join(", "),
  aliases: [seed.displayName],
  internalIds: [seed.id],
  claimIds: [`${prefix}.${seed.id}.scope`],
  doNotInfer: [...(seed.doNotInfer ?? [])],
  relatedAtomIds: [],
  sourceIds: [projectDomainSource.id],
  reviewStatus: "approved",
});

export const domainClaims: readonly CorpusClaim[] = [
  ...lifeSeeds.map((seed) => claimFor("life-domain", seed)),
  ...compatibilitySeeds.map((seed) => claimFor("compatibility-domain", seed)),
  ...synthesisSeeds.map((seed) => claimFor("synthesis", seed)),
];

export const domainAtoms: readonly CorpusAtom[] = [
  ...lifeSeeds.map((seed) => atomFor("life-domain", seed)),
  ...compatibilitySeeds.map((seed) => atomFor("compatibility-domain", seed)),
  ...synthesisSeeds.map((seed) => atomFor("synthesis", seed)),
];
