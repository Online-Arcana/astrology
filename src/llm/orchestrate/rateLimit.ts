export interface RateLimitState {
  maximum: number;
  effective: number;
  active: number;
  throttles: number;
  retryAfterMs: number | null;
}

const status = (cause: unknown): number | null => {
  if (typeof cause !== "object" || cause === null) return null;
  const value = cause as Record<string, unknown>;
  return typeof value["status"] === "number" ? value["status"] : null;
};

const retryAfter = (cause: unknown): number | null => {
  if (typeof cause !== "object" || cause === null) return null;
  const value = cause as Record<string, unknown>;
  const candidate = value["retryAfterMs"];
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 ? candidate : null;
};

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class AdaptiveLimiter {
  readonly #maximum: number;
  #effective: number;
  #active = 0;
  #throttles = 0;
  #retryAfterMs: number | null = null;
  readonly #waiting: Array<() => void> = [];

  constructor(maximum = 4) {
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 4) {
      throw new Error("Maximum OpenAI concurrency must be from 1 through 4");
    }
    this.#maximum = maximum;
    this.#effective = maximum;
  }

  get state(): RateLimitState {
    return {
      maximum: this.#maximum,
      effective: this.#effective,
      active: this.#active,
      throttles: this.#throttles,
      retryAfterMs: this.#retryAfterMs,
    };
  }

  async #acquire(): Promise<void> {
    if (this.#active < this.#effective) {
      this.#active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.#waiting.push(resolve));
    this.#active += 1;
  }

  #release(): void {
    this.#active -= 1;
    const next = this.#waiting.shift();
    if (next !== undefined && this.#active < this.#effective) next();
  }

  #throttle(cause: unknown, attempt: number): number {
    this.#throttles += 1;
    this.#effective = Math.max(1, this.#effective - 1);
    const server = retryAfter(cause);
    const exponential = Math.min(30_000, 750 * 2 ** Math.min(attempt, 5));
    const jitter = Math.floor(Math.random() * Math.max(100, exponential / 4));
    this.#retryAfterMs = server ?? exponential + jitter;
    return this.#retryAfterMs;
  }

  #recover(): void {
    if (this.#effective < this.#maximum && this.#throttles % 4 === 0) this.#effective += 1;
    this.#retryAfterMs = null;
  }

  async run<T>(operation: () => Promise<T>, retries = 4): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await this.#acquire();
      try {
        const result = await operation();
        this.#recover();
        return result;
      } catch (cause: unknown) {
        if (status(cause) !== 429 || attempt >= retries) throw cause;
        const wait = this.#throttle(cause, attempt);
        await pause(wait);
      } finally {
        this.#release();
      }
    }
    throw new Error("Rate-limited operation exhausted retries");
  }
}
