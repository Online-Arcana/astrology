import type { ChartJobStatus, ChartProgress } from "../types/progress.js";
import type { WorkKind, WorkPhase, WorkUnit } from "./work.js";

interface Sample {
  kind: WorkKind;
  secondsPerWeight: number;
}

interface ActiveWork {
  unit: WorkUnit;
  started: number;
  attempt: number;
  modelName: string | null;
}

export interface WaveProgressState {
  id: number;
  staged: Readonly<Record<string, unknown>>;
  lanes: readonly {
    id: string;
    assignments: readonly string[];
    failureKind?: string | null;
  }[];
}

const iso = (ms: number): string => new Date(ms).toISOString();

const phasesFor = (units: readonly WorkUnit[]): Map<string, WorkPhase> => {
  const phases = new Map<string, WorkPhase>();
  let interpretationSeen = false;
  for (const unit of units) {
    const phase = unit.phase ?? (
      unit.kind === "big" || unit.kind === "small"
        ? "interpretation"
        : interpretationSeen
          ? "final"
          : "deterministic"
    );
    phases.set(unit.id, phase);
    if (phase === "interpretation") interpretationSeen = true;
  }
  return phases;
};

export class ProgressTracker {
  readonly #jobId: string;
  readonly #units: readonly WorkUnit[];
  readonly #phases: ReadonlyMap<string, WorkPhase>;
  readonly #started: number;
  readonly #maxAttempts: number;
  readonly #done = new Set<string>();
  readonly #active = new Map<string, ActiveWork>();
  readonly #retrying = new Set<string>();
  readonly #samples: Sample[] = [];
  readonly #laneByUnit = new Map<string, string>();
  #status: ChartJobStatus = "queued";
  #error: ChartProgress["error"] = null;
  #wave: number | null = null;
  #stagedUnits = 0;
  #rateLimited = false;

  constructor(jobId: string, units: readonly WorkUnit[], startedAtMs: number, maxAttempts: number) {
    if (units.length === 0) throw new Error("Progress requires work units");
    this.#jobId = jobId;
    this.#units = units;
    this.#phases = phasesFor(units);
    this.#started = startedAtMs;
    this.#maxAttempts = maxAttempts;
  }

  restoreAccepted(ids: readonly string[]): void {
    for (const id of ids) {
      const unit = this.#units.find((candidate) => candidate.id === id);
      if (unit === undefined) throw new Error(`Unknown recovered work unit: ${id}`);
      this.#done.add(id);
    }
  }

  setWave(wave: WaveProgressState | null): void {
    this.#laneByUnit.clear();
    this.#wave = wave?.id ?? null;
    this.#stagedUnits = wave === null ? 0 : Object.keys(wave.staged).length;
    this.#rateLimited = false;
    for (const lane of wave?.lanes ?? []) {
      for (const id of lane.assignments) this.#laneByUnit.set(id, lane.id);
      if (lane.failureKind === "rate_limit") this.#rateLimited = true;
    }
  }

  markRetry(id: string): void {
    if (!this.#done.has(id)) this.#retrying.add(id);
  }

  start(id: string, status: ChartJobStatus, nowMs: number, attempt = 1, modelName: string | null = null): void {
    const unit = this.#units.find((candidate) => candidate.id === id);
    if (!unit) throw new Error(`Unknown work unit: ${id}`);
    if (this.#done.has(id)) throw new Error(`Completed work unit restarted: ${id}`);
    this.#active.set(id, { unit, started: nowMs, attempt, modelName });
    this.#status = status;
    this.#error = null;
    if (attempt > 1) this.#retrying.add(id);
  }

  complete(id: string, nowMs: number): void {
    const active = this.#active.get(id);
    if (active === undefined) throw new Error(`Work unit is not active: ${id}`);
    const seconds = Math.max(0, (nowMs - active.started) / 1000);
    this.#samples.push({ kind: active.unit.kind, secondsPerWeight: seconds / active.unit.weight });
    this.#done.add(id);
    this.#active.delete(id);
    this.#retrying.delete(id);
  }

  finish(nowMs: number): ChartProgress {
    if (this.#done.size !== this.#units.length) throw new Error("Cannot finish before all work units complete");
    this.#status = "completed";
    return this.snapshot(nowMs);
  }

  fail(code: string, message: string, nowMs: number): ChartProgress {
    this.#status = "failed";
    this.#error = { code, message };
    return this.snapshot(nowMs);
  }

  snapshot(nowMs: number): ChartProgress {
    const totalWeight = this.#units.reduce((sum, unit) => sum + unit.weight, 0);
    const doneWeight = this.#units.filter((unit) => this.#done.has(unit.id)).reduce((sum, unit) => sum + unit.weight, 0);
    const percent = this.#status === "completed" ? 100 : this.#percent();
    const eta = this.#eta(totalWeight - doneWeight);
    const primary = this.#active.values().next().value as ActiveWork | undefined;
    const phase = this.#currentPhase();
    const interpretation = this.#units.filter((unit) => this.#phases.get(unit.id) === "interpretation");
    const acceptedWeight = interpretation
      .filter((unit) => this.#done.has(unit.id))
      .reduce((sum, unit) => sum + unit.weight, 0);
    const interpretationWeight = interpretation.reduce((sum, unit) => sum + unit.weight, 0);
    const activeLanes = [...this.#active.values()].map(({ unit, attempt, modelName }) => ({
      laneId: this.#laneByUnit.get(unit.id) ?? null,
      unitId: unit.id,
      label: unit.label,
      attempt,
      model: modelName,
    }));
    const multiple = activeLanes.length > 1;

    return {
      jobId: this.#jobId,
      status: this.#status,
      stage: {
        id: multiple ? `wave-${this.#wave ?? "active"}` : primary?.unit.id ?? this.#status,
        label: multiple ? `${activeLanes.length} interpretation lanes active` : primary?.unit.label ?? this.#status,
      },
      unit: {
        id: primary?.unit.id ?? null,
        label: primary?.unit.label ?? null,
        zodiac: primary?.unit.id.includes("tropical") ? "tropical" : primary?.unit.id.includes("sidereal") ? "sidereal" : null,
        section: primary?.unit.id ?? null,
        domain: null,
      },
      progress: { completed: this.#done.size, total: this.#units.length, percent },
      timing: {
        startedAt: iso(this.#started),
        updatedAt: iso(nowMs),
        elapsedSeconds: Math.max(0, Math.round((nowMs - this.#started) / 1000)),
        estimatedRemainingSeconds: eta,
        estimatedCompletionAt: eta === null ? null : iso(nowMs + eta * 1000),
      },
      model: {
        role: primary?.unit.kind === "big" ? "big" : primary?.unit.kind === "small" ? "small" : null,
        name: primary?.modelName ?? null,
      },
      attempt: { current: primary?.attempt ?? 1, maximum: this.#maxAttempts },
      error: this.#error,
      details: {
        phase,
        acceptedWeight,
        totalWeight: interpretationWeight,
        currentWave: this.#wave,
        activeLanes,
        stagedUnits: this.#stagedUnits,
        repairingUnits: [],
        retryingUnits: [...this.#retrying],
        rateLimited: this.#rateLimited,
        finalValidation: phase === "final",
      },
    };
  }

  #currentPhase(): NonNullable<ChartProgress["details"]>["phase"] {
    if (this.#status === "completed" || this.#status === "failed" || this.#status === "cancelled") return this.#status;
    const primary = this.#active.values().next().value as ActiveWork | undefined;
    if (primary !== undefined) return this.#phases.get(primary.unit.id) ?? "deterministic";
    const remaining = this.#units.filter((unit) => !this.#done.has(unit.id));
    if (remaining.some((unit) => this.#phases.get(unit.id) === "deterministic")) return "deterministic";
    if (remaining.some((unit) => this.#phases.get(unit.id) === "interpretation")) return "interpretation";
    return "final";
  }

  #percent(): number {
    const ratio = (phase: WorkPhase): number => {
      const units = this.#units.filter((unit) => this.#phases.get(unit.id) === phase);
      if (units.length === 0) return 1;
      const total = units.reduce((sum, unit) => sum + unit.weight, 0);
      const done = units.filter((unit) => this.#done.has(unit.id)).reduce((sum, unit) => sum + unit.weight, 0);
      return total === 0 ? 1 : done / total;
    };
    const hasInterpretation = this.#units.some((unit) => this.#phases.get(unit.id) === "interpretation");
    const hasFinal = this.#units.some((unit) => this.#phases.get(unit.id) === "final");
    const value = hasInterpretation
      ? ratio("deterministic") * 1 + ratio("interpretation") * 98 + ratio("final") * 1
      : hasFinal
        ? ratio("deterministic") * 99 + ratio("final") * 1
        : ratio("deterministic") * 100;
    return Math.min(99.9, Number(value.toFixed(1)));
  }

  #eta(remainingWeight: number): number | null {
    if (this.#samples.length < 3 || remainingWeight <= 0) return remainingWeight <= 0 ? 0 : null;
    let average = this.#samples[0]?.secondsPerWeight ?? 0;
    for (const sample of this.#samples.slice(1)) average = 0.35 * sample.secondsPerWeight + 0.65 * average;
    return Math.max(0, Math.round(average * remainingWeight));
  }
}
