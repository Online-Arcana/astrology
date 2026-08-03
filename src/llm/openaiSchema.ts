import { OpenAISchema, type Shape } from "openai-schema";
import {
  createOpenAITransport,
  type OpenAITransportOptions,
} from "./openaiTransport.js";
import type {
  SchemaClient,
  SchemaClientFactory,
  StrictShape,
  UploadedFile,
} from "./orchestrate/types.js";

export interface OpenAISchemaRuntimeOptions {
  apiKey: string;
  instructions: string;
  metadata?: Record<string, string>;
  base?: string;
  fetch?: typeof fetch;
  transport?: Omit<OpenAITransportOptions, "fetch">;
  /** Conservative total input, history and reserved-output budget per conversation. */
  contextTokenBudget?: number;
  /** Fixed allowance for developer instructions and response framing. */
  contextSafetyTokens?: number;
}

const bootstrap: Shape<Record<string, unknown>> = {
  name: "astral_bootstrap",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

const shape = <T extends object>(value: StrictShape<T>): Shape<T> => ({
  name: value.name,
  schema: value.schema,
  ...(value.parse === undefined ? {} : { parse: value.parse }),
});

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const positive = (value: number | undefined, fallback: number, name: string): number => {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1) throw new Error(`${name} must be a positive integer`);
  return selected;
};

const outputText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(outputText).filter(Boolean).join("\n");
  if (!record(value)) return "";
  if (typeof value["text"] === "string") return value["text"];
  const output = value["output"];
  if (output !== undefined) return outputText(output);
  const content = value["content"];
  if (content !== undefined) return outputText(content);
  return "";
};

const responseError = (cause: unknown): { id: string; incomplete: boolean } | null => {
  if (!record(cause)) return null;
  const id = cause["responseId"];
  const status = cause["responseStatus"];
  return typeof id === "string" && id.length > 0
    ? { id, incomplete: status === "incomplete" }
    : null;
};

const errorText = (cause: unknown, depth = 0): string => {
  if (depth > 5 || cause === null || cause === undefined) return "";
  if (typeof cause === "string") return cause;
  if (cause instanceof Error) return `${cause.name}: ${cause.message}\n${errorText(cause.cause, depth + 1)}`;
  if (!record(cause)) return String(cause);
  const parts = Object.entries(cause).flatMap(([key, value]) => {
    if (!["message", "error", "cause", "detail", "details", "body"].includes(key)) return [];
    return [errorText(value, depth + 1)];
  });
  return parts.join("\n");
};

/** True only for model input/history capacity failures, not output truncation. */
export const contextWindowFailure = (cause: unknown): boolean =>
  /(?:input|request|prompt|conversation|context).{0,80}(?:exceeds?|too large|too long|maximum).{0,40}context|context window|maximum context length|too many (?:input )?tokens/iu
    .test(errorText(cause));

const jsonLength = (value: unknown): number => {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const embeddedSnapshotTokens = (value: unknown, depth = 0): number => {
  if (depth > 8 || value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + embeddedSnapshotTokens(item, depth + 1), 0);
  }
  if (typeof value === "string") {
    if (!value.includes("snapshotTokenEstimate")) return 0;
    try {
      return embeddedSnapshotTokens(JSON.parse(value), depth + 1);
    } catch {
      return 0;
    }
  }
  if (!record(value)) return 0;
  const direct = value["snapshotTokenEstimate"];
  const own = typeof direct === "number" && Number.isFinite(direct) && direct > 0
    ? Math.ceil(direct)
    : 0;
  return own + Object.entries(value)
    .filter(([key]) => key !== "snapshotTokenEstimate")
    .reduce((total, [, child]) => total + embeddedSnapshotTokens(child, depth + 1), 0);
};

/** Conservative estimate; JSON is intentionally budgeted at three code units per token. */
export const estimateContextTokens = (input: unknown): number => {
  const length = jsonLength(input);
  if (!Number.isSafeInteger(length)) return Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.ceil(length / 3)) + embeddedSnapshotTokens(input);
};

const snapshotIdentity = (value: unknown): Record<string, unknown> => {
  if (!record(value)) return { omitted: true };
  return {
    omitted: true,
    ...(typeof value["revision"] === "number" ? { revision: value["revision"] } : {}),
    ...(typeof value["sha256"] === "string" ? { sha256: value["sha256"] } : {}),
  };
};

const parsedInputText = (value: unknown): Record<string, unknown> | null => {
  if (!record(value) || value["type"] !== "input_text" || typeof value["text"] !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value["text"]);
    return record(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Remove only the shared chart snapshot while retaining the complete unit input.
 * This is the final fallback when the snapshot alone cannot fit a model window.
 */
export const compactSnapshotInput = (value: unknown): unknown => {
  if (record(value) && record(value["snapshot"]) && "input" in value) {
    return {
      snapshotContext: snapshotIdentity(value["snapshot"]),
      input: value["input"],
    };
  }

  if (!Array.isArray(value)) return value;
  for (const message of value) {
    if (!record(message) || !Array.isArray(message["content"])) continue;
    for (const item of message["content"]) {
      const parsed = parsedInputText(item);
      if (parsed === null || !("input" in parsed)) continue;
      return {
        snapshotContext: {
          omitted: true,
          ...(typeof parsed["snapshotRevision"] === "number" ? { revision: parsed["snapshotRevision"] } : {}),
          ...(typeof parsed["snapshotSha256"] === "string" ? { sha256: parsed["snapshotSha256"] } : {}),
        },
        input: parsed["input"],
      };
    }
  }
  return value;
};

const outputAllowance = (options: Parameters<SchemaClient["run"]>[2]): number => {
  const value = options.body["max_output_tokens"];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.ceil(value) : 4_096;
};

interface PreparedInput {
  input: unknown;
  tokens: number;
  compacted: boolean;
}

class OpenAISchemaClient implements SchemaClient {
  #client: OpenAISchema<Record<string, unknown>>;
  readonly #instructions: string;
  readonly #metadata: Record<string, string>;
  readonly #apiKey: string;
  readonly #base: string;
  readonly #fetcher: typeof fetch;
  readonly #runtimeBase: string | undefined;
  readonly #budget: number;
  readonly #safety: number;
  #usedTokens = 0;

  constructor(options: OpenAISchemaRuntimeOptions, conversationId?: string) {
    this.#instructions = options.instructions;
    this.#metadata = { ...(options.metadata ?? {}) };
    this.#apiKey = options.apiKey;
    this.#runtimeBase = options.base;
    this.#base = (options.base ?? "https://api.openai.com/v1").replace(/\/+$/u, "");
    this.#fetcher = createOpenAITransport({
      ...(options.transport ?? {}),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    this.#budget = positive(options.contextTokenBudget, 60_000, "OpenAI context token budget");
    this.#safety = positive(options.contextSafetyTokens, 1_024, "OpenAI context safety allowance");
    this.#client = this.#create(conversationId);
  }

  #create(conversationId?: string): OpenAISchema<Record<string, unknown>> {
    return new OpenAISchema(
      this.#apiKey,
      bootstrap,
      conversationId,
      {
        ...(this.#runtimeBase === undefined ? {} : { base: this.#runtimeBase }),
        fetch: this.#fetcher,
        conversation: true,
        name: "astral_bootstrap",
      },
    );
  }

  #rotate(): void {
    this.#client = this.#create();
    this.#usedTokens = 0;
  }

  #prepare(
    input: unknown,
    options: Parameters<SchemaClient["run"]>[2],
  ): PreparedInput {
    const allowance = outputAllowance(options) + this.#safety;
    let selected = input;
    let compacted = false;
    let tokens = estimateContextTokens(selected) + allowance;

    if (tokens > this.#budget) {
      const reduced = compactSnapshotInput(input);
      if (reduced !== input) {
        selected = reduced;
        compacted = true;
        tokens = estimateContextTokens(selected) + allowance;
      }
    }

    if (this.#usedTokens > 0 && this.#usedTokens + tokens > this.#budget) this.#rotate();
    return { input: selected, tokens, compacted };
  }

  get id(): string | undefined {
    return this.#client.id;
  }

  async uploadFile(name: string, content: string): Promise<UploadedFile> {
    const body = new FormData();
    body.set("purpose", "user_data");
    body.set("file", new Blob([content], { type: "application/json" }), name);
    const response = await this.#fetcher(`${this.#base}/files`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.#apiKey}` },
      body,
    });
    if (!response.ok) throw new Error(`OpenAI snapshot upload failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const value: unknown = await response.json();
    if (!record(value) || typeof value["id"] !== "string" || value["id"].length === 0) {
      throw new Error("OpenAI snapshot upload did not return a file id");
    }
    return { id: value["id"], name, purpose: "user_data" };
  }

  async deleteFile(id: string): Promise<void> {
    if (id.length === 0) throw new Error("OpenAI file id is required");
    const response = await this.#fetcher(`${this.#base}/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.#apiKey}` },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`OpenAI snapshot deletion failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    }
    await response.body?.cancel();
  }

  async retrieveResponse(id: string): Promise<unknown> {
    const response = await this.#fetcher(`${this.#base}/responses/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${this.#apiKey}` },
    });
    if (!response.ok) throw new Error(`OpenAI response retrieval failed with HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }

  async #run<T extends object>(
    value: StrictShape<T>,
    input: unknown,
    options: Parameters<SchemaClient["run"]>[2],
  ): Promise<T> {
    return this.#client.run(
      shape(value),
      input,
      {
        ...options,
        body: {
          ...options.body,
          instructions: this.#instructions,
          metadata: this.#metadata,
        },
      },
    );
  }

  async run<T extends object>(
    value: StrictShape<T>,
    originalInput: unknown,
    options: Parameters<SchemaClient["run"]>[2],
  ): Promise<T> {
    let input = originalInput;
    let compacted = false;
    let contextFailures = 0;

    for (;;) {
      const prepared = this.#prepare(input, options);
      input = prepared.input;
      compacted ||= prepared.compacted;

      try {
        const result = await this.#run(value, input, options);
        this.#usedTokens += prepared.tokens;
        return result;
      } catch (cause: unknown) {
        const response = responseError(cause);
        if (response?.incomplete === true) {
          try {
            const partial = outputText(await this.retrieveResponse(response.id));
            if (partial.length > 0 && record(cause)) cause["rawText"] = partial;
          } catch {
            // The original transport failure remains authoritative when retrieval is unavailable.
          }
        }

        if (!contextWindowFailure(cause)) throw cause;
        contextFailures += 1;

        if (contextFailures === 1) {
          // A recovered or underestimated conversation may already contain more
          // history than this process can count. Retry the same unit once in a
          // fresh conversation with the complete snapshot.
          this.#rotate();
          continue;
        }

        if (!compacted) {
          const reduced = compactSnapshotInput(originalInput);
          if (reduced !== originalInput) {
            input = reduced;
            compacted = true;
            this.#rotate();
            continue;
          }
        }

        // A unit-only request that still exceeds the model window is a genuine
        // model/configuration incompatibility rather than accumulated history.
        throw cause;
      }
    }
  }
}

export const createOpenAISchemaClientFactory = (
  options: OpenAISchemaRuntimeOptions,
): SchemaClientFactory => {
  if (options.apiKey.trim().length === 0) throw new Error("OpenAI API key is required");
  if (options.instructions.trim().length === 0) throw new Error("OpenAI developer instructions are required");
  return (conversationId) => new OpenAISchemaClient(options, conversationId);
};
