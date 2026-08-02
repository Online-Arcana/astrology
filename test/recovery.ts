import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig } from "../src/config.js";
import { TemporaryJobStore, temporaryJobIdPattern } from "../src/job/recovery.js";
import { createOpenAISchemaClientFactory } from "../src/llm/openaiSchema.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import type {
  InterpretationCall,
  InterpretationCheckpoint,
  InterpretationRecovery,
  SchemaCall,
  SchemaClient,
  StrictShape,
} from "../src/llm/orchestrate/types.js";
import { object, strictShape, text } from "../src/llm/schema/build.js";
import type { ChartJobStatus, ChartProgress } from "../src/types/progress.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const progress = (status: ChartJobStatus, jobId = "pending"): ChartProgress => ({
  jobId,
  status,
  stage: { id: status, label: status },
  unit: {
    id: null,
    label: null,
    zodiac: null,
    section: null,
    domain: null,
  },
  progress: {
    completed: status === "completed" ? 1 : 0,
    total: 1,
    percent: status === "completed" ? 100 : 0,
  },
  timing: {
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    elapsedSeconds: 0,
    estimatedRemainingSeconds: null,
    estimatedCompletionAt: null,
  },
  model: { role: null, name: null },
  attempt: { current: 1, maximum: 3 },
  error: null,
});

await test("temporary recovery IDs persist across a server restart and disappear on completion", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astral-recovery-"));
  try {
    const first = new TemporaryJobStore<{ step: number }>(directory, 60);
    const created = await first.create(progress("queued"), { step: 0 }, 1_000);
    assert(temporaryJobIdPattern.test(created.id), "job ID must contain eight hexadecimal characters");
    equal(created.progress.jobId, created.id, "progress job ID");
    equal(created.conversationId, null, "new job conversation ID");

    const saved = await first.save(
      created.id,
      "conv_recovery",
      progress("interpreting"),
      { step: 4 },
      2_000,
    );
    assert(saved !== null, "incomplete job must remain recoverable");
    equal(saved.conversationId, "conv_recovery", "saved conversation ID");

    const restarted = new TemporaryJobStore<{ step: number }>(directory, 60);
    const loaded = await restarted.get(created.id, 2_500);
    assert(loaded !== null, "job must survive a store instance restart");
    equal(loaded.state.step, 4, "saved recovery state");
    equal(loaded.progress.status, "interpreting", "saved progress");

    const completed = await restarted.save(
      created.id,
      "conv_recovery",
      progress("completed"),
      { step: 5 },
      3_000,
    );
    equal(completed, null, "completion must not retain a recovery record");
    equal(await restarted.get(created.id, 3_001), null, "completed recovery ID must be deleted");

    const expiring = await restarted.create(progress("failed"), { step: 2 }, 4_000);
    equal(await restarted.get(expiring.id, 64_000), null, "expired recovery ID must be deleted");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

await test("openai-schema reopens an existing conversation without creating a second one", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    requests.push({ url, body });
    if (url.endsWith("/conversations")) throw new Error("resume must not create another conversation");
    return new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ value: "resumed" }) }],
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const factory = createOpenAISchemaClientFactory({
    apiKey: "test-key",
    instructions: "Return only the requested field.",
    base: "https://example.invalid/v1",
    fetch: fakeFetch,
  });
  const client = factory("conv_existing");
  const shape: StrictShape<{ value: string }> = {
    name: "resume_fixture",
    schema: object({ value: text() }),
    parse: (value) => value as { value: string },
  };
  const result = await client.run(shape, {}, {
    body: { model: "gpt-test", store: false },
    retries: 0,
  });

  equal(result.value, "resumed", "resumed output");
  equal(requests.length, 1, "resume request count");
  equal(requests[0]?.url.endsWith("/responses"), true, "resume endpoint");
  equal(
    (requests[0]?.body["conversation"] as { id?: string }).id,
    "conv_existing",
    "resumed conversation body",
  );
});

const valueShape = strictShape<{ value: string }>(
  "recovery_value",
  object({ value: text() }),
) as unknown as StrictShape<object>;

const call = (id: string): InterpretationCall => ({
  id,
  label: id,
  kind: "small",
  effort: "none",
  tokens: 64,
  shape: valueShape,
  allowedSourceRefs: new Set(),
  input: ({ earlier, correction }) => ({ earlier, correction }),
  audit: (value) => {
    const candidate = value as { value?: unknown };
    const valid = typeof candidate.value === "string" && candidate.value.length > 0;
    return { valid, value, errors: valid ? [] : [`${id} requires value`] };
  },
});

await test("interpretation resumes the first unfinished field in the same conversation", async () => {
  const calls = [call("first"), call("second"), call("third")];
  const recovery: InterpretationRecovery = {
    conversationId: "conv_existing",
    units: {
      first: {
        id: "first",
        value: { value: "accepted first field" },
        attempts: 1,
        model: "gpt-5.4-nano",
      },
    },
    calls: 1,
    retries: 0,
    active: {
      id: "second",
      attempt: 2,
      correction: ["second requires value"],
    },
  };

  const seenInputs: unknown[] = [];
  const checkpoints: InterpretationCheckpoint[] = [];
  let suppliedConversation: string | undefined;
  let sequence = 0;

  class ResumeClient implements SchemaClient {
    readonly id = "conv_existing";

    async run<T extends object>(
      _shape: StrictShape<T>,
      input: unknown,
      _options: SchemaCall,
    ): Promise<T> {
      seenInputs.push(input);
      sequence += 1;
      return { value: sequence === 1 ? "accepted second field" : "accepted third field" } as T;
    }
  }

  const result = await runInterpretation(
    {},
    calls,
    readConfig({}),
    (conversationId) => {
      suppliedConversation = conversationId;
      return new ResumeClient();
    },
    {
      onCheckpoint: (checkpoint) => {
        checkpoints.push(checkpoint);
      },
    },
    recovery,
  );

  equal(suppliedConversation, "conv_existing", "factory recovery conversation ID");
  equal(seenInputs.length, 2, "only unfinished fields should call OpenAI");
  equal(result.units["first"]?.attempts, 1, "recovered field retained");
  equal(result.units["second"]?.attempts, 2, "active attempt resumed");
  equal(result.units["third"]?.attempts, 1, "later field completed normally");
  equal(result.calls, 3, "recovered and resumed call count");
  assert(checkpoints.length >= 4, "resume must emit durable checkpoints");
  equal(checkpoints.at(-1)?.active, null, "final interpretation checkpoint must have no active field");
  equal(Object.keys(checkpoints.at(-1)?.units ?? {}).length, 3, "final checkpoint accepted units");

  const secondInput = seenInputs[0] as { correction?: readonly string[] };
  equal(secondInput.correction?.[0], "second requires value", "recovered correction context");
});

console.log(`1..${passed}`);
