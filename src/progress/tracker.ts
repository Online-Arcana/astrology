import type { ChartJobStatus, ChartProgress } from "../types/progress.js";
import type { WorkKind, WorkUnit } from "./work.js";

interface Sample {
  kind: WorkKind;
  secondsPerWeight: number;
}

const iso = (ms: number): string => new Date(ms).toISOString();

export class ProgressTracker {
  readonly #jobId: string;
  readonly #units: readonly WorkUnit[];
  readonly #started: number;
  readonly #maxAttempts: number;
  readonly #done = new Set<string>();
  readonly #samples: Sample[] = [];
  #status: ChartJobStatus = "queued";
  #current: WorkUnit | null = null;
  #currentStarted: number | null = null;
  #attempt = 1;
  #modelName: string | null = null;
  #error: ChartProgress["error"] = null;

  constructor(jobId: string, units: readonly WorkUnit[], startedAtMs: number, maxAttempts: number) {
    if (units.length === 0) throw new Error("Progress requires work units");
    this.#jobId = jobId;
    this.#units = units;
    this.#started = startedAtMs;
    this.#maxAttempts = maxAttempts;
  }

  start(id: string, status: ChartJobStatus, nowMs: number, attempt = 1, modelName: string | null = null): void {
    const unit = this.#units.find((candidate) => candidate.id === id);
    if (!unit) throw new Error(`Unknown work unit: ${id}`);
    if (this.#done.has(id)) throw new Error(`Completed work unit restarted: ${id}`);
    this.#current = unit;
    this.#currentStarted = nowMs;
    this.#status = status;
    this.#attempt = attempt;
    this.#modelName = modelName;
    this.#error = null;
  }

  complete(id: string, nowMs: number): void {
    if (!this.#current || this.#current.id !== id || this.#currentStarted === null) throw new Error(`Work unit is not active: ${id}`);
    const seconds = Math.max(0, (nowMs - this.#currentStarted) / 1000);
    this.#samples.push({ kind: this.#current.kind, secondsPerWeight: seconds / this.#current.weight });
    this.#done.add(id);
    this.#current = null;
    this.#currentStarted = null;
    this.#modelName = null;
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
    const percent = this.#status === "completed" ? 100 : Math.min(99.9, Number(((doneWeight / totalWeight) * 100).toFixed(1)));
    const eta = this.#eta(totalWeight - doneWeight);
    return {
      jobId: this.#jobId,
      status: this.#status,
      stage: {
        id: this.#current?.id ?? this.#status,
        label: this.#current?.label ?? this.#status,
      },
      unit: {
        id: this.#current?.id ?? null,
        label: this.#current?.label ?? null,
        zodiac: this.#current?.id.includes("tropical") ? "tropical" : this.#current?.id.includes("sidereal") ? "sidereal" : null,
        section: this.#current?.id ?? null,
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
        role: this.#current?.kind === "big" ? "big" : this.#current?.kind === "small" ? "small" : null,
        name: this.#modelName,
      },
      attempt: { current: this.#attempt, maximum: this.#maxAttempts },
      error: this.#error,
    };
  }

  #eta(remainingWeight: number): number | null {
    if (this.#samples.length < 3 || remainingWeight <= 0) return remainingWeight <= 0 ? 0 : null;
    let average = this.#samples[0]?.secondsPerWeight ?? 0;
    for (const sample of this.#samples.slice(1)) average = 0.35 * sample.secondsPerWeight + 0.65 * average;
    return Math.max(0, Math.round(average * remainingWeight));
  }
}
