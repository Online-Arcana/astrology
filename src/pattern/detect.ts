import { isPlanet } from "../aspect/catalogue.js";
import { signElements } from "../dignity/catalogue.js";
import { signModalities } from "../derived/catalogue.js";
import type {
  Aspect,
  AspectKind,
  AspectPattern,
  PatternKind,
  PointId,
  SignPosition,
} from "../types/astro.js";

export const patternProfile = "western_patterns/1.0.0" as const;

export interface PatternPoint {
  id: PointId;
  position: SignPosition;
}

interface EdgeSet {
  aspects: Aspect[];
  byPair: Map<string, Aspect>;
}

const pairKey = (a: PointId, b: PointId): string => [a, b].sort().join("|");

const edgeSet = (aspects: readonly Aspect[]): EdgeSet => {
  const byPair = new Map<string, Aspect>();
  for (const aspect of aspects) byPair.set(pairKey(aspect.a, aspect.b), aspect);
  return { aspects: [...aspects], byPair };
};

const combinations = <T>(values: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  const visit = (start: number, chosen: T[]): void => {
    if (chosen.length === size) {
      result.push([...chosen]);
      return;
    }
    for (let index = start; index <= values.length - (size - chosen.length); index += 1) {
      chosen.push(values[index] as T);
      visit(index + 1, chosen);
      chosen.pop();
    }
  };
  visit(0, []);
  return result;
};

const edge = (edges: EdgeSet, a: PointId, b: PointId, kind?: AspectKind): Aspect | null => {
  const aspect = edges.byPair.get(pairKey(a, b)) ?? null;
  return aspect && (kind === undefined || aspect.kind === kind) ? aspect : null;
};

const allPairs = (points: readonly PatternPoint[]): [PatternPoint, PatternPoint][] => combinations(points, 2)
  .map(([a, b]) => [a as PatternPoint, b as PatternPoint]);

const matching = (points: readonly PatternPoint[], edges: EdgeSet, kind: AspectKind): Aspect[] =>
  allPairs(points).map(([a, b]) => edge(edges, a.id, b.id, kind)).filter((value): value is Aspect => value !== null);

const patternContext = (points: readonly PatternPoint[]): Pick<AspectPattern, "element" | "modality"> => {
  const elements = new Set(points.map(({ position }) => signElements[position.sign]));
  const modalities = new Set(points.map(({ position }) => signModalities[position.sign]));
  return {
    element: elements.size === 1 ? [...elements][0] as string : null,
    modality: modalities.size === 1 ? [...modalities][0] as string : null,
  };
};

const build = (
  kind: PatternKind,
  points: readonly PatternPoint[],
  aspects: readonly Aspect[],
  focalPoint: PointId | null,
): AspectPattern => {
  const ids = points.map(({ id }) => id).sort();
  const uniqueAspects = [...new Map(aspects.map((aspect) => [aspect.id, aspect])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    id: `${kind}:${ids.join("+")}`,
    kind,
    points: ids,
    aspects: uniqueAspects.map(({ id }) => id),
    ...patternContext(points),
    focalPoint,
    strength: uniqueAspects.length === 0
      ? 0
      : uniqueAspects.reduce((sum, aspect) => sum + aspect.strength, 0) / uniqueAspects.length,
    ruleRefs: [`${patternProfile}#${kind}`],
  };
};

const exactCounts = (
  points: readonly PatternPoint[],
  edges: EdgeSet,
  counts: Readonly<Partial<Record<AspectKind, number>>>,
): Aspect[] | null => {
  const aspects = allPairs(points)
    .map(([a, b]) => edge(edges, a.id, b.id))
    .filter((value): value is Aspect => value !== null);
  const total = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  if (aspects.length !== total) return null;
  for (const [kind, count] of Object.entries(counts) as [AspectKind, number][]) {
    if (aspects.filter((aspect) => aspect.kind === kind).length !== count) return null;
  }
  return aspects;
};

const stelliums = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => {
  const cliques: PatternPoint[][] = [];
  for (let size = 3; size <= points.length; size += 1) {
    for (const group of combinations(points, size)) {
      if (matching(group, edges, "conjunction").length === size * (size - 1) / 2) cliques.push(group);
    }
  }
  const maximal = cliques.filter((group) => !cliques.some((other) =>
    other.length > group.length && group.every(({ id }) => other.some((point) => point.id === id)),
  ));
  return maximal.map((group) => build("stellium", group, matching(group, edges, "conjunction"), null));
};

const tSquares = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => {
  const result: AspectPattern[] = [];
  for (const group of combinations(points, 3)) {
    for (const focal of group) {
      const bases = group.filter(({ id }) => id !== focal.id);
      const opposition = edge(edges, (bases[0] as PatternPoint).id, (bases[1] as PatternPoint).id, "opposition");
      const left = edge(edges, focal.id, (bases[0] as PatternPoint).id, "square");
      const right = edge(edges, focal.id, (bases[1] as PatternPoint).id, "square");
      if (opposition && left && right) result.push(build("t_square", group, [opposition, left, right], focal.id));
    }
  }
  return result;
};

const grandTrines = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => combinations(points, 3)
  .map((group) => {
    const aspects = matching(group, edges, "trine");
    return aspects.length === 3 ? build("grand_trine", group, aspects, null) : null;
  })
  .filter((value): value is AspectPattern => value !== null);

const grandCrosses = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => combinations(points, 4)
  .map((group) => {
    const aspects = exactCounts(group, edges, { opposition: 2, square: 4 });
    return aspects ? build("grand_cross", group, aspects, null) : null;
  })
  .filter((value): value is AspectPattern => value !== null);

const yods = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => {
  const result: AspectPattern[] = [];
  for (const group of combinations(points, 3)) {
    for (const focal of group) {
      const bases = group.filter(({ id }) => id !== focal.id);
      const base = edge(edges, (bases[0] as PatternPoint).id, (bases[1] as PatternPoint).id, "sextile");
      const left = edge(edges, focal.id, (bases[0] as PatternPoint).id, "quincunx");
      const right = edge(edges, focal.id, (bases[1] as PatternPoint).id, "quincunx");
      if (base && left && right) result.push(build("yod", group, [base, left, right], focal.id));
    }
  }
  return result;
};

const kites = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => {
  const result: AspectPattern[] = [];
  for (const group of combinations(points, 4)) {
    for (const focal of group) {
      const triangle = group.filter(({ id }) => id !== focal.id);
      const trines = matching(triangle, edges, "trine");
      if (trines.length !== 3) continue;
      const oppositionTarget = triangle.find(({ id }) => edge(edges, focal.id, id, "opposition") !== null);
      if (!oppositionTarget) continue;
      const others = triangle.filter(({ id }) => id !== oppositionTarget.id);
      const opposition = edge(edges, focal.id, oppositionTarget.id, "opposition");
      const sextiles = others.map(({ id }) => edge(edges, focal.id, id, "sextile"));
      if (opposition && sextiles.every((value): value is Aspect => value !== null)) {
        result.push(build("kite", group, [...trines, opposition, ...sextiles], focal.id));
      }
    }
  }
  return result;
};

const mysticRectangles = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => combinations(points, 4)
  .map((group) => {
    const aspects = exactCounts(group, edges, { opposition: 2, trine: 2, sextile: 2 });
    return aspects ? build("mystic_rectangle", group, aspects, null) : null;
  })
  .filter((value): value is AspectPattern => value !== null);

const grandSextiles = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => combinations(points, 6)
  .map((group) => {
    const aspects = exactCounts(group, edges, { sextile: 6, trine: 6, opposition: 3 });
    return aspects ? build("grand_sextile", group, aspects, null) : null;
  })
  .filter((value): value is AspectPattern => value !== null);

const thorHammers = (points: readonly PatternPoint[], edges: EdgeSet): AspectPattern[] => {
  const result: AspectPattern[] = [];
  for (const group of combinations(points, 3)) {
    for (const focal of group) {
      const bases = group.filter(({ id }) => id !== focal.id);
      const base = edge(edges, (bases[0] as PatternPoint).id, (bases[1] as PatternPoint).id, "square");
      const left = edge(edges, focal.id, (bases[0] as PatternPoint).id, "sesquiquadrate");
      const right = edge(edges, focal.id, (bases[1] as PatternPoint).id, "sesquiquadrate");
      if (base && left && right) result.push(build("thor_hammer", group, [base, left, right], focal.id));
    }
  }
  return result;
};

export const detectPatterns = (
  inputPoints: readonly PatternPoint[],
  aspects: readonly Aspect[],
): AspectPattern[] => {
  const points = inputPoints.filter(({ id }) => isPlanet(id));
  const edges = edgeSet(aspects.filter(({ a, b }) => isPlanet(a) && isPlanet(b)));
  const patterns = [
    ...stelliums(points, edges),
    ...tSquares(points, edges),
    ...grandTrines(points, edges),
    ...grandCrosses(points, edges),
    ...yods(points, edges),
    ...kites(points, edges),
    ...mysticRectangles(points, edges),
    ...grandSextiles(points, edges),
    ...thorHammers(points, edges),
  ];
  return [...new Map(patterns.map((pattern) => [pattern.id, pattern])).values()]
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
};
