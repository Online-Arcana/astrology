import { resolveRef } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import type { Aspect, PointId, Sign } from "../../types/astro.js";
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

const pointIngredient = (id: PointId): SemanticIngredient => {
  const semantic = pointSemantic(id);
  return {
    kind: semantic.kind,
    atomId: semantic.atomId,
    technicalId: id,
    metadata: semantic.metadata,
  };
};

const signIngredient = (sign: Sign): SemanticIngredient => ({
  kind: "sign",
  atomId: `sign.${sign}`,
  technicalId: sign,
  metadata: {},
});

const aspectIngredient = (kind: Aspect["kind"]): SemanticIngredient => ({
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

const aspectFrom = (value: unknown): Aspect | null => {
  if (!record(value)) return null;
  return pointId(value["a"]) && pointId(value["b"]) && typeof value["kind"] === "string"
    ? value as unknown as Aspect
    : null;
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
  return typeof raw === "string" && [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
  ].includes(raw) ? raw as Sign : null;
};

const ingredientsFor = (
  unit: InterpretationUnit,
  resolvedEvidence: readonly unknown[],
): SemanticIngredient[] => {
  const unitFamily = family(unit);
  if (unitFamily === "point" || unitFamily === "big-three") {
    const id = pointFromSection(unit);
    if (id === null) throw new Error(`Unable to resolve point identity for ${unit.id}`);
    return [pointIngredient(id)];
  }
  if (unitFamily === "house") {
    const house = Number(unit.section.slice("houses.".length));
    if (!Number.isSafeInteger(house) || house < 1 || house > 12) throw new Error(`Invalid house unit ${unit.id}`);
    return [{ kind: "house", atomId: `house.${house}`, technicalId: String(house), metadata: { house } }];
  }
  if (unitFamily === "aspect") {
    const aspect = resolvedEvidence.map(aspectFrom).find((value): value is Aspect => value !== null);
    if (aspect === undefined) throw new Error(`Unable to resolve aspect evidence for ${unit.id}`);
    return [pointIngredient(aspect.a), aspectIngredient(aspect.kind), pointIngredient(aspect.b)];
  }
  if (unitFamily === "pattern") {
    const evidence = resolvedEvidence.find(record);
    const kind = evidence?.["kind"];
    if (typeof kind !== "string") throw new Error(`Unable to resolve pattern kind for ${unit.id}`);
    return [{ kind: "pattern", atomId: `pattern.${kind.replaceAll("_", "-")}`, technicalId: kind, metadata: {} }];
  }
  if (unitFamily === "lunar-phase") return [{ kind: "derived", atomId: "derived.lunar-phase", technicalId: "lunar.phase", metadata: {} }];
  if (unitFamily === "lunar-nodes") return [
    pointIngredient("north_node_true"), pointIngredient("north_node_mean"),
    pointIngredient("south_node_true"), pointIngredient("south_node_mean"),
  ];
  if (unitFamily === "lilith") return [pointIngredient("lilith_true"), pointIngredient("lilith_mean")];
  if (unitFamily === "eclipse") return [{
    kind: "derived",
    atomId: `derived.${unit.section.replaceAll(".", "-").replaceAll(/[A-Z]/gu, (value) => `-${value.toLocaleLowerCase("en-GB")}`)}`,
    technicalId: unit.section,
    metadata: {},
  }];
  if (unitFamily === "rulership-dignity") return [{ kind: "derived", atomId: "derived.rulership-dignity", technicalId: unit.section, metadata: {} }];
  if (unitFamily === "chart-balance") return [{ kind: "derived", atomId: "derived.chart-balance", technicalId: unit.section, metadata: {} }];
  if (unitFamily === "dominant-themes") return [{ kind: "derived", atomId: "derived.dominant-themes", technicalId: unit.section, metadata: {} }];
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
    ingredients: ingredientsFor(unit, evidence),
    evidenceRefs: [...unit.allowedSourceRefs],
    evidence,
  };
};
