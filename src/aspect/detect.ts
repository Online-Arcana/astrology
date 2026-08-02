import type { Aspect, PointId } from "../types/astro.js";
import { angularDistance } from "../zodiac/position.js";
import { allowedOrb, aspectProfile, aspectRules } from "./catalogue.js";

export interface AspectPoint {
  id: PointId;
  longitudeDegrees: number;
  speedDegreesPerDay: number | null;
}

const phase = (a: AspectPoint, b: AspectPoint, exact: number, orb: number): Aspect["phase"] => {
  if (orb < 1e-7) return "exact";
  if (a.speedDegreesPerDay === null || b.speedDegreesPerDay === null) return "unknown";
  const now = angularDistance(a.longitudeDegrees, b.longitudeDegrees);
  const later = angularDistance(
    a.longitudeDegrees + a.speedDegreesPerDay / 1440,
    b.longitudeDegrees + b.speedDegreesPerDay / 1440,
  );
  return Math.abs(later - exact) < Math.abs(now - exact) ? "applying" : "separating";
};

export const detectAspect = (a: AspectPoint, b: AspectPoint): Aspect | null => {
  if (a.id === b.id) throw new Error("An aspect requires two different points");
  const actual = angularDistance(a.longitudeDegrees, b.longitudeDegrees);
  const candidates = aspectRules
    .map((rule) => ({ rule, orb: Math.abs(actual - rule.angle), allowed: allowedOrb(rule, a.id, b.id) }))
    .filter(({ orb, allowed }) => orb <= allowed)
    .sort((left, right) => left.orb / left.allowed - right.orb / right.allowed);
  const match = candidates[0];
  if (!match) return null;
  const id = [a.id, b.id].sort().join("_") + `_${match.rule.kind}`;
  return {
    id,
    a: a.id,
    b: b.id,
    kind: match.rule.kind,
    exactAngleDegrees: match.rule.angle,
    actualAngleDegrees: actual,
    orbDegrees: match.orb,
    allowedOrbDegrees: match.allowed,
    phase: phase(a, b, match.rule.angle, match.orb),
    class: match.rule.class,
    character: match.rule.character,
    strength: Math.max(0, 1 - match.orb / match.allowed),
    ruleRefs: [`${aspectProfile}#${match.rule.kind}`],
  };
};

export const detectAspects = (points: readonly AspectPoint[]): Aspect[] => {
  const result: Aspect[] = [];
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const aspect = detectAspect(points[a] as AspectPoint, points[b] as AspectPoint);
      if (aspect) result.push(aspect);
    }
  }
  return result.sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id));
};
