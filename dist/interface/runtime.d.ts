import { BillStore } from "astral-interpreter";
import type { Config } from "../config.js";
import type { ApiRuntime } from "./api.js";
export interface LoadedApiRuntime extends ApiRuntime {
    bills: BillStore;
    openAiAdminKey: string | null;
}
export declare const loadApiRuntime: (config: Config, version?: string) => Promise<LoadedApiRuntime>;
//# sourceMappingURL=runtime.d.ts.map