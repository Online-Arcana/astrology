import { resolveRef } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import type { Aspect, AstrologicalPoint, PointId, Sign } from "../../types/astro.js";
import type { AstralCalculation, InterpretationUnit } from "../../types/file.js";

export type SemanticEntityKind =
  | "body"
  | "point"
  | "angle"
  | "house"
  | "sign"
  | "aspect"
  | "pattern"
  | "derived"
  | "life-domain"
  | "compatibility-domain"
  | "synthesis";

export interface SemanticIngredient {
  kind: SemanticEntityKind;
  atomId: string;
  technicalId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export type InterpretationUnitFamily =
  | "overview"
  | "big-three"
  | "point"
  | "house"
  | "aspect"
  | "pattern"
  | "lunar-phase"
  | "lunar-nodes"
  | "lilith"
  | "eclipse"
  | "rulership-dignity"
  | "chart-balance"
  | "dominant-themes"
  | "life-domain"
  | "compatibility-overview"
  | "compatibility-sign"
  | "system-synthesis"
  | "final-synthesis";

export interface DecomposedInterpretationUnit {
  unitId: string;
  family: InterpretationUnitFamily;
  zodiac: AstralCalculation["system"]["zodiac"];
  /** System basis is retained for provenance but is not a semantic ingredient. */
  chartMetadata: {
    zodiac: AstralCalculation["system"]["zodiac"];
    ayanamsha: AstralCalculation["system"]["ayanamsha"];
  };
  ingredients: SemanticIngredient[];
  evidenceRefs: JsonRef[];
  evidence: unknown[];
}

const pointSemantic = (id: PointId): { atomId: string; kind: SemanticEntityKind; metadata: SemanticIngredient["metadata"] } => {
  switch (id) {
    case "north_node_mean": return { atomId: "point.north-node", kind: "point", metadata: { calculationVariant: "mean", nodeDirection: "north" } };
    case "north_node_true": return { atomId: "point.north-node", kind: "point", metadata: { calculationVariant: "true", nodeDirection: "north" } };
    case "south_node_mean": return { atomId: "point.south-node", kind: "point", metadata: { calculationVariant: "mean", nodeDirection: "south" } };
    case "south_node_true": return { atomId: "point.south-node", kind: "point", metadata: { calculationVariant: "true", nodeDirection: "south" } };
    case "lilith_mean": return { atomId: "point.black-moon-lilith", kind: "point", metadata: { calculationVariant: "mean" } };
    case "lilith_true": return { atomId: "point.black-moon-lilith", kind: "point", metadata: { calculationVariant: "true" } };
    case "part_of_fortune": return { atomId: "point.part-of-fortune", kind: "point", metadata: {} };
    case "part_of_spirit": return { atomId: "point.part-of-spirit", kind: "point", metadata: { technicalProperName: true } };
    case "ascendant": return { atomId: "angle.ascendant", kind: "angle", metadata: {} };
    case "descendant": return { atomId: "angle.descendant", kind: "angle", metadata: {} };
    case "midheaven": return { atomId: "angle.midheaven", kind: "angle", metadata: {} };
    case "imum_coeli": return { atomId: "angle.imum-coeli", kind: "angle", metadata: {} };
    case "vertex": return { atomId: "angle.vertex", kind: "angle", metadata: {} };
    case "antivertex": return { atomId: "angle.antivertex", kind: "angle", metadata: {} };
    case "east_point": return { atomId: "angle.east-point", kind: "angle", metadata: {} };
    default: return { atomId: `body.${id}`, kind: "body", metadata: {} };
  }
};

export const pointIngredient = (id: PointId): SemanticIngredient => {
  const semantic = pointSemantic(id);
  return {
    kind: semantic.kind,
    atomId: semantic.atomId,
    technicalId: id,
    metadata: semantic.metadata,
  };
};

export const signIngredient = (sign: Sign): SemanticIngredient => ({
  kind: "sign",
  atomId: `sign.${sign}`,
  technicalId: sign,
  metadata: {},
});

export const houseIngredient = (
  house: number,
  metadata: SemanticIngredient["metadata"] = {},
): SemanticIngredient => ({
  kind: "house",
  atomId: `house.${house}`,
  technicalId: String(house),
  metadata: { house, ...metadata },
});

export const aspectIngredient = (kind: Aspect["kind"]): SemanticIngredient => ({
  kind: "aspect",
  atomId: `aspect.${kind.replaceAll("_", "-")}`,
  technicalId: kind,
  metadata: {},
});

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pointId = (value: unknown): value is PointId => typeof value === "string" && [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "north_node_true", "south_node_true", "north_node_mean", "south_node_mean",
  "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
  "part_of_fortune", "part_of_spirit", "lilith_mean", "lilith_true",
].includes(value as PointId);

const signId = (value: unknown): value is Sign => typeof value === "string" && [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
].includes(value as Sign);

const aspectFrom = (value: unknown): Aspect | null => {
  if (!record(value)) return null;
  return pointId(value["a"]) && pointId(value["b"]) && typeof value["kind"] === "string"
    ? value as unknown as Aspect
    : null;
};

const uniqueIngredients = (ingredients: readonly SemanticIngredient[]): SemanticIngredient[] => {
  const seen = new Set<string>();
  const output: SemanticIngredient[] = [];
  for (const ingredient of ingredients) {
    if (seen.has(ingredient.atomId)) continue;
    seen.add(ingredient.atomId);
    output.push(ingredient);
  }
  return output;
};

export const pointPlacementIngredients = (
  calculation: AstralCalculation,
  id: PointId,
): SemanticIngredient[] => {
  const point = calculation.system.points[id] as AstrologicalPoint | undefined;
  const ingredients: SemanticIngredient[] = [pointIngredient(id)];
  const sign = point?.position?.value?.sign;
  if (sign !== undefined) ingredients.push(signIngredient(sign));
  const house = point?.houses?.placidus?.value?.house;
  if (house !== undefined) ingredients.push(houseIngredient(house, { placementFor: id }));
  return uniqueIngredients(ingredients);
};

const family = (unit: InterpretationUnit): InterpretationUnitFamily => {
  if (unit.id === "final-synthesis") return "final-synthesis";
  if (unit.section === "overview") return "overview";
  if (unit.section.startsWith("bigThree.")) return "big-three";
  if (unit.section.startsWith("points.")) return "point";
  if (unit.section.startsWith("houses.")) return "house";
  if (unit.section.startsWith("aspects.")) return "aspect";
  if (unit.section.startsWith("patterns.")) return "pattern";
  if (unit.section === "lunar.phase") return "lunar-phase";
  if (unit.section === "lunar.nodes") return "lunar-nodes";
  if (unit.section === "lunar.lilith") return "lilith";
  if (unit.section.startsWith("eclipses.")) return "eclipse";
  if (unit.section === "rulershipAndDignity") return "rulership-dignity";
  if (unit.section === "chartBalance") return "chart-balance";
  if (unit.section === "dominantThemes") return "dominant-themes";
  if (unit.section.startsWith("life.")) return "life-domain";
  if (unit.section === "compatibility.overview") return "compatibility-overview";
  if (unit.section === "compatibility.sign") return "compatibility-sign";
  if (unit.section === "synthesis") return "system-synthesis";
  throw new Error(`Unsupported interpretation unit family for ${unit.id}`);
};

const pointFromSection = (unit: InterpretationUnit): PointId | null => {
  const raw = unit.section.startsWith("points.")
    ? unit.section.slice("points.".length)
    : unit.section.startsWith("bigThree.")
      ? unit.section.slice("bigThree.".length)
      : null;
  return pointId(raw) ? raw : null;
};

const signFromCompatibilityId = (unit: InterpretationUnit): Sign | null => {
  if (unit.section !== "compatibility.sign") return null;
  const raw = unit.id.split(".").at(-1);
  return signId(raw) ? raw : null;
};

const houseIngredients = (
  calculation: AstralCalculation,
  houseNumber: number,
): SemanticIngredient[] => {
  const placidus = calculation.system.houses?.placidus;
  const house = placidus?.houses?.[String(houseNumber) as keyof typeof placidus.houses];
  const ingredients: SemanticIngredient[] = [houseIngredient(houseNumber)];
  const cuspSign = house?.cusp?.value?.sign;
  if (cuspSign !== undefined) ingredients.push(signIngredient(cuspSign));
  const traditionalRuler = house?.rulerTraditional?.value;
  if (traditionalRuler !== null && traditionalRuler !== undefined) ingredients.push(pointIngredient(traditionalRuler));
  const modernRuler = house?.rulerModern?.value;
  if (modernRuler !== null && modernRuler !== undefined) ingredients.push(pointIngredient(modernRuler));
  for (const occupant of house?.occupants ?? []) ingredients.push(pointIngredient(occupant));
  for (const intercepted of house?.interceptedSigns ?? []) ingredients.push(signIngredient(intercepted));
  return uniqueIngredients(ingredients);
};

const patternIngredients = (resolvedEvidence: readonly unknown[]): SemanticIngredient[] => {
  const evidence = resolvedEvidence.find(record);
  const kind = evidence?.["kind"];
  if (typeof kind !== "string") throw new Error("Unable to resolve pattern kind");
  const ingredients: SemanticIngredient[] = [{
    kind: "pattern",
    atomId: `pattern.${kind.replaceAll("_", "-")}`,
    technicalId: kind,
    metadata: {},
  }];
  const focal = evidence?.["focalPoint"];
  if (pointId(focal)) {
    const focalIngredient = pointIngredient(focal);
    ingredients.push({
      ...focalIngredient,
      metadata: { ...focalIngredient.metadata, patternRole: "focal" },
    });
  }
  const points = evidence?.["points"];
  if (Array.isArray(points)) {
    for (const value of points) if (pointId(value)) ingredients.push(pointIngredient(value));
  }
  return uniqueIngredients(ingredients);
};

const eclipseIngredients = (
  unit: InterpretationUnit,
  resolvedEvidence: readonly unknown[],
): SemanticIngredient[] => {
  const derived: SemanticIngredient = {
    kind: "derived",
    atomId: `derived.${unit.section.replaceAll(".", "-").replaceAll(/[A-Z]/gu, (value) => `-${value.toLocaleLowerCase("en-GB")}`)}`,
    technicalId: unit.section,
    metadata: {},
  };
  const ingredients: SemanticIngredient[] = [derived, pointIngredient("sun"), pointIngredient("moon")];
  const evidence = resolvedEvidence.find(record);
  const value = evidence?.["value"];
  const eclipse = record(value) ? value : evidence;
  if (record(eclipse)) {
    const nodeDirection = eclipse["node"];
    if (nodeDirection === "north") ingredients.push(pointIngredient("north_node_true"));
    if (nodeDirection === "south") ingredients.push(pointIngredient("south_node_true"));
    const position = eclipse["position"];
    if (record(position) && signId(position["sign"])) ingredients.push(signIngredient(position["sign"]));
  }
  return uniqueIngredients(ingredients);
};

const dominantIngredients = (
  calculation: AstralCalculation,
): SemanticIngredient[] => {
  const ingredients: SemanticIngredient[] = [{
    kind: "derived",
    atomId: "derived.dominant-themes",
    technicalId: "dominantThemes",
    metadata: {},
  }];
  for (const entry of calculation.system.derived?.dominantPlanets?.slice(0, 4) ?? []) {
    ingredients.push(pointIngredient(entry.planet));
  }
  for (const entry of calculation.system.derived?.dominantSigns?.slice(0, 4) ?? []) {
    ingredients.push(signIngredient(entry.sign));
  }
  return uniqueIngredients(ingredients);
};

const rulershipIngredients = (
  calculation: AstralCalculation,
): SemanticIngredient[] => {
  const ingredients: SemanticIngredient[] = [{
    kind: "derived",
    atomId: "derived.rulership-dignity",
    technicalId: "rulershipAndDignity",
    metadata: {},
  }];
  for (const id of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const) {
    ingredients.push(pointIngredient(id));
    const sign = calculation.system.points[id]?.position?.value?.sign;
    if (sign !== undefined) ingredients.push(signIngredient(sign));
  }
  return uniqueIngredients(ingredients);
};

const ingredientsFor = (
  calculation: AstralCalculation,
  unit: InterpretationUnit,
  resolvedEvidence: readonly unknown[],
): SemanticIngredient[] => {
  const unitFamily = family(unit);
  if (unitFamily === "point" || unitFamily === "big-three") {
    const id = pointFromSection(unit);
    if (id === null) throw new Error(`Unable to resolve point identity for ${unit.id}`);
    return pointPlacementIngredients(calculation, id);
  }
  if (unitFamily === "house") {
    const house = Number(unit.section.slice("houses.".length));
    if (!Number.isSafeInteger(house) || house < 1 || house > 12) throw new Error(`Invalid house unit ${unit.id}`);
    return houseIngredients(calculation, house);
  }
  if (unitFamily === "aspect") {
    const aspect = resolvedEvidence.map(aspectFrom).find((value): value is Aspect => value !== null);
    if (aspect === undefined) throw new Error(`Unable to resolve aspect evidence for ${unit.id}`);
    return uniqueIngredients([pointIngredient(aspect.a), aspectIngredient(aspect.kind), pointIngredient(aspect.b)]);
  }
  if (unitFamily === "pattern") return patternIngredients(resolvedEvidence);
  if (unitFamily === "lunar-phase") return [
    { kind: "derived", atomId: "derived.lunar-phase", technicalId: "lunar.phase", metadata: {} },
    pointIngredient("sun"),
    pointIngredient("moon"),
  ];
  if (unitFamily === "lunar-nodes") return [
    { ...pointIngredient("north_node_true"), metadata: { calculationVariants: "true,mean", nodeDirection: "north" } },
    { ...pointIngredient("south_node_true"), metadata: { calculationVariants: "true,mean", nodeDirection: "south" } },
  ];
  if (unitFamily === "lilith") return [{
    ...pointIngredient("lilith_true"),
    metadata: { calculationVariants: "true,mean" },
  }];
  if (unitFamily === "eclipse") return eclipseIngredients(unit, resolvedEvidence);
  if (unitFamily === "rulership-dignity") return rulershipIngredients(calculation);
  if (unitFamily === "chart-balance") return [{ kind: "derived", atomId: "derived.chart-balance", technicalId: unit.section, metadata: {} }];
  if (unitFamily === "dominant-themes") return dominantIngredients(calculation);
  if (unitFamily === "life-domain") {
    const domain = unit.section.slice("life.".length);
    return [{ kind: "life-domain", atomId: `life-domain.${domain}`, technicalId: domain, metadata: {} }];
  }
  if (unitFamily === "compatibility-overview" || unitFamily === "compatibility-sign") {
    const domain = unit.domain;
    if (domain === null) throw new Error(`Compatibility unit ${unit.id} has no domain`);
    const output: SemanticIngredient[] = [{
      kind: "compatibility-domain",
      atomId: `compatibility-domain.${domain.replaceAll("_", "-")}`,
      technicalId: domain,
      metadata: {},
    }];
    const sign = signFromCompatibilityId(unit);
    if (sign !== null) output.push(signIngredient(sign));
    return output;
  }
  if (unitFamily === "overview" || unitFamily === "system-synthesis" || unitFamily === "final-synthesis") {
    return [{ kind: "synthesis", atomId: `synthesis.${unitFamily}`, technicalId: unit.section, metadata: {} }];
  }
  return [];
};

export const decomposeInterpretationUnit = (
  calculation: AstralCalculation,
  unit: InterpretationUnit,
): DecomposedInterpretationUnit => {
  const root = { "astral-calculation": calculation };
  const evidence = unit.allowedSourceRefs.map((ref) => resolveRef(root, ref));
  return {
    unitId: unit.id,
    family: family(unit),
    zodiac: calculation.system.zodiac,
    chartMetadata: {
      zodiac: calculation.system.zodiac,
      ayanamsha: calculation.system.ayanamsha,
    },
    ingredients: ingredientsFor(calculation, unit, evidence),
    evidenceRefs: [...unit.allowedSourceRefs],
    evidence,
  };
};
