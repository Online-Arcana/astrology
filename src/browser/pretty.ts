import type { Section } from "../types/chart.js";
import type {
  Aspect,
  AstrologicalPoint,
  House,
  HouseSystem,
  Sign,
  SignPosition,
} from "../types/astro.js";
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
  long_term: "Long-term",
  conflict_resolution: "Conflict resolution",
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
const decimal = (value: number, digits = 2): string => value.toFixed(digits).replace(/\.00$/u, "");

const positionText = (position: SignPosition): string =>
  `${signName(position.sign)} ${position.degree}° ${String(position.minute).padStart(2, "0")}′ ${String(position.second).padStart(2, "0")}″`;

const dignityText = (point: AstrologicalPoint): string | null => {
  const value = point.dignity.value;
  if (value === null) return null;
  const states = [
    value.domicile ? "domicile" : null,
    value.exalted ? "exalted" : null,
    value.detriment ? "detriment" : null,
    value.fallen ? "fall" : null,
    value.triplicityRuler ? "triplicity ruler" : null,
    value.boundRuler ? "bound ruler" : null,
    value.faceRuler ? "face ruler" : null,
    value.peregrine ? "peregrine" : null,
  ].filter((item): item is string => item !== null);
  return states.length === 0 ? `dignity score ${value.score}` : `${states.join(", ")} · score ${value.score}`;
};

const pointText = (point: AstrologicalPoint, houses: HouseSystem): string | null => {
  const position = point.position.value;
  if (position === null) return null;
  const values = [positionText(position)];
  const house = point.houses[houses].value;
  if (house !== null) values.push(`House ${house.house}`);
  if (point.motion !== "not_applicable" && point.motion !== "unknown") values.push(label(point.motion));
  const dignity = dignityText(point);
  if (dignity !== null) values.push(dignity);
  return values.join(" · ");
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

const houseText = (house: House): string | null => {
  const cusp = house.cusp.value;
  if (cusp === null) return null;
  const values = [positionText(cusp)];
  if (house.occupants.length > 0) values.push(`Occupants: ${house.occupants.map(label).join(", ")}`);
  if (house.interceptedSigns.length > 0) values.push(`Intercepted: ${house.interceptedSigns.map(signName).join(", ")}`);
  const traditional = house.rulerTraditional.value;
  const modern = house.rulerModern.value;
  if (traditional !== null) values.push(`Ruler: ${label(traditional)}`);
  if (modern !== null && modern !== traditional) values.push(`Modern ruler: ${label(modern)}`);
  return values.join(" · ");
};

const aspectText = (aspect: Aspect): string =>
  `${label(aspect.a)} ${label(aspect.kind).toLocaleLowerCase("en-GB")} ${label(aspect.b)} · orb ${decimal(aspect.orbDegrees)}° · ${label(aspect.phase).toLocaleLowerCase("en-GB")} · strength ${decimal(aspect.strength)}`;

const deterministicGroups = (file: AstralFile): CustomerGroup[] => {
  const calculation = file["astral-calculation"];
  const system = calculation.system;
  const primaryHouses = calculation.settings.primaryHouseSystem;
  const points = system.points;
  const sun = points.sun.position.value?.sign;
  const moon = points.moon.position.value?.sign;
  const ascendant = points.ascendant.position.value?.sign;
  const place = calculation.place;
  const identity: CustomerRow[] = [
    ...row("Chart name", file["astral-chart"].subject.name.value),
    ...row("Your solar sign", sun === undefined ? null : signName(sun)),
    ...row("Your lunar sign", moon === undefined ? null : signName(moon)),
    ...row("Your rising sign", ascendant === undefined ? null : signName(ascendant)),
    ...row("Zodiac system", label(system.zodiac)),
    ...row("Ayanamsha", system.ayanamsha === null ? null : label(system.ayanamsha)),
    ...row("Birth date", calculation.birth.date),
    ...row("Birth time", calculation.birth.time === null ? "Unknown" : calculation.birth.time),
    ...row("Birth place", `${place.city.name}${place.region === null ? "" : `, ${place.region.name}`}, ${place.country.name}`),
  ];
  const positions = Object.entries(points).flatMap(([id, point]) => row(label(id), pointText(point, primaryHouses)));
  const houseChart = system.houses[primaryHouses];
  const houses = Object.values(houseChart.houses).flatMap((house) => row(`House ${house.number}`, houseText(house)));
  const lunar = system.lunarPhase;
  const lunarRows: CustomerRow[] = [
    ...row("Phase", lunar.phase.value === null ? null : label(lunar.phase.value)),
    ...row("Moon age", lunar.ageDays.value === null ? null : `${decimal(lunar.ageDays.value)} days`),
    ...row("Illumination", lunar.illumination.value === null ? null : `${decimal(lunar.illumination.value * 100)}%`),
    ...row("Cycle", lunar.waxing.value === null ? null : lunar.waxing.value ? "Waxing" : "Waning"),
  ];
  const derived = system.derived;
  const derivedRows: CustomerRow[] = [
    ...row("Sect", derived.sect.value === null ? null : label(derived.sect.value)),
    ...row("Traditional chart ruler", derived.chartRuler.traditional.value === null ? null : label(derived.chartRuler.traditional.value)),
    ...row("Modern chart ruler", derived.chartRuler.modern.value === null ? null : label(derived.chartRuler.modern.value)),
    ...list("Dominant planets", derived.dominantPlanets.map((item) => `${label(item.planet)} (${decimal(item.score)})`)),
    ...list("Dominant signs", derived.dominantSigns.map((item) => `${signName(item.sign)} (${decimal(item.score)})`)),
    ...list("Retrograde planets", derived.retrogradePlanets.map(label)),
    ...list("Unaspected planets", derived.unaspectedPlanets.map(label)),
    ...row("Jones pattern", derived.jonesPattern.value === null ? null : label(derived.jonesPattern.value)),
  ];
  const balanceRows: CustomerRow[] = [
    ...row("Elements", Object.entries(derived.balances.elements).map(([key, value]) => `${label(key)} ${value}`).join(" · ")),
    ...row("Modalities", Object.entries(derived.balances.modalities).map(([key, value]) => `${label(key)} ${value}`).join(" · ")),
    ...row("Polarities", Object.entries(derived.balances.polarities).map(([key, value]) => `${label(key)} ${value}`).join(" · ")),
    ...row("Hemispheres", Object.entries(derived.balances.hemispheres).map(([key, value]) => `${label(key)} ${value}`).join(" · ")),
    ...row("House modes", Object.entries(derived.balances.houseModes).map(([key, value]) => `${label(key)} ${value}`).join(" · ")),
  ];
  const majorAspects = system.aspects.filter(({ class: kind }) => kind === "major").map((aspect) => ({ label: label(aspect.id), value: aspectText(aspect) }));
  const minorAspects = system.aspects.filter(({ class: kind }) => kind === "minor").map((aspect) => ({ label: label(aspect.id), value: aspectText(aspect) }));
  const declinations = system.declinationAspects.map((aspect) => ({
    label: label(aspect.id),
    value: `${label(aspect.a)} ${label(aspect.kind).toLocaleLowerCase("en-GB")} ${label(aspect.b)} · orb ${decimal(aspect.orbDegrees)}° · strength ${decimal(aspect.strength)}`,
  }));
  const patterns = system.patterns.map((pattern) => ({
    label: label(pattern.kind),
    value: `${pattern.points.map(label).join(", ")} · strength ${decimal(pattern.strength)}${pattern.focalPoint === null ? "" : ` · focal point ${label(pattern.focalPoint)}`}`,
  }));
  const eclipseRows: CustomerRow[] = [];
  const natal = system.eclipses.atBirth.value;
  if (natal !== null) eclipseRows.push({
    label: "Eclipse at birth",
    value: `${label(natal.type)} ${natal.kind} eclipse · ${natal.exactUtcIso} · ${natal.node} node`,
  });
  const prenatalSolar = system.eclipses.prenatalSolar.value;
  if (prenatalSolar !== null) eclipseRows.push({
    label: "Prenatal solar eclipse",
    value: `${label(prenatalSolar.type)} · ${positionText(prenatalSolar.position)} · ${decimal(prenatalSolar.daysBeforeBirth)} days before birth`,
  });
  const prenatalLunar = system.eclipses.prenatalLunar.value;
  if (prenatalLunar !== null) eclipseRows.push({
    label: "Prenatal lunar eclipse",
    value: `${label(prenatalLunar.type)} · ${positionText(prenatalLunar.position)} · ${decimal(prenatalLunar.daysBeforeBirth)} days before birth`,
  });
  return [
    { title: "Your chart", rows: identity },
    { title: "Your placements", rows: positions },
    { title: `${label(primaryHouses)} houses`, rows: houses },
    { title: "Your lunar phase", rows: lunarRows },
    { title: "Rulers and dominant features", rows: derivedRows },
    { title: "Chart balance", rows: balanceRows },
    { title: "Major aspects", rows: majorAspects },
    { title: "Minor aspects", rows: minorAspects },
    { title: "Declination aspects", rows: declinations },
    { title: "Aspect patterns", rows: patterns },
    { title: "Eclipses", rows: eclipseRows },
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
  const calculated = file["astral-calculation"].compatibility.domains;
  for (const domain of Object.values(file["astral-chart"].compatibility.domains)) {
    result.push({ title: `${label(domain.domain)} compatibility`, rows: row("Overview", domain.overview) });
    for (const interpretation of Object.values(domain.signs)) {
      const score = calculated[domain.domain].signs[interpretation.sign];
      result.push({
        title: `${label(domain.domain)} compatibility with ${signName(interpretation.sign)}`,
        rows: [
          ...row("Score", `${decimal(score.score)} / 100 · rank ${score.rank} of 12 · ${label(score.level)} · ${label(score.relation)}`),
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
  ...deterministicGroups(file),
  ...interpretationGroups(file),
  ...compatibilityGroups(file),
  ...synthesisGroups(file),
].filter(({ rows }) => rows.length > 0);
