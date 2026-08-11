const flag = (args, name) => {
    const index = args.indexOf(name);
    if (index < 0)
        return null;
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
        throw new Error(`${name} requires a value`);
    return value;
};
const present = (args, name) => args.includes(name);
const required = (args, name) => {
    const value = flag(args, name);
    if (value === null || value.trim().length === 0)
        throw new Error(`${name} is required`);
    return value;
};
const integer = (value, fallback, name, minimum, maximum) => {
    if (value === null)
        return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
    }
    return parsed;
};
const choice = (value, name, choices) => {
    if (value === null)
        return undefined;
    if (!choices.includes(value))
        throw new Error(`${name} has an unsupported value`);
    return value;
};
const calculationOptions = (args) => {
    const zodiac = choice(flag(args, "--zodiac"), "--zodiac", ["tropical", "sidereal"]);
    const legacyZodiac = choice(flag(args, "--primary-zodiac"), "--primary-zodiac", ["tropical", "sidereal"]);
    const legacyMode = choice(flag(args, "--interpretation-mode"), "--interpretation-mode", ["tropical", "sidereal"]);
    const selected = zodiac ?? legacyZodiac ?? legacyMode;
    for (const value of [zodiac, legacyZodiac, legacyMode]) {
        if (value !== undefined && selected !== undefined && value !== selected) {
            throw new Error("--zodiac, --primary-zodiac and --interpretation-mode must select the same zodiac");
        }
    }
    const ayanamsha = choice(flag(args, "--ayanamsha"), "--ayanamsha", ["lahiri", "fagan_bradley", "krishnamurti", "raman"]);
    const optionOverrides = {};
    if (selected !== undefined) {
        optionOverrides.primaryZodiac = selected;
        optionOverrides.interpretationMode = selected;
    }
    if (ayanamsha !== undefined)
        optionOverrides.ayanamsha = ayanamsha;
    return {
        input: flag(args, "--input") ?? "-",
        output: flag(args, "--output") ?? "-",
        optionOverrides,
    };
};
const placeCommand = (args) => {
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
export const parseCliArgs = (args) => {
    const command = args[0];
    if (command === undefined || command === "help" || command === "--help" || command === "-h")
        return { kind: "help" };
    if (command === "calculate")
        return { kind: "calculate", ...calculationOptions(args) };
    if (command === "generate")
        return {
            kind: "generate",
            ...calculationOptions(args),
            pretty: present(args, "--pretty"),
        };
    if (command === "validate")
        return {
            kind: "validate",
            input: flag(args, "--input") ?? "-",
            output: flag(args, "--output") ?? "-",
            trusted: flag(args, "--trusted"),
        };
    if (command === "serve") {
        return {
            kind: "serve",
            host: flag(args, "--host") ?? "127.0.0.1",
            port: integer(flag(args, "--port"), 8787, "--port", 0, 65_535),
            bodyLimitBytes: integer(flag(args, "--body-limit"), 1_048_576, "--body-limit", 1, 100_000_000),
        };
    }
    if (command === "places")
        return { kind: "places", command: placeCommand(args.slice(1)) };
    if (command === "bills")
        return { kind: "bills", output: flag(args, "--output") ?? "-" };
    throw new Error(`Unknown command: ${command}`);
};
export const cliHelp = `astral-charts

Commands:
  calculate [--input FILE|-] [--output FILE|-]
            [--zodiac tropical|sidereal]
            [--ayanamsha lahiri|fagan_bradley|krishnamurti|raman]
  generate  [--input FILE|-] [--output FILE|-] [--pretty]
            [--zodiac tropical|sidereal]
            [--ayanamsha lahiri|fagan_bradley|krishnamurti|raman]
  bills [--output FILE|-]
  validate  [--input FILE|-] [--output FILE|-] [--trusted FILE]
  serve [--host HOST] [--port PORT] [--body-limit BYTES]
  places continents
  places countries [--continent NAME]
  places regions --country CODE
  places cities --country CODE [--region CODE] [--query TEXT]
  places get --id PLACE_ID

Generate shows a live token and estimated-cost meter on stderr and persists a final bill. Bills prints historical totals and the average completed chart cost.
Each chart uses one zodiac system. Tropical is the default. Create a separate chart to use another zodiac or sidereal ayanamsha.
`;
//# sourceMappingURL=cliArgs.js.map