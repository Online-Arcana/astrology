import type { JsonRef } from "../types/base.js";
import type {
  CompatibilityDomain,
  PointId,
  Sign,
  Zodiac,
  ZodiacCalculation,
} from "../types/astro.js";
import type { InterpretationPlan, InterpretationUnit } from "../types/file.js";
import { compatibilityDomains } from "../compat/catalogue.js";
import { signs } from "../zodiac/position.js";

const pointIds = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "north_node_true", "south_node_true", "north_node_mean", "south_node_mean",
  "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
  "part_of_fortune", "part_of_spirit", "lilith_mean", "lilith_true",
] as const satisfies readonly PointId[];

const lifeSections = [
  "identityAndPurpose",
  "emotionalNature",
  "mindAndCommunication",
  "romance",
  "sexuality",
  "committedPartnerships",
  "homeAndFamily",
  "childhoodPatterns",
  "creativityAndSelfExpression",
  "childrenAndNurturing",
  "friendship",
  "communityAndGroups",
  "workStyle",
  "careerAndVocation",
  "businessAndLeadership",
  "moneyAndMaterialSecurity",
  "publicLifeAndAmbition",
  "conflictAndAssertion",
  "growthAndOpportunity",
  "restrictionsAndResponsibility",
  "transformationAndCrisis",
  "spiritualityAndMeaning",
  "unconsciousPatterns",
  "wellbeingAndDailyRhythm",
  "developmentalDirection",
] as const;

const ref = (value: string): JsonRef => `#/${value}` as JsonRef;
const systemRef = (zodiac: Zodiac, path = ""): JsonRef =>
  ref(`astral-calculation/systems/${zodiac}${path.length > 0 ? `/${path}` : ""}`);
const compatibilityRef = (zodiac: Zodiac, domain: CompatibilityDomain, sign?: Sign): JsonRef =>
  systemRefPath(zodiac, domain, sign);
const systemRefPath = (zodiac: Zodiac, domain: CompatibilityDomain, sign?: Sign): JsonRef => ref(
  `astral-calculation/compatibility/${zodiac}/domains/${domain}${sign ? `/signs/${sign}` : ""}`,
);

const unit = (
  id: string,
  zodiac: Zodiac | null,
  section: string,
  domain: string | null,
  allowedSourceRefs: readonly JsonRef[],
): InterpretationUnit => ({
  id,
  zodiac,
  section,
  domain,
  allowedSourceRefs: [...allowedSourceRefs],
});

const systemUnits = (zodiac: Zodiac, calculation: ZodiacCalculation): InterpretationUnit[] => {
  const units: InterpretationUnit[] = [];
  const prefix = `${zodiac}.`;
  units.push(unit(`${prefix}overview`, zodiac, "overview", null, [systemRef(zodiac)]));

  for (const point of ["sun", "moon", "ascendant"] as const) {
    units.push(unit(
      `${prefix}big-three.${point}`,
      zodiac,
      `bigThree.${point}`,
      null,
      [systemRef(zodiac, `points/${point}`)],
    ));
  }

  for (const point of pointIds) {
    units.push(unit(
      `${prefix}point.${point}`,
      zodiac,
      `points.${point}`,
      null,
      [systemRef(zodiac, `points/${point}`)],
    ));
  }

  for (let house = 1; house <= 12; house += 1) {
    units.push(unit(
      `${prefix}house.${house}`,
      zodiac,
      `houses.${house}`,
      null,
      [systemRef(zodiac, `houses/placidus/houses/${house}`)],
    ));
  }

  calculation.aspects.forEach((aspect, index) => {
    units.push(unit(
      `${prefix}aspect.${aspect.id}`,
      zodiac,
      `aspects.${aspect.id}`,
      null,
      [systemRef(zodiac, `aspects/${index}`)],
    ));
  });

  calculation.patterns.forEach((pattern, index) => {
    units.push(unit(
      `${prefix}pattern.${pattern.id}`,
      zodiac,
      `patterns.${pattern.id}`,
      null,
      [systemRef(zodiac, `patterns/${index}`)],
    ));
  });

  units.push(
    unit(`${prefix}lunar.phase`, zodiac, "lunar.phase", null, [systemRef(zodiac, "lunarPhase")]),
    unit(`${prefix}lunar.nodes`, zodiac, "lunar.nodes", null, [
      systemRef(zodiac, "points/north_node_true"),
      systemRef(zodiac, "points/south_node_true"),
      systemRef(zodiac, "points/north_node_mean"),
      systemRef(zodiac, "points/south_node_mean"),
    ]),
    unit(`${prefix}lunar.lilith`, zodiac, "lunar.lilith", null, [
      systemRef(zodiac, "points/lilith_mean"),
      systemRef(zodiac, "points/lilith_true"),
    ]),
    unit(`${prefix}eclipse.at-birth`, zodiac, "eclipses.atBirth", null, [systemRef(zodiac, "eclipses/atBirth")]),
    unit(`${prefix}eclipse.prenatal-solar`, zodiac, "eclipses.prenatalSolar", null, [systemRef(zodiac, "eclipses/prenatalSolar")]),
    unit(`${prefix}eclipse.prenatal-lunar`, zodiac, "eclipses.prenatalLunar", null, [systemRef(zodiac, "eclipses/prenatalLunar")]),
    unit(`${prefix}rulership-dignity`, zodiac, "rulershipAndDignity", null, [
      systemRef(zodiac, "points"),
      systemRef(zodiac, "derived/dispositors"),
      systemRef(zodiac, "derived/mutualReceptions"),
    ]),
    unit(`${prefix}chart-balance`, zodiac, "chartBalance", null, [systemRef(zodiac, "derived/balances")]),
    unit(`${prefix}dominant-themes`, zodiac, "dominantThemes", null, [
      systemRef(zodiac, "derived/dominantPlanets"),
      systemRef(zodiac, "derived/dominantSigns"),
      systemRef(zodiac, "derived/jonesPattern"),
    ]),
  );

  for (const section of lifeSections) {
    units.push(unit(
      `${prefix}life.${section}`,
      zodiac,
      `life.${section}`,
      null,
      [systemRef(zodiac, "points"), systemRef(zodiac, "houses"), systemRef(zodiac, "aspects")],
    ));
  }

  units.push(unit(`${prefix}synthesis`, zodiac, "synthesis", null, [systemRef(zodiac)]));
  return units;
};

const compatibilityUnits = (zodiac: Zodiac): InterpretationUnit[] => {
  const units: InterpretationUnit[] = [];
  for (const domain of compatibilityDomains) {
    units.push(unit(
      `${zodiac}.compatibility.${domain}.overview`,
      zodiac,
      "compatibility.overview",
      domain,
      [compatibilityRef(zodiac, domain)],
    ));
    for (const sign of signs) {
      units.push(unit(
        `${zodiac}.compatibility.${domain}.${sign}`,
        zodiac,
        "compatibility.sign",
        domain,
        [compatibilityRef(zodiac, domain, sign)],
      ));
    }
  }
  return units;
};

export const buildInterpretationPlan = (
  tropical: ZodiacCalculation,
  sidereal: ZodiacCalculation,
): InterpretationPlan => ({
  schema: "astral-interpretation-plan/1.0.0",
  units: [
    ...systemUnits("tropical", tropical),
    ...systemUnits("sidereal", sidereal),
    ...compatibilityUnits("tropical"),
    ...compatibilityUnits("sidereal"),
    unit("cross-system", null, "crossSystem", null, [
      systemRef("tropical"),
      systemRef("sidereal"),
    ]),
    unit("final-synthesis", null, "finalSynthesis", null, [
      systemRef("tropical", "derived"),
      systemRef("sidereal", "derived"),
      ref("astral-calculation/compatibility/tropical"),
      ref("astral-calculation/compatibility/sidereal"),
    ]),
  ],
});
