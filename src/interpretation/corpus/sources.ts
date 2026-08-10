import type { CorpusSource } from "./types.js";

/**
 * Source approval is document-specific. Approval of one page, book or paper does
 * not approve other material from the same author, publisher or website.
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

  // Public Robert Hand essays. Only the sections named below are approved.
  // Other sections on the same pages may contain metaphysical language and are
  // deliberately outside the semantic source boundary.
  {
    id: "semantic.hand.transits-sun-intro",
    title: "The transits of the planets: The Sun - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "paragraphs describing central function and governing importance",
      "Qualities of the Sun: integration while retaining distinctions",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_sun_intro_e.htm",
      "Do not use the page's cosmic-mind or soul language as semantic input.",
    ],
  },
  {
    id: "semantic.hand.transits-moon-effects",
    title: "The transits of the planets - Effects of the transiting Moon",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "opening Inward paragraph on feelings, emotions, moods and emotional tone",
      "The Moon at the Personal Level: statement on personal and private experience",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_moon_effects_z.htm?lang=e",
      "Spiritual or incarnational material elsewhere on the page is excluded.",
    ],
  },
  {
    id: "semantic.hand.transits-mercury-intro",
    title: "The Transits of the Planets - Mercury - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "opening paragraph on communication and information",
      "passages on clear versus confused communication",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_mercury_intro_e.htm",
      "Philosophical logos language outside the reviewed passages is excluded.",
    ],
  },
  {
    id: "semantic.hand.transits-venus-intro",
    title: "The transits of the planets - Venus - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "Qualities of Venus: connection, joining and relationship",
      "Qualities of Venus: artistic creativity and aesthetic judgement",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_venus_intro_p.htm?lang=e",
      "Mythological material is not used as an interpretation claim.",
    ],
  },
  {
    id: "semantic.hand.transits-mars-intro",
    title: "The transits of the planets - Mars - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "Function in the Natal Chart: separateness, protection and defence",
      "Function in the Natal Chart: anger and physical vitality",
      "Qualities of Mars: raised energy and separative force",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_mars_intro_e.htm",
      "Gender-essentialist and mythological passages are excluded from semantic claims.",
    ],
  },
  {
    id: "semantic.hand.transits-jupiter-effects",
    title: "The transits of the planets - Effects of transiting Jupiter",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "Inward: visibility and drawing out what is present",
      "Inward: growth and expansion",
      "Inward: risk-taking and preparation",
      "Outward: learning and mental growth before the religious discussion",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_jupiter_effects_e.htm",
      "Religious and transcendent passages later in the article are excluded.",
    ],
  },
  {
    id: "semantic.hand.transits-saturn-intro",
    title: "The transits of the planets - Saturn - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "reality-system paragraphs on assumptions, culture and common sense",
      "paragraph on rules, laws, customs, limits and discipline",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_saturn_intro_e.htm",
      "The article's discussion of fate and enlightenment is explicitly outside the approved passages.",
    ],
  },
  {
    id: "semantic.hand.transits-uranus-intro",
    title: "The transits of the planets - Uranus - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "opening paragraphs on disruption, change and unnecessary boundaries",
      "paragraph on innovation and technology",
      "Ease or Difficulty: adaptation to change and openness to new ideas",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_uranus_intro_e.htm",
      "Spiritual-awakening wording elsewhere on the page is excluded.",
    ],
  },
  {
    id: "semantic.hand.transits-neptune-intro",
    title: "The transits of the planets - Neptune - Introduction",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "opening paragraph on gradual loss of clarity and definition",
      "Qualities of Neptune: blurred distinctions and diffuse connections",
      "Outward Manifestations: confusion and uncertainty before religious discussion",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_neptune_intro_e.htm",
      "All spiritual, psychic, divinatory and religious material is excluded.",
    ],
  },
  {
    id: "semantic.hand.transits-pluto-effects",
    title: "The Transits of the Planets - Effects of Transiting Pluto",
    author: "Robert Hand",
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: [
      "opening Inward paragraph on pressure, change and transformation",
      "warnings against pursuing power for its own sake",
    ],
    notes: [
      "Reviewed public source: https://www.astro.com/astrology/in_hand2_pluto_effects_e.htm",
      "Fate, transcendence, spiritual-teacher and religious material elsewhere on the page is excluded.",
    ],
  },

  // Book-length semantic candidates stay pending until exact passages are
  // available and have been reviewed. A catalogue or publisher description is
  // enough to identify a candidate source, but not enough to create claims.
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
