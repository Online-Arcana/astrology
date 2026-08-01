import type { DeclinationAspect, PointId } from "../types/astro.js";

export const declinationAspectProfile = "declination_aspects/1.0.0" as const;

export interface DeclinationPoint {
  id: PointId;
  declinationRadians: number;
}

const luminaries = new Set<PointId>(["sun", "moon"]);

export const declinationOrb = (a: PointId, b: PointId): number =>
  luminaries.has(a) || luminaries.has(b) ? 1.5 : 1;

export const detectDeclinationAspect = (
  a: DeclinationPoint,
  b: DeclinationPoint,
): DeclinationAspect | null => {
  if (a.id === b.id) throw new Error("A declination aspect requires two different points");
  const aDegrees = a.declinationRadians * 180 / Math.PI;
  const bDegrees = b.declinationRadians * 180 / Math.PI;
  if (!Number.isFinite(aDegrees) || !Number.isFinite(bDegrees)) throw new Error("Declination must be finite");
  const sameHemisphere = Math.sign(aDegrees) === Math.sign(bDegrees) || aDegrees === 0 || bDegrees === 0;
  const orbDegrees = sameHemisphere
    ? Math.abs(aDegrees - bDegrees)
    : Math.abs(Math.abs(aDegrees) - Math.abs(bDegrees));
  const allowedOrbDegrees = declinationOrb(a.id, b.id);
  if (orbDegrees > allowedOrbDegrees) return null;
  const kind = sameHemisphere ? "parallel" : "contra_parallel";
  return {
    id: [a.id, b.id].sort().join("_") + `_${kind}`,
    a: a.id,
    b: b.id,
    kind,
    orbDegrees,
    allowedOrbDegrees,
    strength: Math.max(0, 1 - orbDegrees / allowedOrbDegrees),
  };
};

export const detectDeclinationAspects = (points: readonly DeclinationPoint[]): DeclinationAspect[] => {
  const result: DeclinationAspect[] = [];
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const aspect = detectDeclinationAspect(points[a] as DeclinationPoint, points[b] as DeclinationPoint);
      if (aspect) result.push(aspect);
    }
  }
  return result.sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id));
};
