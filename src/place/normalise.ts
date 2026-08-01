import type { PlaceData } from "../types/base.js";
import type { CscCity, CscCountryMeta, CscRegion } from "./model.js";

const code = (value: string): string => value.trim().toUpperCase();

const coordinate = (value: string, name: string, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} is outside its valid range`);
  }
  return parsed;
};

const zone = (city: CscCity, region: CscRegion | null, country: CscCountryMeta): string => {
  const candidates = [city.timezone, region?.timezone ?? null];
  if (country.timezones.length === 1) candidates.push(country.timezones[0]?.zoneName ?? null);
  const selected = candidates.find((value): value is string => typeof value === "string" && value.length > 0);
  if (!selected || !/^[A-Za-z_+.-]+(?:\/[A-Za-z0-9_+.-]+)+$/u.test(selected)) {
    throw new Error(`City ${city.id} has no usable IANA time zone`);
  }
  return selected;
};

export const placeId = (countryCode: string, regionCode: string | null, cityId: number): string =>
  `csc:${code(countryCode)}:${regionCode ? code(regionCode) : "-"}:${cityId}`;

export interface ParsedPlaceId {
  countryCode: string;
  regionCode: string | null;
  cityId: number;
}

export const parsePlaceId = (id: string): ParsedPlaceId => {
  const match = /^csc:([A-Z]{2}):([A-Z0-9-]+|-):(\d+)$/u.exec(id);
  if (!match) throw new Error("Invalid place ID");
  const cityId = Number(match[3]);
  if (!Number.isSafeInteger(cityId) || cityId < 1) throw new Error("Invalid city ID");
  return {
    countryCode: match[1] as string,
    regionCode: match[2] === "-" ? null : match[2] as string,
    cityId,
  };
};

export const normalisePlace = (
  country: CscCountryMeta,
  region: CscRegion | null,
  city: CscCity,
): PlaceData => {
  const countryCode = code(country.iso2);
  if (code(city.country_code) !== countryCode) throw new Error("City country does not match selected country");
  if (region) {
    if (code(region.country_code) !== countryCode) throw new Error("Region country does not match selected country");
    if (code(city.state_code) !== code(region.iso2)) throw new Error("City region does not match selected region");
  }
  return {
    id: placeId(countryCode, region?.iso2 ?? null, city.id),
    continent: country.region.trim() || "Unknown",
    subcontinent: country.subregion.trim() || null,
    country: { code: countryCode, name: country.name },
    region: region ? { code: code(region.iso2), name: region.name } : null,
    city: { name: city.name },
    latitude: coordinate(city.latitude, "Latitude", -90, 90),
    longitude: coordinate(city.longitude, "Longitude", -180, 180),
    elevationMetres: null,
    timeZone: zone(city, region, country),
  };
};
