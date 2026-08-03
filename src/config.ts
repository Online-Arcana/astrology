import type { Ayanamsha, Zodiac } from "./types/astro.js";

export type Env = Readonly<Record<string, string | undefined>>;

export interface Config {
  openai: {
    apiKey: string;
    adminKey: string | null;
    bigModel: string;
    smallModel: string;
    reasoning: "none" | "low" | "medium" | "high";
    maxOutputTokens: number;
  };
  chart: {
    primaryZodiac: Zodiac;
    ayanamsha: Ayanamsha;
    interpretationMode: Zodiac;
    maxRetries: number;
    foundationUnits?: number;
    laneCount?: number;
    laneUnits?: number;
    laneContextTokens?: number;
  };
  billing: {
    directory: string;
  };
  signing: {
    enabled: boolean;
    issuer: string;
    privateKey: string | null;
    publicKey: string | null;
  };
  jobs: { ttlSeconds: number };
}

const ints = (value: string | undefined, fallback: number, key: string): number => {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${key} must be a positive integer`);
  return parsed;
};

const bounded = (value: string | undefined, fallback: number, key: string, maximum: number): number => {
  const selected = ints(value, fallback, key);
  if (selected > maximum) throw new Error(`${key} must not exceed ${maximum}`);
  return selected;
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
  const signingEnabled = bool(env["ASTRAL_SIGNING_ENABLED"], false, "ASTRAL_SIGNING_ENABLED");
  const privateKey = env["ASTRAL_ED25519_PRIVATE_KEY"] || null;
  const publicKey = env["ASTRAL_ED25519_PUBLIC_KEY"] || null;
  if (signingEnabled && (!privateKey || !publicKey)) throw new Error("Signing requires both Ed25519 keys");

  const primaryZodiac = oneOf(
    env["ASTRAL_PRIMARY_ZODIAC"],
    "tropical",
    ["tropical", "sidereal"] as const,
    "ASTRAL_PRIMARY_ZODIAC",
  );
  if (env["ASTRAL_INTERPRETATION_MODE"] === "both") {
    throw new Error("ASTRAL_INTERPRETATION_MODE=both is no longer supported; create separate tropical and sidereal charts");
  }
  const interpretationMode = oneOf(
    env["ASTRAL_INTERPRETATION_MODE"],
    primaryZodiac,
    ["tropical", "sidereal"] as const,
    "ASTRAL_INTERPRETATION_MODE",
  );
  if (primaryZodiac !== interpretationMode) {
    throw new Error("ASTRAL_PRIMARY_ZODIAC and ASTRAL_INTERPRETATION_MODE must select the same zodiac");
  }

  return {
    openai: {
      apiKey: env["OPENAI_API_KEY"] ?? "",
      adminKey: env["OPENAI_ADMIN_KEY"] || null,
      bigModel: env["OPENAI_BIG_MODEL"] ?? "gpt-5.4-mini",
      smallModel: env["OPENAI_SMALL_MODEL"] ?? "gpt-5.4-nano",
      reasoning: oneOf(env["OPENAI_REASONING"], "low", ["none", "low", "medium", "high"] as const, "OPENAI_REASONING"),
      maxOutputTokens: ints(env["OPENAI_MAX_OUTPUT_TOKENS"], 12000, "OPENAI_MAX_OUTPUT_TOKENS"),
    },
    chart: {
      primaryZodiac,
      ayanamsha: oneOf(env["ASTRAL_SIDEREAL_AYANAMSHA"], "lahiri", ["lahiri", "fagan_bradley", "krishnamurti", "raman"] as const, "ASTRAL_SIDEREAL_AYANAMSHA"),
      interpretationMode,
      maxRetries: ints(env["ASTRAL_MAX_RETRIES"], 3, "ASTRAL_MAX_RETRIES"),
      foundationUnits: bounded(env["ASTRAL_FOUNDATION_UNITS"], 10, "ASTRAL_FOUNDATION_UNITS", 10),
      laneCount: bounded(env["ASTRAL_LANE_COUNT"], 4, "ASTRAL_LANE_COUNT", 4),
      laneUnits: bounded(env["ASTRAL_LANE_UNITS"], 10, "ASTRAL_LANE_UNITS", 10),
      laneContextTokens: ints(env["ASTRAL_LANE_CONTEXT_TOKENS"], 60_000, "ASTRAL_LANE_CONTEXT_TOKENS"),
    },
    billing: {
      directory: env["ASTRAL_BILL_DIR"]?.trim() || ".astral/bills",
    },
    signing: {
      enabled: signingEnabled,
      issuer: env["ASTRAL_AUTHORITY_ISSUER"] ?? "kitty-crow/astral-charts",
      privateKey,
      publicKey,
    },
    jobs: { ttlSeconds: ints(env["ASTRAL_JOB_TTL_SECONDS"], 3600, "ASTRAL_JOB_TTL_SECONDS") },
  };
};
