const unsupported = (specifier: string): never => {
  throw new Error(`Unsupported browser vendor module ${specifier}`);
};

/** Static import cases allow esbuild to bundle the deterministic runtime. */
export const loadVendor = async <T>(specifier: string): Promise<T> => {
  switch (specifier) {
    case "@js-joda/core": return import("@js-joda/core") as Promise<T>;
    case "@js-joda/timezone": return import("@js-joda/timezone") as Promise<T>;
    case "astronomia/base": return import("astronomia/base") as Promise<T>;
    case "astronomia/apparent": return import("astronomia/apparent") as Promise<T>;
    case "astronomia/planetposition": return import("astronomia/planetposition") as Promise<T>;
    case "astronomia/nutation": return import("astronomia/nutation") as Promise<T>;
    case "astronomia/sidereal": return import("astronomia/sidereal") as Promise<T>;
    case "astronomia/coord": return import("astronomia/coord") as Promise<T>;
    case "astronomia/precess": return import("astronomia/precess") as Promise<T>;
    case "astronomia/solar": return import("astronomia/solar") as Promise<T>;
    case "astronomia/moonposition": return import("astronomia/moonposition") as Promise<T>;
    case "astronomia/pluto": return import("astronomia/pluto") as Promise<T>;
    case "astronomia/julian": return import("astronomia/julian") as Promise<T>;
    case "astronomia/deltat": return import("astronomia/deltat") as Promise<T>;
    case "astronomia/eclipse": return import("astronomia/eclipse") as Promise<T>;
    case "astronomia/data/vsop87Bearth": return import("astronomia/data/vsop87Bearth") as Promise<T>;
    case "astronomia/data/vsop87Bmercury": return import("astronomia/data/vsop87Bmercury") as Promise<T>;
    case "astronomia/data/vsop87Bvenus": return import("astronomia/data/vsop87Bvenus") as Promise<T>;
    case "astronomia/data/vsop87Bmars": return import("astronomia/data/vsop87Bmars") as Promise<T>;
    case "astronomia/data/vsop87Bjupiter": return import("astronomia/data/vsop87Bjupiter") as Promise<T>;
    case "astronomia/data/vsop87Bsaturn": return import("astronomia/data/vsop87Bsaturn") as Promise<T>;
    case "astronomia/data/vsop87Buranus": return import("astronomia/data/vsop87Buranus") as Promise<T>;
    case "astronomia/data/vsop87Bneptune": return import("astronomia/data/vsop87Bneptune") as Promise<T>;
    default: return unsupported(specifier);
  }
};
