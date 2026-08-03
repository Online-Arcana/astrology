import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenAITransport,
} from "../src/llm/openaiTransport.js";

type Dict = Record<string, unknown>;

const response = (
  value: unknown,
  status = 200,
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

test(
  "a stalled background response is cancelled and recreated",
  async () => {
    let posts = 0;
    let polls = 0;
    let cancels = 0;
    const idempotency: string[] = [];

    const fake: typeof fetch = async (
      input,
      init,
    ) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (
        method === "POST"
        && url.endsWith("/cancel")
      ) {
        cancels += 1;
        return response({ cancelled: true });
      }

      if (method === "POST") {
        posts += 1;
        idempotency.push(
          new Headers(init?.headers)
            .get("idempotency-key")
          ?? "",
        );

        return response({
          id: `resp_${posts}`,
          status: "queued",
        });
      }

      polls += 1;

      if (url.includes("resp_1")) {
        return response({
          id: "resp_1",
          status: "in_progress",
        });
      }

      return response({
        id: "resp_2",
        status: "completed",
        output_text: JSON.stringify({
          value: "recovered",
        }),
      });
    };

    const fetcher = createOpenAITransport({
      fetch: fake,
      pollIntervalMs: 1,
      pollTimeoutMs: 5,
      createTimeoutMs: 100,
      responseAttempts: 2,
      retryAttempts: 2,
      retryDelayMs: 1,
    });

    const result = await fetcher(
      "https://example.invalid/v1/responses",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-test",
        }),
      },
    );

    const value = await result.json() as Dict;

    assert.equal(value["status"], "completed");
    assert.equal(posts, 2);
    assert.equal(cancels, 1);
    assert.ok(polls >= 2);
    assert.ok(idempotency[0]);
    assert.ok(idempotency[1]);
    assert.notEqual(
      idempotency[0],
      idempotency[1],
    );
  },
);
