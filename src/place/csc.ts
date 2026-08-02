import type { PlaceData } from "../types/base.js";
import { loadVendor } from "../vendor/load.js";
import type { CityChoice, CountryChoice, CscApi, CscCity, CscCountryMeta, CscRegion, PlaceCatalogue, RegionChoice } from "./model.js";
import { normalisePlace, parsePlaceId, placeId } from "./normalise.js";

const fold = (value: string): string => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-GB");
const order = <T extends { name: string }>(items: T[]): T[] => items.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

const cityZone = (city: CscCity, region: CscRegion | null, country: CscCountryMeta): string => {
  if (city.timezone) return city.timezone;
  if (region?.timezone) return region.timezone;
  if (country.timezones.length === 1 && country.timezones[0]) return country.timezones[0].zoneName;
  return "";
};

export class CscCatalogue implements PlaceCatalogue {
  readonly #api: CscApi;

  constructor(api: CscApi) {
    this.#api = api;
  }

  async continents(): Promise<string[]> {
    return [...new Set((await this.#api.getCountries()).map((country) => country.region.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en-GB"));
  }

  async countries(continent?: string): Promise<CountryChoice[]> {
    const selected = continent ? fold(continent) : null;
    return order((await this.#api.getCountries())
      .filter((country) => selected === null || fold(country.region) === selected)
      .map((country) => ({
        code: country.iso2.toUpperCase(),
        name: country.name,
        continent: country.region,
        subcontinent: country.subregion || null,
      })));
  }

  async regions(countryCode: string): Promise<RegionChoice[]> {
    return order((await this.#api.getStatesOfCountry(countryCode.toUpperCase()))
      .map((region) => ({ code: region.iso2.toUpperCase(), name: region.name })));
  }

  async cities(countryCode: string, regionCode: string | null, query: string): Promise<CityChoice[]> {
    const cc = countryCode.toUpperCase();
    const country = await this.#api.getCountryByCode(cc);
    if (!country) throw new Error(`Unknown country ${cc}`);
    const region = regionCode ? await this.#api.getStateByCode(cc, regionCode.toUpperCase()) : null;
    if (regionCode && !region) throw new Error(`Unknown region ${cc}/${regionCode}`);
    const cities = region
      ? await this.#api.getCitiesOfState(cc, region.iso2)
      : await this.#api.getAllCitiesOfCountry(cc);
    const needle = fold(query.trim());
    return order(cities
      .filter((city) => needle.length === 0 || fold(city.name).includes(needle))
      .map((city) => ({
        id: placeId(cc, region?.iso2 ?? (city.state_code || null), city.id),
        name: city.name,
        region: region
          ? { code: region.iso2.toUpperCase(), name: region.name }
          : city.state_code
            ? { code: city.state_code.toUpperCase(), name: city.state_code.toUpperCase() }
            : null,
        latitude: Number(city.latitude),
        longitude: Number(city.longitude),
        timeZone: cityZone(city, region, country),
      })));
  }

  async get(id: string): Promise<PlaceData> {
    const parsed = parsePlaceId(id);
    const country = await this.#api.getCountryByCode(parsed.countryCode);
    if (!country) throw new Error(`Unknown country ${parsed.countryCode}`);
    const region = parsed.regionCode
      ? await this.#api.getStateByCode(parsed.countryCode, parsed.regionCode)
      : null;
    if (parsed.regionCode && !region) throw new Error(`Unknown region ${parsed.countryCode}/${parsed.regionCode}`);
    const cities = region
      ? await this.#api.getCitiesOfState(parsed.countryCode, parsed.regionCode as string)
      : await this.#api.getAllCitiesOfCountry(parsed.countryCode);
    const city = cities.find((candidate) => candidate.id === parsed.cityId);
    if (!city) throw new Error(`Unknown city ${parsed.cityId}`);
    return normalisePlace(country, region, city);
  }
}

interface CscModule extends CscApi {}

export const loadCscCatalogue = async (): Promise<CscCatalogue> => {
  const api = await loadVendor<CscModule>("@countrystatecity/countries");
  return new CscCatalogue(api);
};
