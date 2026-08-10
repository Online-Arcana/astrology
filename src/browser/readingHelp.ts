export const stripZodiacPrefix = (value: string): string => value
  .replace(/^\s*(?:tropical|sidereal)\s+/iu, "")
  .trim();

const pointNames: Readonly<Record<string, string>> = {
  "north node true": "North Node",
  "north node mean": "North Node",
  "south node true": "South Node",
  "south node mean": "South Node",
  "part of fortune": "Part of Fortune",
  "part of spirit": "Part of Spirit",
  "imum coeli": "Imum Coeli",
  "east point": "East Point",
  "lilith true": "Lilith",
  "lilith mean": "Lilith",
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  ascendant: "Ascendant",
  descendant: "Descendant",
  midheaven: "Midheaven",
  vertex: "Vertex",
  antivertex: "Antivertex",
};

const pointPhrases = Object.keys(pointNames).sort((left, right) => right.length - left.length);

const aspectNames: Readonly<Record<string, { label: string; description: string }>> = {
  conjunction: {
    label: "conjunct",
    description: "A conjunction places two chart points close together, so astrologers interpret their themes as strongly combined.",
  },
  opposition: {
    label: "opposite",
    description: "An opposition places two chart points roughly 180° apart and is interpreted as a polarity that asks for balance between them.",
  },
  trine: {
    label: "trine",
    description: "A trine is an approximately 120° aspect traditionally interpreted as a relatively easy flow between the two factors.",
  },
  square: {
    label: "square",
    description: "A square is an approximately 90° aspect traditionally interpreted as friction or pressure that requires an active response.",
  },
  sextile: {
    label: "sextile",
    description: "A sextile is an approximately 60° aspect traditionally interpreted as a supportive opportunity that benefits from being used deliberately.",
  },
  quincunx: {
    label: "quincunx",
    description: "A quincunx is an approximately 150° aspect traditionally associated with adjustment between factors that do not fit together automatically.",
  },
  semisextile: {
    label: "semi-sextile",
    description: "A semi-sextile is an approximately 30° minor aspect usually read as a subtle connection that requires awareness to use constructively.",
  },
  semisquare: {
    label: "semi-square",
    description: "A semi-square is an approximately 45° minor aspect traditionally associated with low-level friction or pressure.",
  },
  sesquiquadrate: {
    label: "sesquiquadrate",
    description: "A sesquiquadrate is an approximately 135° minor aspect traditionally associated with persistent tension that encourages adjustment.",
  },
  quintile: {
    label: "quintile",
    description: "A quintile is an approximately 72° minor aspect traditionally associated with creative or specialised ways of combining two factors.",
  },
  biquintile: {
    label: "biquintile",
    description: "A biquintile is an approximately 144° minor aspect traditionally associated with creative or specialised expression.",
  },
};

interface AspectTitle {
  title: string;
  description: string;
}

const parseAspect = (rawTitle: string): AspectTitle | null => {
  const stripped = stripZodiacPrefix(rawTitle)
    .replaceAll(/[_\.]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-GB");
  if (!stripped.startsWith("aspect ")) return null;
  const body = stripped.slice("aspect ".length);
  const kind = Object.keys(aspectNames)
    .sort((left, right) => right.length - left.length)
    .find((candidate) => body.endsWith(` ${candidate}`));
  if (kind === undefined) return null;
  const pair = body.slice(0, -(kind.length + 1)).trim();
  const first = pointPhrases.find((candidate) => pair.startsWith(`${candidate} `));
  if (first === undefined) return null;
  const second = pair.slice(first.length).trim();
  const firstName = pointNames[first];
  const secondName = pointNames[second];
  const aspect = aspectNames[kind];
  if (firstName === undefined || secondName === undefined || aspect === undefined) return null;
  return {
    title: `${firstName} ${aspect.label} ${secondName}`,
    description: `This section interprets the relationship between ${firstName} and ${secondName}. ${aspect.description}`,
  };
};

const replacements: readonly [RegExp, string][] = [
  [/^life\s+/iu, ""],
  [/^point\s+/iu, ""],
  [/^pattern\s+/iu, ""],
  [/^eclipse\s+/iu, ""],
  [/\brulership dignity\b/iu, "Rulership and dignity"],
  [/\bchildren And Nurturing\b/u, "Children and nurturing"],
  [/\bcommitted Partnerships\b/u, "Committed partnerships"],
  [/\bcommunity And Groups\b/u, "Community and groups"],
  [/\bhome And Family\b/u, "Home and family"],
  [/\bchildhood Patterns\b/u, "Childhood patterns"],
  [/\bunconscious Patterns\b/u, "Unconscious patterns"],
  [/\bmoney And Material Security\b/u, "Money and material security"],
  [/\bbusiness And Leadership\b/u, "Business and leadership"],
  [/\bcareer And Vocation\b/u, "Career and vocation"],
  [/\bpublic Life And Ambition\b/u, "Public life and ambition"],
  [/\bconflict And Assertion\b/u, "Conflict and assertion"],
  [/\bgrowth And Opportunity\b/u, "Growth and opportunity"],
  [/\brestrictions And Responsibility\b/u, "Restrictions and responsibility"],
  [/\btransformation And Crisis\b/u, "Transformation and crisis"],
  [/\bspirituality And Meaning\b/u, "Spirituality and meaning"],
  [/\bwellbeing And Daily Rhythm\b/u, "Wellbeing and daily rhythm"],
  [/\bdevelopmental Direction\b/u, "Developmental direction"],
  [/\bidentity And Purpose\b/u, "Identity and purpose"],
  [/\bemotional Nature\b/u, "Emotional nature"],
  [/\bmind And Communication\b/u, "Mind and communication"],
  [/\bcreativity And Self Expression\b/u, "Creativity and self-expression"],
  [/\bnorth node mean south node mean\b/iu, "Lunar nodes"],
  [/\bnorth node true south node true\b/iu, "Lunar nodes"],
  [/\bantivertex vertex\b/iu, "Vertex–Antivertex axis"],
  [/\bascendant descendant\b/iu, "Ascendant–Descendant axis"],
  [/\bimum coeli midheaven\b/iu, "Home–public life axis"],
  [/\bt square\b/iu, "T-square"],
  [/\bgrand trine\b/iu, "Grand trine"],
  [/\bgrand cross\b/iu, "Grand cross"],
  [/\bmystic rectangle\b/iu, "Mystic rectangle"],
  [/\bgrand sextile\b/iu, "Grand sextile"],
  [/\bthor hammer\b/iu, "Thor's hammer"],
];

export const displayReadingTitle = (rawTitle: string): string => {
  const aspect = parseAspect(rawTitle);
  if (aspect !== null) return aspect.title;

  let value = stripZodiacPrefix(rawTitle)
    .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll(/[_\.]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement).trim();
  if (value.length === 0) return "Chart section";
  return `${value[0]?.toLocaleUpperCase("en-GB") ?? ""}${value.slice(1)}`;
};

const topicDescriptions: Readonly<Record<string, string>> = {
  "identity and purpose": "This section brings together the chart factors associated with identity, direction and the way you develop a sense of purpose.",
  "emotional nature": "This section focuses on emotional needs, instinctive reactions and the conditions that tend to help you feel secure.",
  "mind and communication": "This section focuses on how you process information, communicate, learn and make sense of what is happening around you.",
  romance: "This section focuses on attraction, affection, courtship and the patterns you tend to bring into romantic relationships.",
  sexuality: "This section focuses on desire, intimacy, physical affection, boundaries and sexual communication.",
  "committed partnerships": "This section focuses on long-term one-to-one relationships, commitment, cooperation and the needs that become important in partnership.",
  "home and family": "This section focuses on home life, family relationships, belonging and the private foundations that support the rest of your life.",
  "childhood patterns": "This section focuses on formative family patterns and early experiences that may continue to influence how you respond as an adult.",
  "creativity and self-expression": "This section focuses on creativity, play, pleasure and the ways you naturally want to express something of yourself.",
  "children and nurturing": "This section focuses on how you approach care, nurturing, responsibility for dependants and relationships with children.",
  friendship: "This section focuses on friendship, loyalty, social connection and the qualities you tend to value in chosen companions.",
  "community and groups": "This section focuses on groups, networks, communities and the role you tend to take when working or participating with others.",
  "work style": "This section focuses on your everyday approach to work, routines, responsibility and practical contribution.",
  "career and vocation": "This section focuses on vocation, professional direction, ambition and the kinds of work in which your abilities may be most useful.",
  "business and leadership": "This section focuses on leadership, organisation, decision-making and how you tend to operate in professional or commercial settings.",
  "money and material security": "This section focuses on money, resources, security, spending, earning and the practical choices that support material stability.",
  "public life and ambition": "This section focuses on reputation, visibility, ambition and the role you may seek to build in the wider world.",
  "conflict and assertion": "This section focuses on how you assert yourself, respond to opposition and manage disagreement or competitive pressure.",
  "growth and opportunity": "This section focuses on the conditions that encourage growth, confidence, expansion and new opportunities.",
  "restrictions and responsibility": "This section focuses on limits, obligations, discipline and the responsibilities that ask for patience or sustained effort.",
  "transformation and crisis": "This section focuses on periods of profound change, pressure, endings and the ways you tend to rebuild after disruption.",
  "spirituality and meaning": "This section focuses on belief, meaning, ideals and the ways you look for a larger framework through which to understand experience.",
  "unconscious patterns": "This section focuses on less conscious habits, defences and recurring patterns that can influence you before you deliberately recognise them.",
  "wellbeing and daily rhythm": "This section focuses on routines, workload, rest and the everyday patterns that affect your sense of physical and mental balance.",
  "developmental direction": "This section focuses on the qualities and experiences astrologers associate with your longer-term direction of growth.",
};

export const readingDescription = (rawTitle: string): string | null => {
  const aspect = parseAspect(rawTitle);
  if (aspect !== null) return aspect.description;

  const title = displayReadingTitle(rawTitle).toLocaleLowerCase("en-GB");
  const topic = topicDescriptions[title];
  if (topic !== undefined) return topic;

  if (/\bascendant\b/u.test(title)) {
    return "The Ascendant describes the style you present to the world, your instinctive approach to new situations, and how other people may first experience you.";
  }
  if (/\bdescendant\b/u.test(title)) {
    return "The Descendant describes the qualities you tend to meet, seek or negotiate through close one-to-one relationships.";
  }
  if (/\bmidheaven\b/u.test(title)) {
    return "The Midheaven describes public direction, reputation, ambition and the kind of contribution you may feel drawn to make.";
  }
  if (/\bimum coeli\b/u.test(title) || /\bhome–public life axis\b/u.test(title)) {
    return "The Imum Coeli describes private foundations, roots, home life and the inner sense of belonging beneath your public identity.";
  }
  if (/\bvertex–antivertex axis\b/u.test(title)) {
    return "The Vertex–Antivertex axis is used to describe encounters or turning points that can feel unusually significant, especially through other people.";
  }
  if (/\blunar nodes\b/u.test(title)) {
    return "The lunar-node axis is used to contrast familiar patterns with directions of growth and development.";
  }
  if (/\blilith\b/u.test(title)) {
    return "Lilith interpretations explore themes of autonomy, exclusion, instinct, taboo and the parts of yourself that resist being domesticated or simplified.";
  }
  if (/\blunar phase\b/u.test(title)) {
    return "The lunar phase describes the relationship between the Sun and Moon at birth. Astrologers use it as a broad description of emotional rhythm, momentum and how experience is processed over time.";
  }
  if (/\bprenatal lunar eclipse\b/u.test(title)) {
    return "The prenatal lunar eclipse is the most recent lunar eclipse before birth. Astrologers use it as a background theme for emotional culmination, release and inherited patterns.";
  }
  if (/\bprenatal solar eclipse\b/u.test(title)) {
    return "The prenatal solar eclipse is the most recent solar eclipse before birth. Astrologers use it as a background theme for beginnings, direction and long-running life motifs.";
  }
  if (/\brulership(?: and| ) dignity\b/u.test(title)) {
    return "Rulership and dignity describe how comfortably or strongly planets are traditionally considered to operate in their signs and how that modifies their expression.";
  }
  if (/\bchart balance\b/u.test(title)) {
    return "Chart balance summarises how the chart is distributed across elements, modalities, polarities and other structural emphases.";
  }
  if (/\bdominant themes\b/u.test(title)) {
    return "Dominant themes pull together the strongest repeating patterns across the chart rather than treating each placement in isolation.";
  }
  if (/^house\s+\d+/u.test(title)) {
    return "A house describes an area of life where the signs and planets placed there are interpreted as becoming especially visible or active.";
  }
  if (/\bcompatibility\b/u.test(title)) {
    return "Compatibility compares this natal chart with the symbolic profile of another zodiac sign for the selected relationship domain.";
  }
  return null;
};
