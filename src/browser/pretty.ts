import type { Section } from "../types/chart.js";
import type { AstrologicalPoint, Sign } from "../types/astro.js";
import type { AstralFile } from "../types/file.js";

export interface CustomerRow {
  label: string;
  value: string;
}

export interface CustomerGroup {
  title: string;
  rows: CustomerRow[];
}

const names: Readonly<Record<string, string>> = {
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
  north_node_true: "True north node",
  south_node_true: "True south node",
  north_node_mean: "Mean north node",
  south_node_mean: "Mean south node",
  ascendant: "Ascendant",
  descendant: "Descendant",
  midheaven: "Midheaven",
  imum_coeli: "Imum coeli",
  vertex: "Vertex",
  antivertex: "Antivertex",
  east_point: "East point",
  part_of_fortune: "Part of fortune",
  part_of_spirit: "Part of spirit",
  lilith_mean: "Mean Lilith",
  lilith_true: "True Lilith",
  identityAndPurpose: "Identity and purpose",
  emotionalNature: "Emotional nature",
  mindAndCommunication: "Mind and communication",
  romance: "Romance",
  sexuality: "Intimacy and sexuality",
  committedPartnerships: "Committed partnerships",
  homeAndFamily: "Home and family",
  childhoodPatterns: "Childhood patterns",
  creativityAndSelfExpression: "Creativity and self-expression",
  childrenAndNurturing: "Children and nurturing",
  friendship: "Friendship",
  communityAndGroups: "Community and groups",
  workStyle: "Work style",
  careerAndVocation: "Career and vocation",
  businessAndLeadership: "Business and leadership",
  moneyAndMaterialSecurity: "Money and material security",
  publicLifeAndAmbition: "Public life and ambition",
  conflictAndAssertion: "Conflict and assertion",
  growthAndOpportunity: "Growth and opportunity",
  restrictionsAndResponsibility: "Restrictions and responsibility",
  transformationAndCrisis: "Transformation and crisis",
  spiritualityAndMeaning: "Spirituality and meaning",
  unconsciousPatterns: "Unconscious patterns",
  wellbeingAndDailyRhythm: "Wellbeing and daily rhythm",
  developmentalDirection: "Developmental direction",
};

const label = (value: string): string => {
  const known = names[value];
  if (known !== undefined) return known;
  const spaced = value
    .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  return spaced.length === 0
    ? "Value"
    : `${spaced[0]?.toLocaleUpperCase("en-GB")}${spaced.slice(1)}`;
};

const signName = (value: Sign): string => label(value);

const pointPosition = (point: AstrologicalPoint): string | null => {
  const position = point.position.value;
  if (position === null) return null;
  return `${signName(position.sign)} ${position.degree}° ${String(position.minute).padStart(2, "0")}′ ${String(position.second).padStart(2, "0")}″`;
};

const row = (name: string, value: string | null | undefined): CustomerRow[] =>
  value === null || value === undefined || value.trim().length === 0
    ? []
    : [{ label: name, value }];

const list = (name: string, values: readonly string[] | null | undefined): CustomerRow[] =>
  values === null || values === undefined || values.length === 0
    ? []
    : [{ label: name, value: values.join(" · ") }];

const sectionRows = (section: Section): CustomerRow[] => [
  ...row("Summary", section.summary),
  ...row("In detail", section.detail),
  ...list("Themes", section.themes),
  ...list("Strengths", section.strengths),
  ...list("Tensions", section.tensions),
];

const extraRows = (value: object): CustomerRow[] => Object.entries(value).flatMap(([key, raw]) => {
  if (["status", "title", "summary", "detail", "themes", "strengths", "tensions", "sourceRefs"].includes(key)) return [];
  if (typeof raw === "string") return row(label(key), raw);
  if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) return list(label(key), raw as string[]);
  return [];
});

const sectionGroup = (fallback: string, section: Section): CustomerGroup => ({
  title: section.title.trim() || fallback,
  rows: [...sectionRows(section), ...extraRows(section)],
});

const coreGroups = (file: AstralFile): CustomerGroup[] => {
  const calculation = file["astral-calculation"];
  const chart = file["astral-chart"];
  const points = calculation.system.points;
  const sun = points.sun.position.value?.sign;
  const moon = points.moon.position.value?.sign;
  const ascendant = points.ascendant.position.value?.sign;
  const identity: CustomerRow[] = [
    ...row("Chart name", chart.subject.name.value),
    ...row("Your solar sign", sun === undefined ? null : signName(sun)),
    ...row("Your lunar sign", moon === undefined ? null : signName(moon)),
    ...row("Your rising sign", ascendant === undefined ? null : signName(ascendant)),
    ...row("Zodiac system", label(chart.zodiac)),
  ];
  const positions = Object.entries(points).flatMap(([id, point]) => row(label(id), pointPosition(point)));
  return [
    { title: "Your chart", rows: identity },
    { title: "Your placements", rows: positions },
  ];
};

const interpretationGroups = (file: AstralFile): CustomerGroup[] => {
  const system = file["astral-chart"].system;
  const groups: CustomerGroup[] = [
    sectionGroup("Chart overview", system.overview),
    sectionGroup("Your Sun", system.bigThree.sun),
    sectionGroup("Your Moon", system.bigThree.moon),
    sectionGroup("Your Ascendant", system.bigThree.ascendant),
  ];
  for (const [key, section] of Object.entries(system.life)) groups.push(sectionGroup(label(key), section));
  for (const [key, section] of Object.entries(system.points)) groups.push(sectionGroup(label(key), section));
  for (const [key, section] of Object.entries(system.houses)) groups.push(sectionGroup(`House ${key}`, section));
  for (const aspect of system.aspects) groups.push(sectionGroup(label(aspect.id), aspect.section));
  for (const pattern of system.patterns) groups.push(sectionGroup(label(pattern.id), pattern.section));
  groups.push(
    sectionGroup("Lunar phase", system.lunar.phase),
    sectionGroup("Lunar nodes", system.lunar.nodes),
    sectionGroup("Lilith", system.lunar.lilith),
    sectionGroup("Eclipses at birth", system.eclipses.atBirth),
    sectionGroup("Prenatal solar eclipse", system.eclipses.prenatalSolar),
    sectionGroup("Prenatal lunar eclipse", system.eclipses.prenatalLunar),
    sectionGroup("Rulership and dignity", system.rulershipAndDignity),
    sectionGroup("Chart balance", system.chartBalance),
    sectionGroup("Dominant themes", system.dominantThemes),
  );
  return groups;
};

const compatibilityGroups = (file: AstralFile): CustomerGroup[] => {
  const result: CustomerGroup[] = [];
  for (const domain of Object.values(file["astral-chart"].compatibility.domains)) {
    result.push({ title: `${label(domain.domain)} compatibility`, rows: row("Overview", domain.overview) });
    for (const interpretation of Object.values(domain.signs)) {
      result.push({
        title: `${label(domain.domain)} compatibility with ${signName(interpretation.sign)}`,
        rows: [
          ...row("Summary", interpretation.summary),
          ...row("Dynamic", interpretation.dynamic),
          ...list("Strengths", interpretation.strengths),
          ...list("Tensions", interpretation.tensions),
          ...row("Attraction", interpretation.attraction),
          ...row("Sustainability", interpretation.sustainability),
          ...row("Best expression", interpretation.bestExpression),
        ],
      });
    }
  }
  return result;
};

const synthesisGroups = (file: AstralFile): CustomerGroup[] => {
  const system = file["astral-chart"].system.synthesis;
  const final = file["astral-chart"].finalSynthesis;
  return [
    {
      title: "How your chart fits together",
      rows: [
        ...list("Central themes", system.centralThemes),
        ...list("Contradictions and tensions", system.contradictions),
        ...list("Gifts", system.gifts),
        ...list("Growth edges", system.growthEdges),
        ...row("Narrative", system.narrative),
      ],
    },
    {
      title: "Final portrait",
      rows: [
        ...row("Essence", final.essence),
        ...list("Defining themes", final.definingThemes),
        ...list("Strongest assets", final.strongestAssets),
        ...list("Recurring tensions", final.recurringTensions),
        ...row("Relationships", final.relationshipPattern),
        ...row("Intimacy", final.sexualPattern),
        ...row("Friendships", final.friendshipPattern),
        ...row("Work and vocation", final.vocationalPattern),
        ...row("Money", final.moneyPattern),
        ...row("Developmental arc", final.developmentalArc),
        ...row("Closing portrait", final.closingPortrait),
      ],
    },
  ];
};

export const customerGroups = (file: AstralFile): CustomerGroup[] => [
  ...coreGroups(file),
  ...interpretationGroups(file),
  ...compatibilityGroups(file),
  ...synthesisGroups(file),
].filter(({ rows }) => rows.length > 0);
