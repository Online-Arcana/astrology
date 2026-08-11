import type { BillStore } from "astral-interpreter";
import { type CalculationOptions, type CalculationService } from "../calculate/service.js";
import type { ChartGenerationService } from "../generate/service.js";
import type { PlaceCatalogue } from "astral-core";
export interface ApiRequest {
    method: string;
    path: string;
    query: URLSearchParams;
    body: unknown;
}
export interface ApiResponse {
    status: number;
    body: unknown;
}
export interface ApiRuntime {
    service: Pick<CalculationService, "calculate">;
    generator: Pick<ChartGenerationService, "generate"> | null;
    options: CalculationOptions;
    places: PlaceCatalogue;
    version: string;
    /** Optional for backwards-compatible custom runtimes. */
    bills?: BillStore;
    /** Optional admin credential used only by the provider-cost endpoint. */
    openAiAdminKey?: string | null;
}
export declare const routeApi: (request: ApiRequest, runtime: ApiRuntime) => Promise<ApiResponse>;
//# sourceMappingURL=api.d.ts.map