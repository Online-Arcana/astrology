import type { CalculationOptions } from "../calculate/service.js";
export type PlaceCommand = {
    action: "continents";
} | {
    action: "countries";
    continent: string | null;
} | {
    action: "regions";
    country: string;
} | {
    action: "cities";
    country: string;
    region: string | null;
    query: string;
} | {
    action: "get";
    id: string;
};
interface CalculationCommandOptions {
    input: string;
    output: string;
    optionOverrides: Partial<CalculationOptions>;
}
export type CliCommand = ({
    kind: "calculate";
} & CalculationCommandOptions) | ({
    kind: "generate";
    pretty: boolean;
} & CalculationCommandOptions) | {
    kind: "validate";
    input: string;
    output: string;
    trusted: string | null;
} | {
    kind: "serve";
    host: string;
    port: number;
    bodyLimitBytes: number;
} | {
    kind: "places";
    command: PlaceCommand;
} | {
    kind: "bills";
    output: string;
} | {
    kind: "help";
};
export declare const parseCliArgs: (args: readonly string[]) => CliCommand;
export declare const cliHelp = "astral-charts\n\nCommands:\n  calculate [--input FILE|-] [--output FILE|-]\n            [--zodiac tropical|sidereal]\n            [--ayanamsha lahiri|fagan_bradley|krishnamurti|raman]\n  generate  [--input FILE|-] [--output FILE|-] [--pretty]\n            [--zodiac tropical|sidereal]\n            [--ayanamsha lahiri|fagan_bradley|krishnamurti|raman]\n  bills [--output FILE|-]\n  validate  [--input FILE|-] [--output FILE|-] [--trusted FILE]\n  serve [--host HOST] [--port PORT] [--body-limit BYTES]\n  places continents\n  places countries [--continent NAME]\n  places regions --country CODE\n  places cities --country CODE [--region CODE] [--query TEXT]\n  places get --id PLACE_ID\n\nGenerate shows a live token and estimated-cost meter on stderr and persists a final bill. Bills prints historical totals and the average completed chart cost.\nEach chart uses one zodiac system. Tropical is the default. Create a separate chart to use another zodiac or sidereal ayanamsha.\n";
export {};
//# sourceMappingURL=cliArgs.d.ts.map