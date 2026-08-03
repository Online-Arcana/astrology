import assert from "node:assert/strict";
import test from "node:test";
import {
  compactSnapshotInput,
  contextWindowFailure,
  createOpenAISchemaClientFactory,
  estimateContextTokens,
} from "../src/llm/openaiSchema.js";
import type { SchemaCall, StrictShape } from "../src/llm/orchestrate/types.js";

const shape: StrictShape<{ value: string }> = {
  name: "context_fixture",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: { value: { type: "string" } },
    required: ["value"],
  },
  parse: (value) => value as { value: string },
};

const options: SchemaCall = {
  body: {
    model: "gpt-test",
    store: false,
    max_output_tokens: 20,
  },
  retries: 0,
};

const completed = (value = "fixed"): Response => new Response(JSON.stringify({
  output: [{
    type: "message",
    content: [{ type: "output_text", text: JSON.stringify({ value }) }],
  }],
}), {
  status: 200,
  headers: { "content-type": "application/json" },
});

const conversation = (id: string): Response => new Response(JSON.stringify({ id }), {
  status: 200,
  headers: { "content-type": "application/json" },
});

test("context guards recognise the provider capacity error", () => {
  assert.equal(contextWindowFailure(new Error(
    "Your input exceeds the context window of this model. Please adjust your input and try again.",
  )), true);
  assert.equal(contextWindowFailure(new Error("The response was incomplete")), false);
});

test("snapshot compaction keeps the unit input and removes shared history", () => {
  const original = {
    snapshot: {
      revision: 4,
      sha256: "sha256:fixture",
      units: { old: { value: "x".repeat(20_000) } },
    },
    input: { unit: "tropical.aspect.fixture", deterministicData: { value: 7 } },
  };
  const compact = compactSnapshotInput(original) as {
    snapshotContext: { omitted: boolean; revision: number; sha256: string };
    input: { unit: string };
  };
  assert.equal(compact.snapshotContext.omitted, true);
  assert.equal(compact.snapshotContext.revision, 4);
  assert.equal(compact.snapshotContext.sha256, "sha256:fixture");
  assert.equal(compact.input.unit, "tropical.aspect.fixture");
  assert.ok(estimateContextTokens(compact) < estimateContextTokens(original));
});

test("a lane rotates before its estimated conversation budget is exceeded", async () => {
  let conversations = 0;
  const responseConversations: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/conversations")) return conversation(`conv-${conversations += 1}`);
    if (url.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body)) as { conversation?: { id?: string } };
      responseConversations.push(body.conversation?.id ?? "none");
      return completed();
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createOpenAISchemaClientFactory({
    apiKey: "test-key",
    instructions: "Return the schema.",
    fetch: fakeFetch,
    transport: { background: false },
    contextTokenBudget: 150,
    contextSafetyTokens: 1,
  })();

  const input = { text: "x".repeat(180) };
  await client.run(shape, input, options);
  await client.run(shape, input, options);

  assert.equal(conversations, 2);
  assert.equal(responseConversations.length, 2);
  assert.notEqual(responseConversations[0], responseConversations[1]);
});

test("a provider context rejection retries the unit in a fresh conversation", async () => {
  let conversations = 0;
  let responses = 0;
  const used: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/conversations")) return conversation(`ctx-${conversations += 1}`);
    if (url.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body)) as { conversation?: { id?: string } };
      used.push(body.conversation?.id ?? "none");
      responses += 1;
      if (responses === 1) {
        return new Response(JSON.stringify({
          id: "resp-context",
          status: "failed",
          error: { message: "Your input exceeds the context window of this model." },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return completed("recovered");
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createOpenAISchemaClientFactory({
    apiKey: "test-key",
    instructions: "Return the schema.",
    fetch: fakeFetch,
    contextTokenBudget: 60_000,
  })("old-overgrown-conversation");

  const result = await client.run(shape, { unit: "fixture" }, options);
  assert.equal(result.value, "recovered");
  assert.equal(responses, 2);
  assert.equal(conversations, 1, "only the fresh replacement conversation is created locally");
  assert.equal(used[0], "old-overgrown-conversation");
  assert.notEqual(used[0], used[1]);
});

test("a snapshot that cannot fit is omitted before the request is sent", async () => {
  let sentInput = "";
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/conversations")) return conversation("compact-conversation");
    if (url.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body)) as { input?: string };
      sentInput = body.input ?? "";
      return completed();
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createOpenAISchemaClientFactory({
    apiKey: "test-key",
    instructions: "Return the schema.",
    fetch: fakeFetch,
    transport: { background: false },
    contextTokenBudget: 100,
    contextSafetyTokens: 1,
  })();

  await client.run(shape, {
    snapshot: {
      revision: 9,
      sha256: "sha256:large",
      units: { prior: { value: "history".repeat(5_000) } },
    },
    input: { unit: "current", deterministicData: { value: 42 } },
  }, options);

  assert.equal(sentInput.includes("historyhistory"), false);
  assert.equal(sentInput.includes("snapshotContext"), true);
  assert.equal(sentInput.includes("deterministicData"), true);
});
