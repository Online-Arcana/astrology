import { CalcError, calc } from "astral-core/web";
import { prepare } from "astral-interpreter/web";
import { preferredGenderOf } from "../types/base.js";
export class CalculationUnavailableError extends CalcError {
}
const optionsFromConfig = (config) => ({
    primaryZodiac: config.chart.primaryZodiac,
    ayanamsha: config.chart.ayanamsha,
    interpretationMode: config.chart.interpretationMode,
});
const coreInput = (input) => ({
    date: input.date,
    time: input.time ?? null,
    timeAccuracy: input.timeAccuracy ?? (input.time == null ? "unknown" : "exact"),
    placeId: input.placeId,
});
const subject = (input) => ({
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.lang === undefined ? {} : { language: input.lang }),
    gender: preferredGenderOf(input),
});
export class CalculationService {
    #ports;
    constructor(ports) { this.#ports = ports; }
    async calculate(input, options) {
        if (options.primaryZodiac !== options.interpretationMode) {
            throw new Error("A chart must use one zodiac system; create a separate chart for the other system");
        }
        try {
            return prepare(await calc(coreInput(input), { zodiac: options.primaryZodiac, ayanamsha: options.ayanamsha }, this.#ports), subject(input));
        }
        catch (cause) {
            if (cause instanceof CalcError)
                throw new CalculationUnavailableError(cause.reason);
            throw cause;
        }
    }
}
export const loadCalculationPorts = async (version = "0.20.0") => {
    const { loadPorts } = await import("astral-core");
    return loadPorts(version);
};
export const loadCalculationService = async (config, version = "0.20.0") => ({
    service: new CalculationService(await loadCalculationPorts(version)),
    options: optionsFromConfig(config),
});
//# sourceMappingURL=service.js.map