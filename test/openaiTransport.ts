import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAITransportError,
  createOpenAITransport,
} from "../src/llm/openaiTransport.js";
import {
  createOpenAISchemaClientFactory,
} from "../src/llm/openaiSchema.js";
import type {
  StrictShape,
} from "../src/llm/orchestrate/types.js";

type Dict = Record<string, unknown>;

const response = (
  value: unknown,
  status = 200,
  inputHeaders: HeadersInit = {},
): Response => {
  const headers = new Headers(inputHeaders);
  headers.set(
    "content-type",
    "application/json",
  );

  return new Response(
    typeof value === "string"
      ? value
      : JSON.stringify(value),
    {
      status,
      headers,
    },
  );
};

test(
  "background polling survives transient transport failures",
  async () => {
    const calls: Array<{
      method: string;
      url: string;
      body: Dict | null;
    }> = [];

    let polls = 0;

    const fake: typeof fetch = async (
      input,
      init,
    ) => {
      const method = init?.method ?? "GET";

      const body =
        typeof init?.body === "string"
          ? JSON.parse(init.body) as Dict
          : null;

      calls.push({
        method,
        url: String(input),
        body,
      });

      if (method === "POST") {
        assert.equal(
          body?.["background"],
          true,
        );

        return response({
          id: "resp_fixture",
          status: "queued",
        });
      }

      polls += 1;

      if (polls === 1) {
        throw new TypeError("fetch failed");
      }

      if (polls === 2) {
        return response(
          { error: "busy" },
          503,
          { "retry-after": "0" },
        );
      }

      if (polls === 3) {
        return response({
          id: "resp_fixture",
          status: "in_progress",
        });
      }

      return response({
        id: "resp_fixture",
        status: "completed",
        output_text: JSON.stringify({
          value: "ok",
        }),
      });
    };

    const fetcher = createOpenAITransport({
      fetch: fake,
      pollIntervalMs: 1,
      pollTimeoutMs: 1_000,
      retryAttempts: 5,
      retryDelayMs: 1,
    });

    const result = await fetcher(
      "https://example.invalid/v1/responses",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test",
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          model: "gpt-test",
          background: false,
        }),
      },
    );

    const value = await result.json() as Dict;

    assert.equal(
      value["status"],
      "completed",
    );

    assert.equal(polls, 4);
    assert.equal(
      calls[0]?.method,
      "POST",
    );

    assert.equal(
      calls.at(-1)?.url,
      [
        "https://example.invalid",
        "/v1/responses/resp_fixture",
      ].join(""),
    );
  },
);

test(
  "schema client uses resilient background transport",
  async () => {
    const responseBodies: Dict[] = [];
    let polls = 0;

    const fake: typeof fetch = async (
      input,
      init,
    ) => {
      const url = String(input);

      if (url.endsWith("/conversations")) {
        return response({ id: "conv_fixture" });
      }

      if (init?.method === "POST") {
        const body = JSON.parse(
          String(init.body),
        ) as Dict;

        responseBodies.push(body);

        return response({
          id: "resp_schema",
          status: "queued",
        });
      }

      polls += 1;

      return response(
        polls === 1
          ? {
              id: "resp_schema",
              status: "in_progress",
            }
          : {
              id: "resp_schema",
              status: "completed",
              output_text: JSON.stringify({
                value: "fixed",
              }),
            },
      );
    };

    const factory =
      createOpenAISchemaClientFactory({
        apiKey: "test-key",
        instructions:
          "Return only the schema.",
        base:
          "https://example.invalid/v1",
        fetch: fake,
        transport: {
          pollIntervalMs: 1,
          pollTimeoutMs: 1_000,
          retryAttempts: 2,
          retryDelayMs: 1,
        },
      });

    const shape: StrictShape<{
      value: string;
    }> = {
      name: "fixture",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string" },
        },
        required: ["value"],
      },
      parse: (value) =>
        value as { value: string },
    };

    const client = factory();

    const result = await client.run(
      shape,
      { field: "fixture" },
      {
        body: {
          model: "gpt-test",
          store: false,
        },
        retries: 0,
      },
    );

    assert.deepEqual(
      result,
      { value: "fixed" },
    );

    assert.equal(
      responseBodies[0]?.["background"],
      true,
    );

    assert.deepEqual(
      responseBodies[0]?.["conversation"],
      { id: "conv_fixture" },
    );
  },
);

test(
  "terminal background failures retain response identity",
  async () => {
    const fake: typeof fetch = async () =>
      response({
        id: "resp_failed",
        status: "failed",
        error: {
          message:
            "upstream execution failed",
        },
      });

    const fetcher = createOpenAITransport({
      fetch: fake,
    });

    await assert.rejects(
      () => fetcher(
        "https://example.invalid/v1/responses",
        {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-test",
          }),
        },
      ),
      (error: unknown) => {
        assert.equal(
          error instanceof OpenAITransportError,
          true,
        );

        const value =
          error as OpenAITransportError;

        assert.equal(
          value.responseId,
          "resp_failed",
        );

        assert.equal(
          value.responseStatus,
          "failed",
        );

        assert.match(
          value.message,
          /upstream execution failed/u,
        );

        return true;
      },
    );
  },
);
