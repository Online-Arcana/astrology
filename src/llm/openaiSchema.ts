import { OpenAISchema, type Shape } from "openai-schema";
import {
  createOpenAITransport,
  type OpenAITransportOptions,
} from "./openaiTransport.js";
import type {
  SchemaClient,
  SchemaClientFactory,
  StrictShape,
} from "./orchestrate/types.js";

export interface OpenAISchemaRuntimeOptions {
  apiKey: string;
  instructions: string;
  metadata?: Record<string, string>;
  base?: string;
  fetch?: typeof fetch;
  transport?: Omit<
    OpenAITransportOptions,
    "fetch"
  >;
}

const bootstrap: Shape<
  Record<string, unknown>
> = {
  name: "astral_bootstrap",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

const shape = <T extends object>(
  value: StrictShape<T>,
): Shape<T> => ({
  name: value.name,
  schema: value.schema,
  ...(value.parse === undefined
    ? {}
    : { parse: value.parse }),
});

class OpenAISchemaClient
implements SchemaClient {
  readonly #client: OpenAISchema<
    Record<string, unknown>
  >;

  readonly #instructions: string;
  readonly #metadata: Record<string, string>;

  constructor(
    options: OpenAISchemaRuntimeOptions,
    conversationId?: string,
  ) {
    this.#instructions = options.instructions;
    this.#metadata = {
      ...(options.metadata ?? {}),
    };

    const fetcher = createOpenAITransport({
      ...(options.transport ?? {}),
      ...(options.fetch === undefined
        ? {}
        : { fetch: options.fetch }),
    });

    this.#client = new OpenAISchema(
      options.apiKey,
      bootstrap,
      conversationId,
      {
        ...(options.base === undefined
          ? {}
          : { base: options.base }),

        fetch: fetcher,
        conversation: true,
        name: "astral_bootstrap",
      },
    );
  }

  get id(): string | undefined {
    return this.#client.id;
  }

  async run<T extends object>(
    value: StrictShape<T>,
    input: unknown,
    options: Parameters<
      SchemaClient["run"]
    >[2],
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
}

export const createOpenAISchemaClientFactory = (
  options: OpenAISchemaRuntimeOptions,
): SchemaClientFactory => {
  if (options.apiKey.trim().length === 0) {
    throw new Error(
      "OpenAI API key is required",
    );
  }

  if (options.instructions.trim().length === 0) {
    throw new Error(
      "OpenAI developer instructions are required",
    );
  }

  return (conversationId) =>
    new OpenAISchemaClient(
      options,
      conversationId,
    );
};
