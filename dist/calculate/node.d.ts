import type { Config } from "../config.js";
import { CalculationService, type CalculationOptions, type CalculationPorts } from "./service.js";
export declare const loadCalculationPorts: (version?: string) => Promise<CalculationPorts>;
export declare const loadCalculationService: (config: Config, version?: string) => Promise<{
    service: CalculationService;
    options: CalculationOptions;
}>;
//# sourceMappingURL=node.d.ts.map