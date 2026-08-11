import type { Ayanamsha, Zodiac } from "astral-core";
import { type Config as InterpreterConfig } from "astral-interpreter/web";
export type Env = Readonly<Record<string, string | undefined>>;
export type Config = Omit<InterpreterConfig, "chart"> & {
    chart: InterpreterConfig["chart"] & {
        primaryZodiac: Zodiac;
        ayanamsha: Ayanamsha;
        interpretationMode: Zodiac;
    };
    signing: {
        enabled: boolean;
        issuer: string;
        privateKey: string | null;
        publicKey: string | null;
    };
};
export declare const readConfig: (env: Env) => Config;
//# sourceMappingURL=config.d.ts.map