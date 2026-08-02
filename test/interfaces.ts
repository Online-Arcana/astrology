import type { Server } from "node:http";
import { routeApi, type ApiRuntime } from "../src/interface/api.js";
import { parseCliArgs } from "../src/interface/cliArgs.js";
import { parseCalculationRequest } from "../src/interface/request.js";
import { listenAstralServer } from "../src/interface/server.js";
import type { BirthInput, PlaceData } from "../src/types/base.js";
import type { AstralCalculation, AstralFile } from "../src/types/file.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const options = {
  primaryZodiac: "tropical" as const,
  ayanamsha: "lahiri" as const,
  interpretationMode: "tropical" as const,
};
const place: PlaceData = {
  id: "fixture:place",
  continent: "Europe",
  subcontinent: "Northern Europe",
  country: { code: "GB", name: "United Kingdom" },
  region: { code: "TST", name: "Fixture" },
  city: { name: "Testville" },
  latitude: 10,
  longitude: -1,
  elevationMetres: null,
  timeZone: "Europe/London",
};
const calculation = { schema: "astral-calculation/1.1.0" } as unknown as AstralCalculation;
const file = { schema: "astral/1.1.0" } as unknown as AstralFile;
let captured: { birth: BirthInput; options: typeof options } | null = null;
let generated: { birth: BirthInput; options: typeof options } | null = null;
const runtime: ApiRuntime = {
  version: "0.19.0",
  options,
  service: {
    calculate: async (birth, selected) => {
      captured = { birth, options: selected as typeof options };
      return calculation;
    },
  },
  generator: {
    generate: async (birth, selected) => {
      generated = { birth, options: selected as typeof options };
      return {
        calculation,
        interpretation: { conversationId: "fixture", units: {}, calls: 0, retries: 0 },
        chart: {} as never,
        file,
      };
    },
  },
  places: {
    continents: async () => ["Europe"],
    countries: async () => [{ code: "GB", name: "United Kingdom", continent: "Europe", subcontinent: "Northern Europe" }],
    regions: async () => [{ code: "TST", name: "Fixture" }],
    cities: async () => [{
      id: place.id,
      name: "Testville",
      region: { code: "TST", name: "Fixture" },
      latitude: 10,
      longitude: -1,
      timeZone: place.timeZone,
    }],
    get: async () => place,
  },
};

await test("request parser applies defaults and validates immutable chart basis", () => {
  const exact = parseCalculationRequest({
    birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact", placeId: place.id },
  }, options);
  equal(exact.options.ayanamsha, "lahiri", "default ayanamsha");
  equal(exact.options.primaryZodiac, "tropical", "default zodiac");
  const sidereal = parseCalculationRequest({
    birth: { date: "1991-06-15", time: null, timeAccuracy: "unknown", placeId: place.id },
    options: { zodiac: "sidereal" },
  }, options);
  equal(sidereal.birth.time, null, "unknown time");
  equal(sidereal.options.primaryZodiac, "sidereal", "overridden zodiac");
  equal(sidereal.options.interpretationMode, "sidereal", "interpretation follows zodiac");

  let mixedFailed = false;
  try {
    parseCalculationRequest({
      birth: { date: "1991-06-15", time: "12:00:00", timeAccuracy: "exact", placeId: place.id },
      options: { primaryZodiac: "tropical", interpretationMode: "sidereal" },
    }, options);
  } catch {
    mixedFailed = true;
  }
  equal(mixedFailed, true, "mixed zodiac rejection");

  let bothFailed = false;
  try {
    parseCalculationRequest({
      birth: { date: "1991-06-15", time: "12:00:00", timeAccuracy: "exact", placeId: place.id },
      options: { interpretationMode: "both" },
    }, options);
  } catch {
    bothFailed = true;
  }
  equal(bothFailed, true, "both mode rejection");
});

await test("JSON router exposes health capability and strict method handling", async () => {
  const health = await routeApi({ method: "GET", path: "/health", query: new URLSearchParams(), body: null }, runtime);
  equal(health.status, 200, "health status");
  equal((health.body as { version: string }).version, "0.19.0", "health version");
  equal((health.body as { interpretedGeneration: boolean }).interpretedGeneration, true, "generation capability");
  const wrongMethod = await routeApi({ method: "GET", path: "/v1/calculations", query: new URLSearchParams(), body: null }, runtime);
  equal(wrongMethod.status, 405, "calculation method status");
});

await test("calculation route uses one selected zodiac", async () => {
  const result = await routeApi({
    method: "POST",
    path: "/v1/calculations",
    query: new URLSearchParams(),
    body: {
      birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact", placeId: place.id },
      options: { zodiac: "sidereal", ayanamsha: "raman" },
    },
  }, runtime);
  equal(result.status, 200, "calculation response status");
  equal(captured?.options.ayanamsha, "raman", "routed ayanamsha");
  equal(captured?.options.primaryZodiac, "sidereal", "routed zodiac");
  equal(captured?.options.interpretationMode, "sidereal", "routed interpretation mode");
  equal((result.body as { calculation: AstralCalculation }).calculation.schema, "astral-calculation/1.1.0", "calculation body");
});

await test("chart generation route returns the final astral file", async () => {
  const result = await routeApi({
    method: "POST",
    path: "/v1/charts",
    query: new URLSearchParams(),
    body: {
      birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact", placeId: place.id },
      options: { zodiac: "sidereal", ayanamsha: "krishnamurti" },
    },
  }, runtime);
  equal(result.status, 200, "generation response status");
  equal(generated?.options.ayanamsha, "krishnamurti", "generation ayanamsha");
  equal(generated?.options.primaryZodiac, "sidereal", "generation zodiac");
  equal((result.body as { file: AstralFile }).file.schema, "astral/1.1.0", "generated file");

  const disabled = await routeApi({
    method: "POST",
    path: "/v1/charts",
    query: new URLSearchParams(),
    body: {
      birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact", placeId: place.id },
    },
  }, { ...runtime, generator: null });
  equal(disabled.status, 503, "unconfigured generation status");
  equal((disabled.body as { error: { code: string } }).error.code, "generation_not_configured", "unconfigured generation code");
});

await test("file validation route returns structural results and validates trust input", async () => {
  const result = await routeApi({
    method: "POST",
    path: "/v1/files/validate",
    query: new URLSearchParams(),
    body: { file: {} },
  }, runtime);
  equal(result.status, 200, "validation response status");
  equal((result.body as { validation: { structure: string } }).validation.structure, "invalid", "invalid structure result");

  const malformed = await routeApi({
    method: "POST",
    path: "/v1/files/validate",
    query: new URLSearchParams(),
    body: { file: {}, trustedAuthorities: {} },
  }, runtime);
  equal(malformed.status, 400, "malformed trust status");
  equal((malformed.body as { error: { code: string } }).error.code, "invalid_validation_request", "malformed trust code");
});

await test("place routes preserve hierarchy query values", async () => {
  const query = new URLSearchParams({ country: "GB", region: "TST", q: "Test" });
  const result = await routeApi({ method: "GET", path: "/v1/places/cities", query, body: null }, runtime);
  equal(result.status, 200, "cities status");
  const cities = (result.body as { cities: { id: string }[] }).cities;
  equal(cities[0]?.id, place.id, "city place id");
});

await test("CLI parser selects one chart basis", () => {
  const calculate = parseCliArgs(["calculate", "--zodiac", "sidereal", "--ayanamsha", "krishnamurti"]);
  assert(calculate.kind === "calculate", "calculate command kind");
  equal(calculate.optionOverrides.primaryZodiac, "sidereal", "CLI zodiac");
  equal(calculate.optionOverrides.interpretationMode, "sidereal", "CLI interpretation zodiac");
  equal(calculate.optionOverrides.ayanamsha, "krishnamurti", "CLI ayanamsha");

  let failed = false;
  try {
    parseCliArgs(["generate", "--zodiac", "tropical", "--interpretation-mode", "sidereal"]);
  } catch {
    failed = true;
  }
  equal(failed, true, "CLI mixed zodiac rejection");
});

const close = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => server.close((cause) => cause ? reject(cause) : resolve()));
};

await test("HTTP adapter serves calculation generation and validation JSON", async () => {
  const { server, address } = await listenAstralServer(runtime, { port: 0 });
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    equal(health.status, 200, "HTTP health status");
    equal((await health.json() as { version: string }).version, "0.19.0", "HTTP health version");

    const calculationResponse = await fetch(`http://127.0.0.1:${address.port}/v1/calculations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact", placeId: place.id },
      }),
    });
    equal(calculationResponse.status, 200, "HTTP calculation status");

    const generationResponse = await fetch(`http://127.0.0.1:${address.port}/v1/charts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact", placeId: place.id },
      }),
    });
    equal(generationResponse.status, 200, "HTTP generation status");
  } finally {
    await close(server);
  }
});

console.log(`1..${passed}`);
