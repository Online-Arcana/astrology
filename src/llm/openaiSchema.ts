import { OpenAISchema, type StrictSchema } from "openai-schema";
import type { SchemaClient, SchemaClientFactory, StrictShape } from "./orchestrate/types.js";

export interface OpenAISchemaRuntimeOptions {
  apiKey: string;
  instructions: string;
  metadata?: Record<string, string>;
  baseURL?: string;
  fetch?: typeof fetch;
}

const bootstrap: StrictSchema<Record<string, unknown>> = {
  name: "astral_bootstrap",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

const schema = <T extends object>(shape: StrictShape<T>): StrictSchema<T> => ({
  name: shape.name,
  schema: shape.schema,
  ...(shape.parse === undefined ? {} : { parse: shape.parse }),
});

class OpenAISchemaClient implements SchemaClient {
  readonly #client: OpenAISchema<Record<string, unknown>>;

  constructor(options: OpenAISchemaRuntimeOptions) {
    this.#client = new OpenAISchema(bootstrap, {
      apiKey: options.apiKey,
      instructions: options.instructions,
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
      ...(options.baseURL === undefined ? {} : { baseURL: options.baseURL }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
  }

  get id(): string | undefined {
    return this.#client.id;
  }

  async run<T extends object>(
    shape: StrictShape<T>,
    input: unknown,
    options: Parameters<SchemaClient["run"]>[2],
  ): Promise<T> {
    return this.#client.run(schema(shape), input, options);
  }
}

export const createOpenAISchemaClientFactory = (
  options: OpenAISchemaRuntimeOptions,
): SchemaClientFactory => {
  if (options.apiKey.trim().length === 0) throw new Error("OpenAI API key is required");
  if (options.instructions.trim().length === 0) throw new Error("OpenAI developer instructions are required");
  return () => new OpenAISchemaClient(options);
};
