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
const systemRef = (path = ""): JsonRef =>
  ref(`astral-calculation/system${path.length > 0 ? `/${path}` : ""}`);
const compatibilityRef = (domain?: CompatibilityDomain, sign?: Sign): JsonRef => ref(
  `astral-calculation/compatibility${domain ? `/domains/${domain}` : ""}${sign ? `/signs/${sign}` : ""}`,
);

const unit = (
  id: string,
  zodiac: Zodiac,
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

const systemUnits = (calculation: ZodiacCalculation): InterpretationUnit[] => {
  const zodiac = calculation.zodiac;
  const units: InterpretationUnit[] = [];
  const prefix = `${zodiac}.`;
  units.push(unit(`${prefix}overview`, zodiac, "overview", null, [systemRef()]));

  for (const point of ["sun", "moon", "ascendant"] as const) {
    units.push(unit(
      `${prefix}big-three.${point}`,
      zodiac,
      `bigThree.${point}`,
      null,
      [systemRef(`points/${point}`)],
    ));
  }

  for (const point of pointIds) {
    units.push(unit(
      `${prefix}point.${point}`,
      zodiac,
      `points.${point}`,
      null,
      [systemRef(`points/${point}`)],
    ));
  }

  for (let house = 1; house <= 12; house += 1) {
    units.push(unit(
      `${prefix}house.${house}`,
      zodiac,
      `houses.${house}`,
      null,
      [systemRef(`houses/placidus/houses/${house}`)],
    ));
  }

  calculation.aspects.forEach((aspect, index) => {
    units.push(unit(
      `${prefix}aspect.${aspect.id}`,
      zodiac,
      `aspects.${aspect.id}`,
      null,
      [systemRef(`aspects/${index}`)],
    ));
  });

  calculation.patterns.forEach((pattern, index) => {
    units.push(unit(
      `${prefix}pattern.${pattern.id}`,
      zodiac,
      `patterns.${pattern.id}`,
      null,
      [systemRef(`patterns/${index}`)],
    ));
  });

  units.push(
    unit(`${prefix}lunar.phase`, zodiac, "lunar.phase", null, [systemRef("lunarPhase")]),
    unit(`${prefix}lunar.nodes`, zodiac, "lunar.nodes", null, [
      systemRef("points/north_node_true"),
      systemRef("points/south_node_true"),
      systemRef("points/north_node_mean"),
      systemRef("points/south_node_mean"),
    ]),
    unit(`${prefix}lunar.lilith`, zodiac, "lunar.lilith", null, [
      systemRef("points/lilith_mean"),
      systemRef("points/lilith_true"),
    ]),
    unit(`${prefix}eclipse.at-birth`, zodiac, "eclipses.atBirth", null, [systemRef("eclipses/atBirth")]),
    unit(`${prefix}eclipse.prenatal-solar`, zodiac, "eclipses.prenatalSolar", null, [systemRef("eclipses/prenatalSolar")]),
    unit(`${prefix}eclipse.prenatal-lunar`, zodiac, "eclipses.prenatalLunar", null, [systemRef("eclipses/prenatalLunar")]),
    unit(`${prefix}rulership-dignity`, zodiac, "rulershipAndDignity", null, [
      systemRef("points"),
      systemRef("derived/dispositors"),
      systemRef("derived/mutualReceptions"),
    ]),
    unit(`${prefix}chart-balance`, zodiac, "chartBalance", null, [systemRef("derived/balances")]),
    unit(`${prefix}dominant-themes`, zodiac, "dominantThemes", null, [
      systemRef("derived/dominantPlanets"),
      systemRef("derived/dominantSigns"),
      systemRef("derived/jonesPattern"),
    ]),
  );

  for (const section of lifeSections) {
    units.push(unit(
      `${prefix}life.${section}`,
      zodiac,
      `life.${section}`,
      null,
      [systemRef("points"), systemRef("houses"), systemRef("aspects")],
    ));
  }

  units.push(unit(`${prefix}synthesis`, zodiac, "synthesis", null, [systemRef()]));
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
      [compatibilityRef(domain)],
    ));
    for (const sign of signs) {
      units.push(unit(
        `${zodiac}.compatibility.${domain}.${sign}`,
        zodiac,
        "compatibility.sign",
        domain,
        [compatibilityRef(domain, sign)],
      ));
    }
  }
  return units;
};

export const buildInterpretationPlan = (
  calculation: ZodiacCalculation,
): InterpretationPlan => ({
  schema: "astral-interpretation-plan/1.1.0",
  zodiac: calculation.zodiac,
  units: [
    ...systemUnits(calculation),
    ...compatibilityUnits(calculation.zodiac),
    unit("final-synthesis", calculation.zodiac, "finalSynthesis", null, [
      systemRef("derived"),
      compatibilityRef(),
    ]),
  ],
});
