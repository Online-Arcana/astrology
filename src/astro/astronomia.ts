import type { PlanetId } from "../types/astro.js";
import { loadVendor } from "../vendor/load.js";
import { vendorRevisions } from "../vendor/revisions.js";
import type { AstronomyPort, BodySample } from "./port.js";

interface CoordValue {
  lon: number;
  lat: number;
  range: number;
  ra: number;
  dec: number;
}

interface PlanetLike {
  position(jde: number): Pick<CoordValue, "lon" | "lat" | "range">;
}

interface BaseApi {
  lightTime(distanceAu: number): number;
  pmod(value: number, modulus: number): number;
  JDEToJulianYear(jde: number): number;
}

interface ApparentApi {
  eclipticAberration(lon: number, lat: number, jde: number): [number, number];
}

interface PlanetPositionApi {
  Planet: new (data: unknown) => PlanetLike;
  toFK5(lon: number, lat: number, jde: number): Pick<CoordValue, "lon" | "lat">;
}

interface NutationApi {
  nutation(jde: number): [number, number];
  meanObliquity(jde: number): number;
}

interface EclipticValue {
  lon: number;
  lat: number;
  toEquatorial(obliquity: number): Pick<CoordValue, "ra" | "dec">;
}

interface CoordApi {
  Ecliptic: new (lon: number, lat: number) => EclipticValue;
}

interface PrecessApi {
  eclipticPosition(position: EclipticValue, epochFrom: number, epochTo: number): Pick<CoordValue, "lon" | "lat">;
}

interface SolarApi {
  apparentVSOP87(earth: PlanetLike, jde: number): Pick<CoordValue, "lon" | "lat" | "range">;
  apparentEquatorialVSOP87(earth: PlanetLike, jde: number): Pick<CoordValue, "ra" | "dec" | "range">;
}

interface MoonApi {
  position(jde: number): Pick<CoordValue, "lon" | "lat" | "range">;
}

interface PlutoApi {
  heliocentric(jde: number): Pick<CoordValue, "lon" | "lat" | "range">;
}

interface CalendarValue {
  toJD(): number;
  toYear(): number;
}

interface JulianApi {
  CalendarGregorian: new (date: Date) => CalendarValue;
}

interface DeltaTApi {
  deltaT(decimalYear: number): number;
}

interface DefaultModule<T> {
  default: T;
}

interface PlanetPositionModule extends PlanetPositionApi {
  default: PlanetPositionApi;
}

interface Modules {
  base: BaseApi;
  apparent: ApparentApi;
  planetposition: PlanetPositionApi;
  nutation: NutationApi;
  coord: CoordApi;
  precess: PrecessApi;
  solar: SolarApi;
  moon: MoonApi;
  pluto: PlutoApi;
  julian: JulianApi;
  deltat: DeltaTApi;
}

const tau = 2 * Math.PI;
const auKilometres = 149_597_870.7;

const finiteDate = (utcIso: string): Date => {
  const date = new Date(utcIso);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid UTC instant");
  return date;
};

const geocentric = (
  planet: PlanetLike,
  earth: PlanetLike,
  jde: number,
  modules: Pick<Modules, "base" | "apparent" | "planetposition" | "nutation" | "coord">,
): BodySample => {
  const earthPosition = earth.position(jde);
  let x = 0;
  let y = 0;
  let z = 0;
  let distance = 0;

  const update = (lightDays = 0): void => {
    const body = planet.position(jde - lightDays);
    const bodyCosLat = Math.cos(body.lat);
    const earthCosLat = Math.cos(earthPosition.lat);
    x = body.range * bodyCosLat * Math.cos(body.lon) - earthPosition.range * earthCosLat * Math.cos(earthPosition.lon);
    y = body.range * bodyCosLat * Math.sin(body.lon) - earthPosition.range * earthCosLat * Math.sin(earthPosition.lon);
    z = body.range * Math.sin(body.lat) - earthPosition.range * Math.sin(earthPosition.lat);
    distance = Math.hypot(x, y, z);
  };

  update();
  update(modules.base.lightTime(distance));
  let lon = Math.atan2(y, x);
  let lat = Math.atan2(z, Math.hypot(x, y));
  const [aberrationLon, aberrationLat] = modules.apparent.eclipticAberration(lon, lat, jde);
  const fk5 = modules.planetposition.toFK5(lon + aberrationLon, lat + aberrationLat, jde);
  lon = fk5.lon;
  lat = fk5.lat;
  const [nutationLon, nutationObliquity] = modules.nutation.nutation(jde);
  lon = modules.base.pmod(lon + nutationLon, tau);
  const obliquity = modules.nutation.meanObliquity(jde) + nutationObliquity;
  const equatorial = new modules.coord.Ecliptic(lon, lat).toEquatorial(obliquity);
  return {
    rightAscensionRadians: modules.base.pmod(equatorial.ra, tau),
    declinationRadians: equatorial.dec,
    eclipticLongitudeRadians: lon,
    eclipticLatitudeRadians: lat,
    distanceAu: distance,
  };
};

class VendorAstronomia implements AstronomyPort {
  readonly provider = vendorRevisions.astronomia;
  readonly #modules: Modules;
  readonly #earth: PlanetLike;
  readonly #planets: Readonly<Record<Exclude<PlanetId, "sun" | "moon" | "pluto">, PlanetLike>>;
  readonly #pluto: PlanetLike;

  constructor(
    modules: Modules,
    earth: PlanetLike,
    planets: Readonly<Record<Exclude<PlanetId, "sun" | "moon" | "pluto">, PlanetLike>>,
  ) {
    this.#modules = modules;
    this.#earth = earth;
    this.#planets = planets;
    this.#pluto = {
      position: (jde) => {
        const value = modules.pluto.heliocentric(jde);
        const datePosition = modules.precess.eclipticPosition(
          new modules.coord.Ecliptic(value.lon, value.lat),
          2000,
          modules.base.JDEToJulianYear(jde),
        );
        return { lon: datePosition.lon, lat: datePosition.lat, range: value.range };
      },
    };
  }

  time(utcIso: string) {
    const calendar = new this.#modules.julian.CalendarGregorian(finiteDate(utcIso));
    const julianDay = calendar.toJD();
    const deltaTSeconds = this.#modules.deltat.deltaT(calendar.toYear());
    return {
      julianDay,
      deltaTSeconds,
      julianEphemerisDay: julianDay + deltaTSeconds / 86_400,
    };
  }

  sample(id: PlanetId, jde: number): BodySample {
    if (id === "sun") {
      const ecliptic = this.#modules.solar.apparentVSOP87(this.#earth, jde);
      const equatorial = this.#modules.solar.apparentEquatorialVSOP87(this.#earth, jde);
      return {
        rightAscensionRadians: this.#modules.base.pmod(equatorial.ra, tau),
        declinationRadians: equatorial.dec,
        eclipticLongitudeRadians: this.#modules.base.pmod(ecliptic.lon, tau),
        eclipticLatitudeRadians: ecliptic.lat,
        distanceAu: ecliptic.range,
      };
    }
    if (id === "moon") {
      const mean = this.#modules.moon.position(jde);
      const [nutationLon, nutationObliquity] = this.#modules.nutation.nutation(jde);
      const lon = this.#modules.base.pmod(mean.lon + nutationLon, tau);
      const obliquity = this.#modules.nutation.meanObliquity(jde) + nutationObliquity;
      const equatorial = new this.#modules.coord.Ecliptic(lon, mean.lat).toEquatorial(obliquity);
      return {
        rightAscensionRadians: this.#modules.base.pmod(equatorial.ra, tau),
        declinationRadians: equatorial.dec,
        eclipticLongitudeRadians: lon,
        eclipticLatitudeRadians: mean.lat,
        distanceAu: mean.range / auKilometres,
      };
    }
    return geocentric(
      id === "pluto" ? this.#pluto : this.#planets[id],
      this.#earth,
      jde,
      this.#modules,
    );
  }
}

const moduleDefault = async <T>(path: string): Promise<T> => (await loadVendor<DefaultModule<T>>(path)).default;

export const loadAstronomia = async (): Promise<AstronomyPort> => {
  const [
    base,
    apparent,
    planetpositionModule,
    nutation,
    coord,
    precess,
    solar,
    moon,
    pluto,
    julian,
    deltat,
    earthData,
    mercuryData,
    venusData,
    marsData,
    jupiterData,
    saturnData,
    uranusData,
    neptuneData,
  ] = await Promise.all([
    moduleDefault<BaseApi>("astronomia/base"),
    moduleDefault<ApparentApi>("astronomia/apparent"),
    loadVendor<PlanetPositionModule>("astronomia/planetposition"),
    moduleDefault<NutationApi>("astronomia/nutation"),
    moduleDefault<CoordApi>("astronomia/coord"),
    moduleDefault<PrecessApi>("astronomia/precess"),
    moduleDefault<SolarApi>("astronomia/solar"),
    moduleDefault<MoonApi>("astronomia/moonposition"),
    moduleDefault<PlutoApi>("astronomia/pluto"),
    moduleDefault<JulianApi>("astronomia/julian"),
    moduleDefault<DeltaTApi>("astronomia/deltat"),
    moduleDefault<unknown>("astronomia/data/vsop87Bearth"),
    moduleDefault<unknown>("astronomia/data/vsop87Bmercury"),
    moduleDefault<unknown>("astronomia/data/vsop87Bvenus"),
    moduleDefault<unknown>("astronomia/data/vsop87Bmars"),
    moduleDefault<unknown>("astronomia/data/vsop87Bjupiter"),
    moduleDefault<unknown>("astronomia/data/vsop87Bsaturn"),
    moduleDefault<unknown>("astronomia/data/vsop87Buranus"),
    moduleDefault<unknown>("astronomia/data/vsop87Bneptune"),
  ]);
  const planetposition = planetpositionModule.default;
  const earth = new planetposition.Planet(earthData);
  const planets = {
    mercury: new planetposition.Planet(mercuryData),
    venus: new planetposition.Planet(venusData),
    mars: new planetposition.Planet(marsData),
    jupiter: new planetposition.Planet(jupiterData),
    saturn: new planetposition.Planet(saturnData),
    uranus: new planetposition.Planet(uranusData),
    neptune: new planetposition.Planet(neptuneData),
  } satisfies Record<Exclude<PlanetId, "sun" | "moon" | "pluto">, PlanetLike>;
  return new VendorAstronomia(
    { base, apparent, planetposition, nutation, coord, precess, solar, moon, pluto, julian, deltat },
    earth,
    planets,
  );
};
