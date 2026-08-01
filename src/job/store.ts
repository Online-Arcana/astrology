import type { ChartProgress } from "../types/progress.js";

export interface JobRecord<T> {
  id: string;
  progress: ChartProgress;
  result: T | null;
  expiresAt: number;
}

export class JobStore<T> {
  readonly #ttlMs: number;
  readonly #jobs = new Map<string, JobRecord<T>>();

  constructor(ttlSeconds: number) {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) throw new Error("Job TTL must be positive");
    this.#ttlMs = ttlSeconds * 1000;
  }

  put(id: string, progress: ChartProgress, result: T | null, nowMs: number): JobRecord<T> {
    const record = { id, progress, result, expiresAt: nowMs + this.#ttlMs };
    this.#jobs.set(id, record);
    return record;
  }

  get(id: string, nowMs: number): JobRecord<T> | null {
    this.sweep(nowMs);
    return this.#jobs.get(id) ?? null;
  }

  sweep(nowMs: number): number {
    let removed = 0;
    for (const [id, record] of this.#jobs) {
      if (record.expiresAt <= nowMs) {
        this.#jobs.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
