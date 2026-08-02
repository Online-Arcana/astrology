import { modernCoRulers, traditionalRulers } from "../rules/rulership.js";
import type { Calc, CalcReason } from "../types/base.js";
import type { DignityState, PlanetId, SignPosition } from "../types/astro.js";
import {
  boundsProfile,
  chaldeanFaceSequence,
  dignityProfile,
  egyptianBounds,
  exaltationRulers,
  facesProfile,
  fallSigns,
  detrimentSigns,
  signElements,
  triplicityProfile,
  triplicityRules,
} from "./catalogue.js";

const classical = new Set<PlanetId>(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]);

const includes = (values: readonly string[] | undefined, value: string): boolean => values?.includes(value) ?? false;

export const boundRuler = (position: SignPosition): PlanetId => {
  const segment = egyptianBounds[position.sign].find(({ start, end }) =>
    position.degreeWithinSign >= start && position.degreeWithinSign < end,
  );
  if (!segment) throw new Error(`Egyptian bounds do not cover ${position.sign} ${position.degreeWithinSign}`);
  return segment.ruler;
};

export const faceRuler = (position: SignPosition): PlanetId => {
  const signIndex = Math.floor(position.longitudeDegrees / 30);
  const decanIndex = signIndex * 3 + Math.floor(position.degreeWithinSign / 10);
  return chaldeanFaceSequence[decanIndex % chaldeanFaceSequence.length] as PlanetId;
};

const state = (
  planet: PlanetId,
  position: SignPosition,
  sect: "day" | "night" | null,
): DignityState => {
  const traditionalRuler = traditionalRulers[position.sign];
  const modernRuler = modernCoRulers[position.sign] ?? null;
  const domicile = planet === traditionalRuler;
  const exalted = exaltationRulers[position.sign] === planet;
  const detriment = includes(detrimentSigns[planet], position.sign);
  const fallen = includes(fallSigns[planet], position.sign);
  const triplicity = triplicityRules[signElements[position.sign]];
  const primaryTriplicity = sect === null ? false : planet === triplicity[sect];
  const participatingTriplicity = planet === triplicity.participating;
  const triplicityRuler = primaryTriplicity || participatingTriplicity;
  const bound = boundRuler(position);
  const face = faceRuler(position);
  const boundRulerState = classical.has(planet) && planet === bound;
  const faceRulerState = classical.has(planet) && planet === face;
  const positive = domicile || exalted || triplicityRuler || boundRulerState || faceRulerState;
  const score =
    (domicile ? 5 : 0)
    + (exalted ? 4 : 0)
    + (primaryTriplicity ? 3 : 0)
    + (participatingTriplicity ? 1 : 0)
    + (boundRulerState ? 2 : 0)
    + (faceRulerState ? 1 : 0)
    - (detriment ? 5 : 0)
    - (fallen ? 4 : 0);
  const ruleRefs = [`${dignityProfile}#${position.sign}`];
  if (domicile) ruleRefs.push(`${dignityProfile}#domicile`);
  if (exalted) ruleRefs.push(`${dignityProfile}#exaltation`);
  if (detriment) ruleRefs.push(`${dignityProfile}#detriment`);
  if (fallen) ruleRefs.push(`${dignityProfile}#fall`);
  if (primaryTriplicity) ruleRefs.push(`${triplicityProfile}#${signElements[position.sign]}.${sect}`);
  if (participatingTriplicity) ruleRefs.push(`${triplicityProfile}#${signElements[position.sign]}.participating`);
  if (boundRulerState) ruleRefs.push(`${boundsProfile}#${position.sign}.${bound}`);
  if (faceRulerState) ruleRefs.push(`${facesProfile}#decan-${Math.floor(position.longitudeDegrees / 10) + 1}`);
  if (!positive) ruleRefs.push(`${dignityProfile}#peregrine`);
  return {
    traditionalRuler,
    modernRuler,
    domicile,
    exalted,
    detriment,
    fallen,
    triplicityRuler,
    boundRuler: boundRulerState,
    faceRuler: faceRulerState,
    peregrine: !positive,
    score,
    ruleRefs,
  };
};

const unavailable = (reason: CalcReason): Calc<DignityState> => ({
  status: reason === "outside_supported_range" ? "unsupported" : "unavailable",
  value: null,
  reason,
});

export const calculateDignity = (
  planet: PlanetId,
  position: Calc<SignPosition>,
  sect: Calc<"day" | "night">,
): Calc<DignityState> => {
  if (position.value === null) return unavailable(position.reason);
  if (sect.value === null) {
    return {
      status: "bounded",
      value: state(planet, position.value, null),
      reason: sect.reason === "none" ? "insufficient_data" : sect.reason,
    };
  }
  return {
    status: position.status === "exact" && sect.status === "exact" ? "exact" : "approximate",
    value: state(planet, position.value, sect.value),
    reason: position.reason !== "none" ? position.reason : sect.reason,
  };
};
