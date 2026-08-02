import type { CompatibilityDomain } from "./astro.js";

export type ChartJobStatus =
  | "queued" | "calculating" | "interpreting" | "auditing"
  | "assembling" | "signing" | "completed" | "failed" | "cancelled";

export interface ActiveLaneProgress {
  laneId: string | null;
  unitId: string;
  label: string;
  attempt: number;
  model: string | null;
}

export interface ChartProgressDetails {
  phase: "deterministic" | "interpretation" | "final" | "completed" | "failed" | "cancelled";
  acceptedWeight: number;
  totalWeight: number;
  currentWave: number | null;
  activeLanes: ActiveLaneProgress[];
  stagedUnits: number;
  repairingUnits: string[];
  retryingUnits: string[];
  rateLimited: boolean;
  finalValidation: boolean;
}

export interface ChartProgress {
  jobId: string;
  status: ChartJobStatus;
  stage: { id: string; label: string };
  unit: {
    id: string | null;
    label: string | null;
    zodiac: "tropical" | "sidereal" | null;
    section: string | null;
    domain: CompatibilityDomain | null;
  };
  progress: { completed: number; total: number; percent: number };
  timing: {
    startedAt: string;
    updatedAt: string;
    elapsedSeconds: number;
    estimatedRemainingSeconds: number | null;
    estimatedCompletionAt: string | null;
  };
  model: { role: "big" | "small" | null; name: string | null };
  attempt: { current: number; maximum: number };
  error: { code: string; message: string } | null;
  details?: ChartProgressDetails;
}
