import { normaliseDegrees } from "../zodiac/position.js";

const radians = Math.PI / 180;
const degrees = 180 / Math.PI;

export interface GeometrySample {
  apparentSiderealDegrees: number;
  trueObliquityRadians: number;
}

export interface CoreAngles {
  localSiderealDegrees: number;
  ascendant: number;
  descendant: number;
  midheaven: number;
  imumCoeli: number;
}

export const forwardArc = (from: number, to: number): number => normaliseDegrees(to - from);
export const signedArc = (value: number): number => {
  const normal = normaliseDegrees(value);
  return normal > 180 ? normal - 360 : normal;
};

export const eclipticEquatorial = (longitudeDegrees: number, obliquityRadians: number): { rightAscensionDegrees: number; declinationDegrees: number } => {
  const longitude = longitudeDegrees * radians;
  const rightAscension = Math.atan2(
    Math.sin(longitude) * Math.cos(obliquityRadians),
    Math.cos(longitude),
  );
  const declination = Math.asin(Math.sin(obliquityRadians) * Math.sin(longitude));
  return {
    rightAscensionDegrees: normaliseDegrees(rightAscension * degrees),
    declinationDegrees: declination * degrees,
  };
};

export const coreAngles = (
  geometry: GeometrySample,
  longitudeDegrees: number,
  latitudeDegrees: number,
): CoreAngles => {
  if (!Number.isFinite(longitudeDegrees) || longitudeDegrees < -180 || longitudeDegrees > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees");
  }
  if (!Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90) {
    throw new Error("Latitude must be between -90 and 90 degrees");
  }
  const sidereal = normaliseDegrees(geometry.apparentSiderealDegrees + longitudeDegrees);
  const theta = sidereal * radians;
  const latitude = latitudeDegrees * radians;
  const obliquity = geometry.trueObliquityRadians;
  const midheaven = normaliseDegrees(Math.atan2(
    Math.sin(theta),
    Math.cos(theta) * Math.cos(obliquity),
  ) * degrees);
  let ascendant = normaliseDegrees(Math.atan2(
    Math.cos(theta),
    -Math.sin(theta) * Math.cos(obliquity) - Math.tan(latitude) * Math.sin(obliquity),
  ) * degrees);
  if (forwardArc(midheaven, ascendant) > 180) ascendant = normaliseDegrees(ascendant + 180);
  return {
    localSiderealDegrees: sidereal,
    ascendant,
    descendant: normaliseDegrees(ascendant + 180),
    midheaven,
    imumCoeli: normaliseDegrees(midheaven + 180),
  };
};
