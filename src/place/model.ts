import type { PlaceData } from "../types/base.js";

export interface CscCountry {
  id: number;
  name: string;
  iso2: string;
  region: string;
  subregion: string;
}

export interface CscCountryMeta extends CscCountry {
  timezones: readonly { zoneName: string }[];
}

export interface CscRegion {
  id: number;
  name: string;
  country_code: string;
  iso2: string;
  timezone: string | null;
}

export interface CscCity {
  id: number;
  name: string;
  state_id: number;
  state_code: string;
  country_code: string;
  latitude: string;
  longitude: string;
  timezone: string | null;
}

export interface CscApi {
  getCountries(): Promise<CscCountry[]>;
  getCountryByCode(code: string): Promise<CscCountryMeta | null>;
  getStatesOfCountry(countryCode: string): Promise<CscRegion[]>;
  getStateByCode(countryCode: string, regionCode: string): Promise<CscRegion | null>;
  getCitiesOfState(countryCode: string, regionCode: string): Promise<CscCity[]>;
  getAllCitiesOfCountry(countryCode: string): Promise<CscCity[]>;
}

export interface CountryChoice {
  code: string;
  name: string;
  continent: string;
  subcontinent: string | null;
}

export interface RegionChoice {
  code: string;
  name: string;
}

export interface CityChoice {
  id: string;
  name: string;
  region: RegionChoice | null;
  latitude: number;
  longitude: number;
  timeZone: string;
}

export interface PlaceCatalogue {
  continents(): Promise<string[]>;
  countries(continent?: string): Promise<CountryChoice[]>;
  regions(countryCode: string): Promise<RegionChoice[]>;
  cities(countryCode: string, regionCode: string | null, query: string): Promise<CityChoice[]>;
  get(placeId: string): Promise<PlaceData>;
}
