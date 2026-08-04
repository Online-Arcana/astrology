import { normalisePlace, parsePlaceId, placeId } from "../place/normalise.js";
import type {
  CityChoice,
  CountryChoice,
  CscCity,
  CscCountry,
  CscCountryMeta,
  CscRegion,
  PlaceCatalogue,
  RegionChoice,
} from "../place/model.js";
import type { PlaceData } from "../types/base.js";

interface PlaceManifest {
  schema: "astral-browser-places/1.0.0";
  countries: Record<string, string>;
  states: Record<string, Record<string, string>>;
}

export const browserStaticRoot = (moduleUrl: string): URL => {
  const current = new URL(moduleUrl);
  return current.pathname.includes("/chunks/")
    ? new URL("../", current)
    : new URL("./", current);
};

const base = new URL("places/", browserStaticRoot(import.meta.url));
const fold = (value: string): string => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-GB");
const order = <T extends { name: string }>(items: T[]): T[] => items.sort((left, right) => left.name.localeCompare(right.name, "en-GB"));

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(new URL(path, base), {
    cache: "force-cache",
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Static place data ${path} failed with HTTP ${response.status}`);
  return response.json() as Promise<T>;
};

const zone = (city: CscCity, region: CscRegion | null, country: CscCountryMeta): string => {
  const candidates = [city.timezone, region?.timezone ?? null];
  if (country.timezones.length === 1) candidates.push(country.timezones[0]?.zoneName ?? null);
  return candidates.find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
};

export class BrowserPlaceCatalogue implements PlaceCatalogue {
  readonly #manifest = json<PlaceManifest>("manifest.json");
  readonly #countries = json<CscCountry[]>("data/countries.json");
  readonly #countryMeta = new Map<string, Promise<CscCountryMeta>>();
  readonly #regions = new Map<string, Promise<CscRegion[]>>();
  readonly #cities = new Map<string, Promise<CscCity[]>>();

  async #countryDir(code: string): Promise<string> {
    const selected = code.toUpperCase();
    const directory = (await this.#manifest).countries[selected];
    if (directory === undefined) throw new Error(`Unknown country ${selected}`);
    return directory;
  }

  async #meta(code: string): Promise<CscCountryMeta> {
    const selected = code.toUpperCase();
    const cached = this.#countryMeta.get(selected);
    if (cached !== undefined) return cached;
    const loaded = this.#countryDir(selected).then((directory) => json<CscCountryMeta>(`data/${directory}/meta.json`));
    this.#countryMeta.set(selected, loaded);
    return loaded;
  }

  async #regionValues(code: string): Promise<CscRegion[]> {
    const selected = code.toUpperCase();
    const cached = this.#regions.get(selected);
    if (cached !== undefined) return cached;
    const loaded = this.#countryDir(selected).then((directory) => json<CscRegion[]>(`data/${directory}/states.json`));
    this.#regions.set(selected, loaded);
    return loaded;
  }

  async #cityValues(countryCode: string, regionCode: string): Promise<CscCity[]> {
    const country = countryCode.toUpperCase();
    const region = regionCode.toUpperCase();
    const key = `${country}:${region}`;
    const cached = this.#cities.get(key);
    if (cached !== undefined) return cached;
    const loaded = Promise.all([this.#manifest, this.#countryDir(country)]).then(([manifest, countryDirectory]) => {
      const regionDirectory = manifest.states[country]?.[region];
      if (regionDirectory === undefined) throw new Error(`Unknown region ${country}/${region}`);
      return json<CscCity[]>(`data/${countryDirectory}/${regionDirectory}/cities.json`);
    });
    this.#cities.set(key, loaded);
    return loaded;
  }

  async continents(): Promise<string[]> {
    return [...new Set((await this.#countries).map(({ region }) => region.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "en-GB"));
  }

  async countries(continent?: string): Promise<CountryChoice[]> {
    const selected = continent === undefined ? null : fold(continent);
    return order((await this.#countries)
      .filter((country) => selected === null || fold(country.region) === selected)
      .map((country) => ({
        code: country.iso2.toUpperCase(),
        name: country.name,
        continent: country.region,
        subcontinent: country.subregion || null,
      })));
  }

  async regions(countryCode: string): Promise<RegionChoice[]> {
    return order((await this.#regionValues(countryCode)).map((region) => ({
      code: region.iso2.toUpperCase(),
      name: region.name,
    })));
  }

  async cities(countryCode: string, regionCode: string | null, query: string): Promise<CityChoice[]> {
    const country = countryCode.toUpperCase();
    const [meta, regions] = await Promise.all([this.#meta(country), this.#regionValues(country)]);
    const selected = regionCode === null
      ? regions
      : regions.filter(({ iso2 }) => iso2.toUpperCase() === regionCode.toUpperCase());
    if (regionCode !== null && selected.length === 0) throw new Error(`Unknown region ${country}/${regionCode}`);
    const batches = await Promise.all(selected.map(async (region) => ({
      region,
      cities: await this.#cityValues(country, region.iso2),
    })));
    const needle = fold(query.trim());
    return order(batches.flatMap(({ region, cities }) => cities
      .filter((city) => needle.length === 0 || fold(city.name).includes(needle))
      .flatMap((city) => {
        const timeZone = zone(city, region, meta);
        if (timeZone.length === 0) return [];
        return [{
          id: placeId(country, region.iso2, city.id),
          name: city.name,
          region: { code: region.iso2.toUpperCase(), name: region.name },
          latitude: Number(city.latitude),
          longitude: Number(city.longitude),
          timeZone,
        }];
      })));
  }

  async get(id: string): Promise<PlaceData> {
    const parsed = parsePlaceId(id);
    const [country, regions] = await Promise.all([
      this.#meta(parsed.countryCode),
      this.#regionValues(parsed.countryCode),
    ]);
    const region = parsed.regionCode === null
      ? null
      : regions.find(({ iso2 }) => iso2.toUpperCase() === parsed.regionCode) ?? null;
    if (parsed.regionCode !== null && region === null) {
      throw new Error(`Unknown region ${parsed.countryCode}/${parsed.regionCode}`);
    }
    const candidates = region === null
      ? (await Promise.all(regions.map(({ iso2 }) => this.#cityValues(parsed.countryCode, iso2)))).flat()
      : await this.#cityValues(parsed.countryCode, region.iso2);
    const city = candidates.find(({ id: cityId }) => cityId === parsed.cityId);
    if (city === undefined) throw new Error(`Unknown city ${parsed.cityId}`);
    return normalisePlace(country, region, city);
  }
}

export const loadCscCatalogue = async (): Promise<BrowserPlaceCatalogue> => new BrowserPlaceCatalogue();
