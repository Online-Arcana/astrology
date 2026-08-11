import { loadPorts } from "astral-core";
import type { Config } from "../config.js";
import {
  CalculationService,
  type CalculationOptions,
  type CalculationPorts,
} from "./service.js";

const optionsFromConfig = (config: Config): CalculationOptions => ({
  primaryZodiac: config.chart.primaryZodiac,
  ayanamsha: config.chart.ayanamsha,
  interpretationMode: config.chart.interpretationMode,
});

export const loadCalculationPorts = async (version = "0.20.0"): Promise<CalculationPorts> =>
  loadPorts(version);

export const loadCalculationService = async (
  config: Config,
  version = "0.20.0",
): Promise<{ service: CalculationService; options: CalculationOptions }> => ({
  service: new CalculationService(await loadCalculationPorts(version)),
  options: optionsFromConfig(config),
});
