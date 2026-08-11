import { CalcError, calc, type Ayanamsha, type CalcPorts, type Zodiac } from "astral-core/web";
import { prepare, type AstralCalculation, type Subject } from "astral-interpreter/web";
import type { Config } from "../config.js";
import { preferredGenderOf, type BirthInput } from "../types/base.js";

export interface CalculationOptions {
  primaryZodiac: Zodiac;
  ayanamsha: Ayanamsha;
  interpretationMode: Zodiac;
}
export type CalculationPorts = CalcPorts;
export class CalculationUnavailableError extends CalcError {}
const optionsFromConfig = (config: Config): CalculationOptions => ({
  primaryZodiac: config.chart.primaryZodiac,
  ayanamsha: config.chart.ayanamsha,
  interpretationMode: config.chart.interpretationMode,
});
const coreInput = (input: BirthInput) => ({
  date: input.date,
  time: input.time ?? null,
  timeAccuracy: input.timeAccuracy ?? (input.time == null ? "unknown" as const : "exact" as const),
  placeId: input.placeId,
});
const subject = (input: BirthInput): Subject => ({
  ...(input.name === undefined ? {} : { name: input.name }),
  ...(input.lang === undefined ? {} : { language: input.lang }),
  gender: preferredGenderOf(input),
});
export class CalculationService {
  readonly #ports: CalculationPorts;
  constructor(ports: CalculationPorts) { this.#ports = ports; }
  async calculate(input: BirthInput, options: CalculationOptions): Promise<AstralCalculation> {
    if (options.primaryZodiac !== options.interpretationMode) {
      throw new Error("A chart must use one zodiac system; create a separate chart for the other system");
    }
    try {
      return prepare(await calc(coreInput(input), { zodiac: options.primaryZodiac, ayanamsha: options.ayanamsha }, this.#ports), subject(input));
    } catch (cause) {
      if (cause instanceof CalcError) throw new CalculationUnavailableError(cause.reason);
      throw cause;
    }
  }
}
export const loadCalculationPorts = async (version = "0.20.0"): Promise<CalculationPorts> => {
  const { loadPorts } = await import("astral-core");
  return loadPorts(version);
};
export const loadCalculationService = async (config: Config, version = "0.20.0"): Promise<{ service: CalculationService; options: CalculationOptions }> => ({
  service: new CalculationService(await loadCalculationPorts(version)),
  options: optionsFromConfig(config),
});
