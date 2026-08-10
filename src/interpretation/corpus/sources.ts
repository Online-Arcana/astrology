import type { CorpusSource } from "./types.js";

const reviewedHandPage = (
  id: string,
  title: string,
  url: string,
  allowedSections: readonly string[],
  exclusions: string,
): CorpusSource => ({
  id,
  title,
  author: "Robert Hand",
  publisher: "Astrodienst",
  editionOrDate: null,
  role: "semantic",
  reviewStatus: "approved",
  allowedSections: [...allowedSections],
  notes: [
    `Reviewed public source: ${url}`,
    exclusions,
  ],
});

/**
 * Source approval is document-specific. Section IDs are stable provenance keys
 * used by CorpusClaim.sourceRefs; descriptive review notes stay in `notes`.
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
      "planetary-lunar-calculations",
      "lunar-nodes",
      "houses",
      "vertex-antivertex-geometry",
      "coordinate-systems",
    ],
    notes: [
      "Calculation reference only. Approval does not extend to interpretation prose on other Astrodienst documents or AstroWiki pages.",
    ],
  },

  reviewedHandPage(
    "semantic.hand.transits-sun-intro",
    "The transits of the planets: The Sun - Introduction",
    "https://www.astro.com/astrology/in_hand2_sun_intro_e.htm",
    ["central-function", "qualities-integration"],
    "Cosmic-mind and soul language elsewhere on the page is excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-moon-effects",
    "The transits of the planets - Effects of the transiting Moon",
    "https://www.astro.com/astrology/in_hand2_moon_effects_z.htm?lang=e",
    ["inward-opening", "personal-private"],
    "Spiritual, incarnational and paranormal material elsewhere on the page is excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-mercury-intro",
    "The Transits of the Planets - Mercury - Introduction",
    "https://www.astro.com/astrology/in_hand2_mercury_intro_e.htm",
    ["communication-information", "clear-communication", "confused-communication"],
    "Philosophical logos language outside the reviewed passages is excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-venus-intro",
    "The transits of the planets - Venus - Introduction",
    "https://www.astro.com/astrology/in_hand2_venus_intro_p.htm?lang=e",
    ["qualities-connection", "qualities-aesthetics"],
    "Mythological material is not used as interpretation provenance.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-mars-intro",
    "The transits of the planets - Mars - Introduction",
    "https://www.astro.com/astrology/in_hand2_mars_intro_e.htm",
    ["natal-protection-separateness", "natal-anger-vitality", "qualities-energy-separation"],
    "Gender-essentialist, mythological and philosophical passages are excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-jupiter-effects",
    "The transits of the planets - Effects of transiting Jupiter",
    "https://www.astro.com/astrology/in_hand2_jupiter_effects_e.htm",
    ["inward-visibility", "inward-growth", "inward-risk", "outward-learning"],
    "Religious and transcendent passages later in the article are excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-saturn-intro",
    "The transits of the planets - Saturn - Introduction",
    "https://www.astro.com/astrology/in_hand2_saturn_intro_e.htm",
    ["reality-system", "rules-limits-discipline"],
    "The article's discussion of fate and enlightenment is outside the approved passages.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-uranus-intro",
    "The transits of the planets - Uranus - Introduction",
    "https://www.astro.com/astrology/in_hand2_uranus_intro_e.htm",
    ["opening-change-boundaries", "innovation-technology", "adaptation-new-ideas"],
    "Spiritual-awakening wording elsewhere on the page is excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-neptune-intro",
    "The transits of the planets - Neptune - Introduction",
    "https://www.astro.com/astrology/in_hand2_neptune_intro_e.htm",
    ["opening-loss-of-clarity", "qualities-blurred-distinctions", "outward-confusion"],
    "Spiritual, psychic, divinatory and religious material is excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-pluto-effects",
    "The Transits of the Planets - Effects of Transiting Pluto",
    "https://www.astro.com/astrology/in_hand2_pluto_effects_e.htm",
    ["inward-change-pressure", "inward-power-warning"],
    "Fate, transcendence, spiritual-teacher and religious material elsewhere on the page is excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.transits-moon-nodes",
    "The transits of the planets - Transits of the Moon",
    "https://www.astro.com/astrology/in_hand2_moon_transits_e.htm",
    ["node-network-cycle", "north-node-initiation", "south-node-consequences"],
    "Only the Lunar Nodes section describing network interaction and the North/South phases is approved. Other Moon transit sections may contain religious, paranormal or gender-essentialist wording and are excluded.",
  ),
  reviewedHandPage(
    "semantic.hand.lot-fortune-spirit",
    "The Lot or Part of Fortune",
    "https://www.astro.com/astrology/in_fortune_e.htm",
    ["fortune-physical-social-world", "fortune-material-support", "spirit-will-intention", "spirit-chosen-career-direction"],
    "Only the named neutral passages are approved. Karmic, soul, spiritual-basis-of-illness, death, sex-role and other worldview-dependent material elsewhere in the article is excluded.",
  ),

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
      "Candidate for planets, signs, houses, elements, modes, aspects, nodes and synthesis.",
      "Exact edition and passages still require review.",
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
      "Candidate for planetary principles and aspect composition.",
      "Combination essays are not used as canned readings.",
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
      "Candidate for fundamental symbolic principles, points, aspects, signs, angles and houses.",
      "Exact passages still require review.",
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
      "Candidate for aspects, houses, angles and lunar nodes.",
      "Any worldview-dependent passage is rejected rather than rewritten into the corpus.",
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
    allowedSections: ["combinatorial-structure"],
    notes: [
      "Architecture reference only; it cannot provide interpretation claims.",
    ],
  },
] as const;

export const corpusSource = (id: string): CorpusSource | null =>
  corpusSources.find((source) => source.id === id) ?? null;

export const approvedSemanticSource = (id: string): CorpusSource | null => {
  const source = corpusSource(id);
  return source?.role === "semantic" && source.reviewStatus === "approved" ? source : null;
};
