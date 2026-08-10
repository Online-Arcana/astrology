import type { CompiledInterpretationCorpus } from "../corpus/compile.js";
import type { CorpusAtom } from "../corpus/types.js";
import type { PointId } from "../../types/astro.js";
import type { AstralCalculation, InterpretationUnit } from "../../types/file.js";
import {
  aspectIngredient,
  houseIngredient,
  pointIngredient,
  pointPlacementIngredients,
  signIngredient,
  type DecomposedInterpretationUnit,
  type SemanticIngredient,
} from "./decompose.js";

const stop = new Set([
  "a", "an", "and", "as", "at", "be", "by", "can", "for", "from", "in", "into", "is", "it", "of", "on",
  "or", "that", "the", "their", "this", "through", "to", "when", "with", "within", "without",
]);

const stem = (raw: string): string => {
  let word = raw.toLocaleLowerCase("en-GB");
  if (word.endsWith("ies") && word.length > 5) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ity") && word.length > 5) word = word.slice(0, -3);
  if (word.endsWith("ing") && word.length > 6) word = word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 5) word = word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) word = word.slice(0, -1);
  return word;
};

const words = (values: readonly string[]): Set<string> => new Set(
  values
    .flatMap((value) => value.toLocaleLowerCase("en-GB").split(/[^\p{L}\p{N}]+/gu))
    .map(stem)
    .filter((word) => word.length > 2 && !stop.has(word)),
);

const semanticWords = (
  corpus: CompiledInterpretationCorpus,
  atom: CorpusAtom,
): Set<string> => words([
  atom.plainEnglish,
  ...atom.claimIds.flatMap((claimId) => {
    const claim = corpus.claims[claimId];
    return claim === undefined ? [] : [...claim.tags, claim.proposition];
  }),
]);

const overlap = (left: ReadonlySet<string>, right: ReadonlySet<string>): number => {
  let score = 0;
  for (const value of left) if (right.has(value)) score += 1;
  return score;
};

const atom = (corpus: CompiledInterpretationCorpus, id: string): CorpusAtom | null => corpus.atoms[id] ?? null;

const uniqueIngredients = (values: readonly SemanticIngredient[]): SemanticIngredient[] => {
  const seen = new Set<string>();
  const output: SemanticIngredient[] = [];
  for (const value of values) {
    if (seen.has(value.atomId)) continue;
    seen.add(value.atomId);
    output.push(value);
  }
  return output;
};

const pointIds = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "north_node_true", "south_node_true", "ascendant", "descendant", "midheaven", "imum_coeli",
  "vertex", "antivertex", "east_point", "part_of_fortune", "part_of_spirit", "lilith_true",
] as const satisfies readonly PointId[];

interface ScoredPoint {
  id: PointId;
  score: number;
}

interface ScoredHouse {
  number: number;
  score: number;
}

const lifeDomainRecipe = (
  corpus: CompiledInterpretationCorpus,
  calculation: AstralCalculation,
  base: DecomposedInterpretationUnit,
): DecomposedInterpretationUnit => {
  const domainIngredient = base.ingredients[0];
  if (domainIngredient === undefined) return base;
  const domainAtom = atom(corpus, domainIngredient.atomId);
  if (domainAtom === null) return base;
  const domainWords = semanticWords(corpus, domainAtom);

  const points: ScoredPoint[] = pointIds
    .map((id) => {
      const semantic = pointIngredient(id);
      const pointAtom = atom(corpus, semantic.atomId);
      return { id, score: pointAtom === null ? 0 : overlap(domainWords, semanticWords(corpus, pointAtom)) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 8);

  const houses: ScoredHouse[] = Array.from({ length: 12 }, (_, index) => index + 1)
    .map((number) => {
      const houseAtom = atom(corpus, `house.${number}`);
      return { number, score: houseAtom === null ? 0 : overlap(domainWords, semanticWords(corpus, houseAtom)) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .slice(0, 5);

  const selected = new Set(points.map(({ id }) => id));
  const ingredients: SemanticIngredient[] = [domainIngredient];
  for (const { id, score } of points) {
    for (const ingredient of pointPlacementIngredients(calculation, id)) {
      ingredients.push({ ...ingredient, metadata: { ...ingredient.metadata, domainRelevance: score } });
    }
  }
  for (const { number, score } of houses) {
    ingredients.push(houseIngredient(number, { domainRelevance: score }));
  }

  const relevantAspects = calculation.system.aspects
    .filter(({ a, b }) => selected.has(a) || selected.has(b))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
    .slice(0, 10);
  for (const aspect of relevantAspects) {
    ingredients.push({
      ...aspectIngredient(aspect.kind),
      metadata: {
        a: aspect.a,
        b: aspect.b,
        strength: aspect.strength,
        phase: aspect.phase,
      },
    });
    if (selected.has(aspect.a)) ingredients.push(pointIngredient(aspect.a));
    if (selected.has(aspect.b)) ingredients.push(pointIngredient(aspect.b));
  }

  return { ...base, ingredients: uniqueIngredients(ingredients) };
};

const overviewRecipe = (
  calculation: AstralCalculation,
  base: DecomposedInterpretationUnit,
): DecomposedInterpretationUnit => {
  const ingredients: SemanticIngredient[] = [...base.ingredients];
  for (const entry of calculation.system.derived.dominantPlanets.slice(0, 4)) {
    ingredients.push(...pointPlacementIngredients(calculation, entry.planet));
  }
  for (const entry of calculation.system.derived.dominantSigns.slice(0, 4)) {
    ingredients.push(signIngredient(entry.sign));
  }
  for (const pattern of [...calculation.system.patterns]
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
    .slice(0, 3)) {
    ingredients.push({
      kind: "pattern",
      atomId: `pattern.${pattern.kind.replaceAll("_", "-")}`,
      technicalId: pattern.kind,
      metadata: { strength: pattern.strength },
    });
  }
  return { ...base, ingredients: uniqueIngredients(ingredients) };
};

/**
 * Apply chart-unit composition after technical IDs have been normalised.
 * Recipes use only compiled corpus semantics and deterministic chart facts.
 */
export const applyInterpretationRecipe = (
  corpus: CompiledInterpretationCorpus,
  calculation: AstralCalculation,
  _unit: InterpretationUnit,
  base: DecomposedInterpretationUnit,
): DecomposedInterpretationUnit => {
  if (base.family === "life-domain") return lifeDomainRecipe(corpus, calculation, base);
  if (base.family === "overview") return overviewRecipe(calculation, base);
  return base;
};
