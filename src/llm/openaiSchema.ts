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

class OpenAISchemaClient implements SchemaClient {
  readonly #client: OpenAISchema<Record<string, unknown>>;
  readonly #instructions: string;
  readonly #metadata: Record<string, string>;
  readonly #apiKey: string;
  readonly #base: string;
  readonly #fetcher: typeof fetch;

  constructor(options: OpenAISchemaRuntimeOptions, conversationId?: string) {
    this.#instructions = options.instructions;
    this.#metadata = { ...(options.metadata ?? {}) };
    this.#apiKey = options.apiKey;
    this.#base = (options.base ?? "https://api.openai.com/v1").replace(/\/+$/u, "");
    this.#fetcher = createOpenAITransport({
      ...(options.transport ?? {}),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    this.#client = new OpenAISchema(
      options.apiKey,
      bootstrap,
      conversationId,
      {
        ...(options.base === undefined ? {} : { base: options.base }),
        fetch: this.#fetcher,
        conversation: true,
        name: "astral_bootstrap",
      },
    );
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

  async run<T extends object>(
    value: StrictShape<T>,
    input: unknown,
    options: Parameters<SchemaClient["run"]>[2],
  ): Promise<T> {
    try {
      return await this.#client.run(
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
      throw cause;
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
