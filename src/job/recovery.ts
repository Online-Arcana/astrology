import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import type { ChartProgress } from "../types/progress.js";

export const temporaryJobSchema = "astral-temporary-job/1.0.0" as const;
export const temporaryJobIdPattern = /^[0-9a-f]{8}$/u;

export interface TemporaryJobRecord<T> {
  schema: typeof temporaryJobSchema;
  id: string;
  conversationId: string | null;
  progress: ChartProgress;
  state: T;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const rec = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const code = (cause: unknown): string | null => {
  if (!rec(cause)) return null;
  const value = cause["code"];
  return typeof value === "string" ? value : null;
};

const iso = (ms: number): string => new Date(ms).toISOString();

const idFor = (): string => randomBytes(4).toString("hex");

const encode = <T>(record: TemporaryJobRecord<T>): string => {
  const value = JSON.stringify(record);
  if (value === undefined) throw new Error("Temporary job state must be JSON-serialisable");
  return value;
};

const withId = (progress: ChartProgress, id: string): ChartProgress => ({
  ...progress,
  jobId: id,
});

const parse = <T>(source: string, expectedId: string): TemporaryJobRecord<T> => {
  const value: unknown = JSON.parse(source);
  if (!rec(value)) throw new Error("Temporary job record must be an object");
  if (value["schema"] !== temporaryJobSchema) throw new Error("Temporary job record schema is unsupported");
  if (value["id"] !== expectedId) throw new Error("Temporary job record ID does not match its file");

  const conversationId = value["conversationId"];
  if (conversationId !== null && (typeof conversationId !== "string" || conversationId.length === 0)) {
    throw new Error("Temporary job conversation ID is invalid");
  }

  const progress = value["progress"];
  if (!rec(progress) || progress["jobId"] !== expectedId || typeof progress["status"] !== "string") {
    throw new Error("Temporary job progress is invalid");
  }

  const createdAt = value["createdAt"];
  const updatedAt = value["updatedAt"];
  const expiresAt = value["expiresAt"];
  if (
    typeof createdAt !== "string"
    || typeof updatedAt !== "string"
    || typeof expiresAt !== "string"
    || !Number.isFinite(Date.parse(createdAt))
    || !Number.isFinite(Date.parse(updatedAt))
    || !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new Error("Temporary job timestamps are invalid");
  }

  return {
    schema: temporaryJobSchema,
    id: expectedId,
    conversationId,
    progress: progress as unknown as ChartProgress,
    state: value["state"] as T,
    createdAt,
    updatedAt,
    expiresAt,
  };
};

export class TemporaryJobStore<T> {
  readonly #dir: string;
  readonly #ttlMs: number;

  constructor(directory: string, ttlSeconds: number) {
    if (directory.trim().length === 0) throw new Error("Temporary job directory is required");
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) throw new Error("Temporary job TTL must be positive");
    this.#dir = resolve(directory);
    this.#ttlMs = ttlSeconds * 1000;
  }

  async create(
    progress: ChartProgress,
    state: T,
    nowMs = Date.now(),
  ): Promise<TemporaryJobRecord<T>> {
    if (progress.status === "completed") throw new Error("A completed job cannot create a recovery ID");
    await mkdir(this.#dir, { recursive: true });

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const id = idFor();
      const record = this.#record(id, null, progress, state, nowMs, nowMs);
      try {
        await writeFile(this.#path(id), encode(record), {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
        return record;
      } catch (cause: unknown) {
        if (code(cause) === "EEXIST") continue;
        throw cause;
      }
    }

    throw new Error("Could not allocate a unique temporary job ID");
  }

  async save(
    id: string,
    conversationId: string | null,
    progress: ChartProgress,
    state: T,
    nowMs = Date.now(),
  ): Promise<TemporaryJobRecord<T> | null> {
    this.#assertId(id);
    if (progress.status === "completed") {
      await this.delete(id);
      return null;
    }
    if (conversationId !== null && conversationId.length === 0) {
      throw new Error("Temporary job conversation ID cannot be empty");
    }

    const current = await this.get(id, nowMs);
    if (current === null) throw new Error(`Temporary job ${id} does not exist or has expired`);
    if (current.conversationId !== null && conversationId !== current.conversationId) {
      throw new Error("Temporary job conversation ID cannot change once established");
    }

    const record = this.#record(id, conversationId, progress, state, Date.parse(current.createdAt), nowMs);
    await this.#replace(record);
    return record;
  }

  async get(id: string, nowMs = Date.now()): Promise<TemporaryJobRecord<T> | null> {
    this.#assertId(id);
    const source = await this.#read(id);
    if (source === null) return null;
    const record = parse<T>(source, id);
    if (Date.parse(record.expiresAt) <= nowMs) {
      await this.delete(id);
      return null;
    }
    return record;
  }

  async delete(id: string): Promise<boolean> {
    this.#assertId(id);
    try {
      await rm(this.#path(id));
      return true;
    } catch (cause: unknown) {
      if (code(cause) === "ENOENT") return false;
      throw cause;
    }
  }

  async sweep(nowMs = Date.now()): Promise<number> {
    await mkdir(this.#dir, { recursive: true });
    const names = await readdir(this.#dir);
    let removed = 0;

    for (const name of names) {
      const match = /^([0-9a-f]{8})\.json$/u.exec(name);
      if (!match) continue;
      const id = match[1] as string;
      try {
        const source = await this.#read(id);
        if (source === null) continue;
        const record = parse<T>(source, id);
        if (Date.parse(record.expiresAt) > nowMs) continue;
      } catch {
        // Corrupt temporary state cannot be resumed and must not block cleanup.
      }
      if (await this.delete(id)) removed += 1;
    }

    return removed;
  }

  #record(
    id: string,
    conversationId: string | null,
    progress: ChartProgress,
    state: T,
    createdAtMs: number,
    updatedAtMs: number,
  ): TemporaryJobRecord<T> {
    return {
      schema: temporaryJobSchema,
      id,
      conversationId,
      progress: withId(progress, id),
      state,
      createdAt: iso(createdAtMs),
      updatedAt: iso(updatedAtMs),
      expiresAt: iso(updatedAtMs + this.#ttlMs),
    };
  }

  #assertId(id: string): void {
    if (!temporaryJobIdPattern.test(id)) throw new Error("Temporary job ID must contain exactly eight hexadecimal characters");
  }

  #path(id: string): string {
    return resolve(this.#dir, `${id}.json`);
  }

  async #read(id: string): Promise<string | null> {
    try {
      return await readFile(this.#path(id), "utf8");
    } catch (cause: unknown) {
      if (code(cause) === "ENOENT") return null;
      throw cause;
    }
  }

  async #replace(record: TemporaryJobRecord<T>): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    const temporary = resolve(
      this.#dir,
      `.${record.id}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`,
    );
    try {
      await writeFile(temporary, encode(record), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporary, this.#path(record.id));
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
