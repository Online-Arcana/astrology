import type { CalculationOptions } from "../calculate/service.js";

export type PlaceCommand =
  | { action: "continents" }
  | { action: "countries"; continent: string | null }
  | { action: "regions"; country: string }
  | { action: "cities"; country: string; region: string | null; query: string }
  | { action: "get"; id: string };

export type CliCommand =
  | {
      kind: "calculate";
      input: string;
      output: string;
      optionOverrides: Partial<CalculationOptions>;
    }
  | { kind: "serve"; host: string; port: number; bodyLimitBytes: number }
  | { kind: "places"; command: PlaceCommand }
  | { kind: "help" };

const flag = (args: readonly string[], name: string): string | null => {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
};

const required = (args: readonly string[], name: string): string => {
  const value = flag(args, name);
  if (value === null || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
};

const integer = (value: string | null, fallback: number, name: string, minimum: number, maximum: number): number => {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return parsed;
};

const choice = <T extends string>(value: string | null, name: string, choices: readonly T[]): T | undefined => {
  if (value === null) return undefined;
  if (!choices.includes(value as T)) throw new Error(`${name} has an unsupported value`);
  return value as T;
};

const placeCommand = (args: readonly string[]): PlaceCommand => {
  const action = args[0];
  switch (action) {
    case "continents": return { action };
    case "countries": return { action, continent: flag(args, "--continent") };
    case "regions": return { action, country: required(args, "--country") };
    case "cities": return {
      action,
      country: required(args, "--country"),
      region: flag(args, "--region"),
      query: flag(args, "--query") ?? "",
    };
    case "get": return { action, id: required(args, "--id") };
    default: throw new Error("places requires continents, countries, regions, cities or get");
  }
};

export const parseCliArgs = (args: readonly string[]): CliCommand => {
  const command = args[0];
  if (command === undefined || command === "help" || command === "--help" || command === "-h") return { kind: "help" };
  if (command === "calculate") {
    const primaryZodiac = choice(flag(args, "--primary-zodiac"), "--primary-zodiac", ["tropical", "sidereal"] as const);
    const ayanamsha = choice(flag(args, "--ayanamsha"), "--ayanamsha", ["lahiri", "fagan_bradley", "krishnamurti", "raman"] as const);
    const interpretationMode = choice(
      flag(args, "--interpretation-mode"),
      "--interpretation-mode",
      ["tropical", "sidereal", "both"] as const,
    );
    const optionOverrides: Partial<CalculationOptions> = {};
    if (primaryZodiac !== undefined) optionOverrides.primaryZodiac = primaryZodiac;
    if (ayanamsha !== undefined) optionOverrides.ayanamsha = ayanamsha;
    if (interpretationMode !== undefined) optionOverrides.interpretationMode = interpretationMode;
    return {
      kind: "calculate",
      input: flag(args, "--input") ?? "-",
      output: flag(args, "--output") ?? "-",
      optionOverrides,
    };
  }
  if (command === "serve") {
    return {
      kind: "serve",
      host: flag(args, "--host") ?? "127.0.0.1",
      port: integer(flag(args, "--port"), 8787, "--port", 0, 65_535),
      bodyLimitBytes: integer(flag(args, "--body-limit"), 1_048_576, "--body-limit", 1, 100_000_000),
    };
  }
  if (command === "places") return { kind: "places", command: placeCommand(args.slice(1)) };
  throw new Error(`Unknown command: ${command}`);
};

export const cliHelp = `astral-charts

Commands:
  calculate [--input FILE|-] [--output FILE|-]
            [--primary-zodiac tropical|sidereal]
            [--ayanamsha lahiri|fagan_bradley|krishnamurti|raman]
            [--interpretation-mode tropical|sidereal|both]
  serve [--host HOST] [--port PORT] [--body-limit BYTES]
  places continents
  places countries [--continent NAME]
  places regions --country CODE
  places cities --country CODE [--region CODE] [--query TEXT]
  places get --id PLACE_ID
`;
