import type { Sign, SignPosition } from "../types/astro.js";

export const signs = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const satisfies readonly Sign[];

export const normaliseDegrees = (degrees: number): number => {
  if (!Number.isFinite(degrees)) throw new TypeError("Longitude must be finite");
  const value = degrees % 360;
  return value < 0 ? value + 360 : value;
};

export const angularDistance = (a: number, b: number): number => {
  const delta = Math.abs(normaliseDegrees(a) - normaliseDegrees(b));
  return delta > 180 ? 360 - delta : delta;
};

export const signPosition = (longitudeDegrees: number): SignPosition => {
  const longitude = normaliseDegrees(longitudeDegrees);
  const signIndex = Math.floor(longitude / 30);
  const degreeWithinSign = longitude - signIndex * 30;
  const degree = Math.floor(degreeWithinSign);
  const rawMinutes = (degreeWithinSign - degree) * 60;
  const minute = Math.floor(rawMinutes);
  let second = Math.round((rawMinutes - minute) * 60);
  let finalMinute = minute;
  let finalDegree = degree;
  if (second === 60) {
    second = 0;
    finalMinute += 1;
  }
  if (finalMinute === 60) {
    finalMinute = 0;
    finalDegree += 1;
  }
  return {
    longitudeDegrees: longitude,
    sign: signs[signIndex] as Sign,
    degree: finalDegree,
    minute: finalMinute,
    second,
    decan: (Math.floor(Math.min(degreeWithinSign, 29.999999999) / 10) + 1) as 1 | 2 | 3,
    degreeWithinSign,
  };
};

export const siderealPosition = (tropicalLongitude: number, ayanamshaDegrees: number): SignPosition =>
  signPosition(tropicalLongitude - ayanamshaDegrees);
