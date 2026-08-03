import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BillCollector, billingSummary } from "../src/billing/bill.js";
import { priceUsage } from "../src/billing/pricing.js";
import { BillStore } from "../src/billing/store.js";
import type { ResponseUsage } from "../src/billing/types.js";
import { createOpenAISchemaClientFactory } from "../src/llm/openaiSchema.js";
import type { StrictShape } from "../src/llm/orchestrate/types.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const near = (actual: number, expected: number, message: string): void => {
  if (Math.abs(actual - expected) > 1e-12) throw new Error(`${message}: expected ${expected}, got ${actual}`);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const usage = (model: string, clientId: string, input = 1_000, cached = 200, output = 300): ResponseUsage => ({
  responseId: `resp-${clientId}`,
  model,
  shape: "fixture",
  clientId,
  conversationId: `conv-${clientId}`,
  purpose: "primary",
  at: "2026-08-03T12:00:00.000Z",
  usage: {
    inputTokens: input,
    cachedInputTokens: cached,
    outputTokens: output,
    reasoningTokens: 50,
    totalTokens: input + output,
  },
});

await test("official catalogue prices uncached cached and output tokens", () => {
  near(priceUsage("gpt-5.4-nano", usage("gpt-5.4-nano", "a").usage) ?? -1, 0.000539, "nano price");
  near(priceUsage("gpt-5.4-mini-2026-03-17", usage("gpt-5.4-mini", "b").usage) ?? -1, 0.001965, "dated mini price");
  equal(priceUsage("unknown-model", usage("unknown-model", "c").usage), null, "unknown model is unpriced");
});

await test("collector groups usage by model and lane", () => {
  const collector = new BillCollector(`sha256:${"1".repeat(64)}`, null, () => "2026-08-03T12:00:00.000Z");
  collector.add(usage("gpt-5.4-nano", "lane-1"));
  collector.add(usage("gpt-5.4-mini", "lane-2", 2_000, 0, 500));
  const bill = collector.finish("completed", "2026-08-03T12:01:00.000Z");
  equal(bill.total.requests, 2, "request count");
  equal(bill.total.totalTokens, 3_800, "total tokens");
  equal(bill.byModel.length, 2, "model groups");
  equal(bill.byLane.length, 2, "lane groups");
  equal(bill.pricing.complete, true, "pricing complete");
});

await test("bill store persists history and computes completed average", async () => {
  const dir = await mkdtemp(join(tmpdir(), "astral-bills-"));
  try {
    const store = new BillStore(dir);
    const first = new BillCollector(`sha256:${"2".repeat(64)}`, null, () => "2026-08-03T12:00:00.000Z");
    first.add(usage("gpt-5.4-nano", "lane-1"));
    const firstBill = first.finish("completed", "2026-08-03T12:01:00.000Z");
    const second = new BillCollector(`sha256:${"3".repeat(64)}`, null, () => "2026-08-03T13:00:00.000Z");
    second.add(usage("gpt-5.4-nano", "lane-1"));
    const secondBill = second.finish("failed", "2026-08-03T13:01:00.000Z");
    await store.save(firstBill);
    await store.save(secondBill);
    const summary = await store.summary();
    equal(summary.bills, 2, "saved bill count");
    equal(summary.completedBills, 1, "completed bill count");
    equal(summary.failedBills, 1, "failed bill count");
    near(summary.averageCompletedChartCostUsd ?? -1, firstBill.total.costUsd ?? -2, "completed average");
    equal(billingSummary(await store.list()).bills, 2, "reloaded bill count");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("OpenAI schema runtime emits authoritative response usage", async () => {
  const events: ResponseUsage[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/conversations")) {
      return new Response(JSON.stringify({ id: "conv_usage" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      id: "resp_usage",
      model: "gpt-5.4-nano-2026-03-17",
      status: "completed",
      usage: {
        input_tokens: 321,
        input_tokens_details: { cached_tokens: 123 },
        output_tokens: 45,
        output_tokens_details: { reasoning_tokens: 12 },
        total_tokens: 366,
      },
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ value: "fixed" }) }],
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createOpenAISchemaClientFactory({
    apiKey: "test-key",
    instructions: "test",
    base: "https://example.invalid/v1",
    fetch: fakeFetch,
    onUsage: (event) => events.push(event),
    transport: { background: false },
  })();
  const shape: StrictShape<{ value: string }> = {
    name: "usage_fixture",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { value: { type: "string" } },
      required: ["value"],
    },
    parse: (value) => value as { value: string },
  };
  await client.run(shape, { field: "fixture" }, { body: { model: "gpt-5.4-nano", store: false } });
  equal(events.length, 1, "usage event count");
  equal(events[0]?.usage.inputTokens, 321, "input tokens");
  equal(events[0]?.usage.cachedInputTokens, 123, "cached input tokens");
  equal(events[0]?.usage.reasoningTokens, 12, "reasoning tokens");
  equal(events[0]?.shape, "usage_fixture", "shape attribution");
});

console.log(`1..${passed}`);
