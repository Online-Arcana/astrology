import type { Zodiac } from "../types/astro.js";

export type WorkKind = "local" | "big" | "small";
export type WorkPhase = "deterministic" | "interpretation" | "final";

export interface WorkUnit {
  id: string;
  label: string;
  kind: WorkKind;
  weight: number;
  phase?: WorkPhase;
}

const local = (id: string, label: string, phase: Extract<WorkPhase, "deterministic" | "final">, weight = 1): WorkUnit => ({
  id,
  label,
  kind: "local",
  weight,
  phase,
});

export const baseWork = (zodiac: Zodiac = "tropical"): WorkUnit[] => [
  local("input", "Validating input", "deterministic"),
  local("place", "Resolving place", "deterministic"),
  local("time", "Resolving civil time", "deterministic", 2),
  local("astronomy", "Calculating astronomy", "deterministic", 4),
  local("system", `Deriving ${zodiac} chart`, "deterministic", 3),
  local("compatibility", `Scoring ${zodiac} compatibility`, "deterministic", 3),
  local("assembly", "Assembling file", "final"),
  local("crc", "Generating integrity block", "final"),
  local("sign", "Signing authority", "final"),
  local("validate", "Validating final file", "final", 2),
];
