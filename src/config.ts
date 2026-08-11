import type { Ayanamsha, Zodiac } from "astral-core";
import { readConfig as readInterpreterConfig, type Config as InterpreterConfig } from "astral-interpreter/web";
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
const oneOf = <T extends string>(value: string | undefined, fallback: T, values: readonly T[], key: string): T => {
  const selected = value ?? fallback;
  if (!values.includes(selected as T)) throw new Error(`${key} has an unsupported value`);
  return selected as T;
};
const bool = (value: string | undefined, fallback: boolean, key: string): boolean => {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be true or false`);
};
export const readConfig = (env: Env): Config => {
  const interpreter = readInterpreterConfig(env);
  const primaryZodiac = oneOf(env["ASTRAL_PRIMARY_ZODIAC"], "tropical", ["tropical", "sidereal"] as const, "ASTRAL_PRIMARY_ZODIAC");
  if (env["ASTRAL_INTERPRETATION_MODE"] === "both") throw new Error("ASTRAL_INTERPRETATION_MODE=both is no longer supported; create separate tropical and sidereal charts");
  const interpretationMode = oneOf(env["ASTRAL_INTERPRETATION_MODE"], primaryZodiac, ["tropical", "sidereal"] as const, "ASTRAL_INTERPRETATION_MODE");
  if (primaryZodiac !== interpretationMode) throw new Error("ASTRAL_PRIMARY_ZODIAC and ASTRAL_INTERPRETATION_MODE must select the same zodiac");
  const signingEnabled = bool(env["ASTRAL_SIGNING_ENABLED"], false, "ASTRAL_SIGNING_ENABLED");
  const privateKey = env["ASTRAL_ED25519_PRIVATE_KEY"] || null;
  const publicKey = env["ASTRAL_ED25519_PUBLIC_KEY"] || null;
  if (signingEnabled && (!privateKey || !publicKey)) throw new Error("Signing requires both Ed25519 keys");
  return {
    ...interpreter,
    chart: {
      ...interpreter.chart,
      primaryZodiac,
      ayanamsha: oneOf(env["ASTRAL_SIDEREAL_AYANAMSHA"], "lahiri", ["lahiri", "fagan_bradley", "krishnamurti", "raman"] as const, "ASTRAL_SIDEREAL_AYANAMSHA"),
      interpretationMode,
    },
    signing: {
      enabled: signingEnabled,
      issuer: env["ASTRAL_AUTHORITY_ISSUER"] ?? "kitty-crow/astral-charts",
      privateKey,
      publicKey,
    },
  };
};
