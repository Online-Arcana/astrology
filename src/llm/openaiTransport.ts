type RecordValue = Record<string, unknown>;

type OpenAIStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "incomplete";

export interface OpenAITransportOptions {
  fetch?: typeof fetch;
  background?: boolean;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  createTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class OpenAITransportError extends Error {
  readonly responseId: string | null;
  readonly responseStatus: string | null;

  constructor(
    message: string,
    responseId: string | null = null,
    responseStatus: string | null = null,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "OpenAITransportError";
    this.responseId = responseId;
    this.responseStatus = responseStatus;
  }
}

const waiting = new Set<OpenAIStatus>([
  "queued",
  "in_progress",
]);

const terminal = new Set<OpenAIStatus>([
  "completed",
  "failed",
  "cancelled",
  "incomplete",
]);

const transient = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
]);

const rec = (
  value: unknown,
): value is RecordValue =>
  typeof value === "object"
  && value !== null
  && !Array.isArray(value);

const positive = (
  value: number | undefined,
  fallback: number,
  name: string,
): number => {
  const selected = value ?? fallback;

  if (
    !Number.isSafeInteger(selected)
    || selected < 1
  ) {
    throw new Error(
      `${name} must be a positive integer`,
    );
  }

  return selected;
};

const statusOf = (
  value: RecordValue,
): OpenAIStatus | null => {
  const status = value["status"];

  if (
    status === "queued"
    || status === "in_progress"
    || status === "completed"
    || status === "failed"
    || status === "cancelled"
    || status === "incomplete"
  ) {
    return status;
  }

  return null;
};

const responseIdOf = (
  value: RecordValue,
): string | null =>
  typeof value["id"] === "string"
  && value["id"].length > 0
    ? value["id"]
    : null;

const errorMessage = (
  value: RecordValue,
  fallback: string,
): string => {
  const error = value["error"];

  if (
    rec(error)
    && typeof error["message"] === "string"
    && error["message"].length > 0
  ) {
    return error["message"];
  }

  const incomplete = value["incomplete_details"];

  if (
    rec(incomplete)
    && typeof incomplete["reason"] === "string"
    && incomplete["reason"].length > 0
  ) {
    return incomplete["reason"];
  }

  return fallback;
};

const requestUrl = (
  input: RequestInfo | URL,
): string =>
  input instanceof Request
    ? input.url
    : String(input);

const requestMethod = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): string =>
  String(
    init?.method
    ?? (
      input instanceof Request
        ? input.method
        : "GET"
    ),
  ).toUpperCase();

const responseEndpoint = (
  input: RequestInfo | URL,
): boolean => {
  const url = new URL(requestUrl(input));
  return /\/responses\/?$/u.test(url.pathname);
};

const reply = (
  source: Response,
  body: string,
): Response => {
  const headers = new Headers(source.headers);
  headers.delete("content-length");

  return new Response(body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
};

const json = (
  source: Response,
  value: unknown,
): Response =>
  reply(source, JSON.stringify(value));

const abortError = (
  signal: AbortSignal,
): unknown =>
  signal.reason
  ?? new Error("OpenAI request was aborted");

const pause = (
  ms: number,
  signal: AbortSignal | undefined,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener(
        "abort",
        onAbort,
      );

      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener(
        "abort",
        onAbort,
      );

      reject(
        signal === undefined
          ? new Error(
              "OpenAI request was aborted",
            )
          : abortError(signal),
      );
    };

    signal?.addEventListener(
      "abort",
      onAbort,
      { once: true },
    );
  });

const retryAfterMs = (
  response: Response,
): number | null => {
  const value = response.headers.get(
    "retry-after",
  );

  if (value === null) return null;

  const seconds = Number(value);

  if (
    Number.isFinite(seconds)
    && seconds >= 0
  ) {
    return Math.ceil(seconds * 1_000);
  }

  const date = Date.parse(value);

  return Number.isFinite(date)
    ? Math.max(0, date - Date.now())
    : null;
};

const trimBody = async (
  response: Response,
): Promise<string> =>
  (await response.text())
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 500);

const responseFailure = (
  id: string,
  status: OpenAIStatus,
  value: RecordValue,
): OpenAITransportError =>
  new OpenAITransportError(
    `OpenAI response ${id} ${status}: ${errorMessage(value, "no further detail")}`,
    id,
    status,
  );

const httpFailure = async (
  response: Response,
  id: string | null,
): Promise<OpenAITransportError> => {
  const detail = await trimBody(response);

  return new OpenAITransportError(
    `OpenAI polling failed with HTTP ${response.status}${detail.length === 0 ? "" : `: ${detail}`}`,
    id,
    null,
  );
};

export const createOpenAITransport = (
  options: OpenAITransportOptions = {},
): typeof fetch => {
  const fetcher =
    options.fetch
    ?? globalThis.fetch.bind(globalThis);

  const background =
    options.background
    ?? true;

  const pollIntervalMs = positive(
    options.pollIntervalMs,
    2_000,
    "OpenAI poll interval",
  );

  const pollTimeoutMs = positive(
    options.pollTimeoutMs,
    2 * 60 * 60 * 1_000,
    "OpenAI poll timeout",
  );

  const createTimeoutMs = positive(
    options.createTimeoutMs,
    15 * 60 * 1_000,
    "OpenAI creation timeout",
  );

  const retryAttempts = positive(
    options.retryAttempts,
    5,
    "OpenAI transport retry attempts",
  );

  const retryDelayMs = positive(
    options.retryDelayMs,
    1_000,
    "OpenAI transport retry delay",
  );

  const get = async (
    url: string,
    headers: Headers,
    signal: AbortSignal | undefined,
    id: string,
    deadline: number,
  ): Promise<Response> => {
    let attempt = 0;
    let last: unknown = null;

    for (;;) {
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        throw new OpenAITransportError(
          `OpenAI response ${id} could not be polled before its deadline`,
          id,
          null,
          last,
        );
      }

      attempt += 1;
      const delay = Math.min(
        30_000,
        retryDelayMs * 2 ** Math.min(attempt - 1, retryAttempts - 1),
      );

      try {
        const response = await fetcher(url, {
          method: "GET",
          headers,
          ...(signal === undefined
            ? {}
            : { signal }),
        });

        if (!transient.has(response.status)) {
          return response;
        }

        const wait = retryAfterMs(response) ?? delay;
        await response.body?.cancel();
        await pause(
          Math.min(wait, Math.max(1, deadline - Date.now())),
          signal,
        );
      } catch (cause: unknown) {
        if (signal?.aborted) throw abortError(signal);
        last = cause;
        const wait = Math.min(delay, deadline - Date.now());
        if (wait <= 0) continue;
        await pause(wait, signal);
      }
    }
  };

  const poll = async (
    responseUrl: string,
    id: string,
    headers: Headers,
    signal: AbortSignal | undefined,
  ): Promise<Response> => {
    const deadline = Date.now() + pollTimeoutMs;

    for (;;) {
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        throw new OpenAITransportError(
          `OpenAI response ${id} did not finish within ${pollTimeoutMs} ms`,
          id,
          "in_progress",
        );
      }

      await pause(
        Math.min(pollIntervalMs, remaining),
        signal,
      );

      const response = await get(
        `${responseUrl}/${encodeURIComponent(id)}`,
        headers,
        signal,
        id,
        deadline,
      );

      if (!response.ok) {
        throw await httpFailure(response, id);
      }

      const raw = await response.text();
      let value: unknown;

      try {
        value = JSON.parse(raw);
      } catch (cause: unknown) {
        throw new OpenAITransportError(
          `OpenAI response ${id} returned invalid JSON while polling`,
          id,
          null,
          cause,
        );
      }

      if (!rec(value)) {
        throw new OpenAITransportError(
          `OpenAI response ${id} returned a non-object payload while polling`,
          id,
        );
      }

      const status = statusOf(value);

      if (status === "completed") {
        return json(response, value);
      }

      if (
        status !== null
        && waiting.has(status)
      ) {
        continue;
      }

      if (
        status !== null
        && terminal.has(status)
      ) {
        throw responseFailure(
          id,
          status,
          value,
        );
      }

      throw new OpenAITransportError(
        `OpenAI response ${id} returned an unsupported status`,
        id,
        status,
      );
    }
  };

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    if (
      !background
      || requestMethod(input, init) !== "POST"
      || !responseEndpoint(input)
      || typeof init?.body !== "string"
    ) {
      return fetcher(input, init);
    }

    let body: unknown;

    try {
      body = JSON.parse(init.body);
    } catch {
      return fetcher(input, init);
    }

    if (!rec(body)) {
      return fetcher(input, init);
    }

    const headers = new Headers(
      init.headers
      ?? (
        input instanceof Request
          ? input.headers
          : undefined
      ),
    );

    if (!headers.has("x-client-request-id")) {
      headers.set(
        "x-client-request-id",
        globalThis.crypto.randomUUID(),
      );
    }

    if (!headers.has("idempotency-key")) {
      headers.set(
        "idempotency-key",
        globalThis.crypto.randomUUID(),
      );
    }

    const signal =
      init.signal
      ?? (
        input instanceof Request
          ? input.signal
          : undefined
      );

    const createDeadline = Date.now() + createTimeoutMs;
    let createAttempt = 0;
    let response: Response | null = null;
    let createCause: unknown = null;

    for (;;) {
      const remaining = createDeadline - Date.now();

      if (remaining <= 0) {
        throw new OpenAITransportError(
          `OpenAI response creation did not finish within ${createTimeoutMs} ms`,
          null,
          null,
          createCause,
        );
      }

      createAttempt += 1;
      const delay = Math.min(
        30_000,
        retryDelayMs * 2 ** Math.min(createAttempt - 1, retryAttempts - 1),
      );

      try {
        const created = await fetcher(input, {
          ...init,
          headers,
          body: JSON.stringify({
            ...body,
            background: true,
          }),
        });

        if (!transient.has(created.status)) {
          response = created;
          break;
        }

        const wait = retryAfterMs(created) ?? delay;
        await created.body?.cancel();
        await pause(
          Math.min(wait, Math.max(1, createDeadline - Date.now())),
          signal,
        );
      } catch (cause: unknown) {
        if (signal?.aborted) throw abortError(signal);
        createCause = cause;
        const wait = Math.min(delay, createDeadline - Date.now());
        if (wait <= 0) continue;
        await pause(wait, signal);
      }
    }

    if (response === null) {
      throw new OpenAITransportError(
        "OpenAI response creation ended without a response",
        null,
        null,
        createCause,
      );
    }

    if (!response.ok) return response;

    const raw = await response.text();
    let value: unknown;

    try {
      value = JSON.parse(raw);
    } catch {
      return reply(response, raw);
    }

    if (!rec(value)) {
      return json(response, value);
    }

    const status = statusOf(value);

    if (
      status === null
      || status === "completed"
    ) {
      return json(response, value);
    }

    const id = responseIdOf(value);

    if (id === null) {
      throw new OpenAITransportError(
        "OpenAI background response did not include an id",
        null,
        status,
      );
    }

    if (waiting.has(status)) {
      return poll(
        requestUrl(input).replace(/\/+$/u, ""),
        id,
        headers,
        signal,
      );
    }

    throw responseFailure(id, status, value);
  };
};
