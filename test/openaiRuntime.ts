import { generatedChartName } from "../src/name/generate.js";
import { createOpenAISchemaClientFactory } from "../src/llm/openaiSchema.js";
import { runInterpretationPlan } from "../src/llm/orchestrate/plan.js";
import { InterpretationRunner } from "../src/llm/orchestrate/run.js";
import type {
  SchemaClient,
  SchemaClientContext,
  SchemaClientFactory,
  StrictShape,
} from "../src/llm/orchestrate/types.js";
import type { JsonRef } from "../src/types/base.js";
import type { AstralCalculation } from "../src/types/file.js";

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

await test("pinned openai-schema client creates one conversation then runs strict output", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    requests.push({ url, body });
    if (url.endsWith("/conversations")) {
      return new Response(JSON.stringify({ id: "conv_fixture" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ value: "fixed" }) }],
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const factory = createOpenAISchemaClientFactory({
    apiKey: "test-key",
    instructions: "Base developer instruction",
    metadata: { service: "test" },
    baseURL: "https://example.invalid/v1",
    fetch: fakeFetch,
  });
  const client = factory({
    metadata: { calculation_fingerprint: "sha256:fixture" },
    developerMessage: "Write in English.",
  });
  const shape: StrictShape<{ value: string }> = {
    name: "fixture",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { value: { type: "string" } },
      required: ["value"],
    },
    parse: (value) => value as { value: string },
  };
  const result = await client.run(shape, { field: "fixture" }, { body: { model: "gpt-test" } });
  equal(result.value, "fixed", "structured result");
  equal(client.id, "conv_fixture", "conversation ID");
  equal(requests.length, 2, "OpenAI request count");
  equal(requests[0]?.url.endsWith("/conversations"), true, "conversation endpoint");
  equal(requests[1]?.url.endsWith("/responses"), true, "responses endpoint");
  equal(requests[1]?.body["conversation"], "conv_fixture", "shared conversation body");
  equal(requests[1]?.body["store"], false, "response storage disabled");
  const instructions = String(requests[1]?.body["instructions"]);
  equal(instructions.includes("Base developer instruction"), true, "base developer instruction");
  equal(instructions.includes("Write in English"), true, "per-chart developer instruction");
});

const exactRef = "#/astral-calculation/source" as JsonRef;
const unavailableRef = "#/astral-calculation/unavailable" as JsonRef;
const calculation = {
  schema: "astral-calculation/1.0.0",
  subject: { providedName: "Fixture", language: "en", adult: true },
  source: { status: "exact", value: { sign: "aries", meaning: "solar purpose" }, reason: "none" },
  unavailable: { status: "unavailable", value: null, reason: "birth_time_unknown" },
  interpretationPlan: {
    schema: "astral-interpretation-plan/1.0.0",
    units: [
      {
        id: "tropical.point.sun",
        zodiac: "tropical",
        section: "points.sun",
        domain: null,
        allowedSourceRefs: [exactRef],
      },
      {
        id: "tropical.point.ascendant",
        zodiac: "tropical",
        section: "points.ascendant",
        domain: null,
        allowedSourceRefs: [unavailableRef],
      },
      {
        id: "final-synthesis",
        zodiac: null,
        section: "finalSynthesis",
        domain: null,
        allowedSourceRefs: [exactRef],
      },
    ],
  },
  provenance: { calculationFingerprint: `sha256:${"1".repeat(64)}` },
} as unknown as AstralCalculation;

class FakeClient implements SchemaClient {
  readonly id = "conv_plan";
  readonly calls: string[] = [];

  async run<T extends object>(
    _shape: StrictShape<T>,
    input: unknown,
  ): Promise<T> {
    const field = (input as { field: string }).field;
    this.calls.push(field);
    if (field === "final-synthesis") {
      return {
        essence: "The astrological chart centres a clear solar purpose.",
        definingThemes: ["Purposeful planetary self-expression"],
        strongestAssets: ["Steady chart-based confidence"],
        recurringTensions: ["Balancing personal purpose with relationship needs"],
        relationshipPattern: "Relationships work best when the chart's directness is transparent.",
        sexualPattern: "Desire follows confidence, trust and explicit communication.",
        friendshipPattern: "Friendship grows through shared purpose and mutual encouragement.",
        vocationalPattern: "Planetary emphasis favours visible, purposeful work.",
        moneyPattern: "Material choices improve when they support the chart's central priorities.",
        developmentalArc: "Growth involves making solar purpose more collaborative and flexible.",
        closingPortrait: "This is a purposeful astrological portrait with room for relational balance.",
        sourceRefs: [exactRef],
      } as T;
    }
    return {
      status: "written",
      title: "Solar purpose",
      summary: "The solar chart placement emphasises purpose, identity and visible self-expression.",
      detail: "This planetary position supports direct action when personal aims remain connected to the wider chart pattern.",
      themes: ["Solar identity and purposeful expression"],
      strengths: ["Confident planetary initiative"],
      tensions: ["Over-identifying with one chart theme"],
      sourceRefs: [exactRef],
    } as T;
  }
}

await test("fixed plan runner uses one conversation and synthesises unavailable generic fields", async () => {
  const client = new FakeClient();
  let context: SchemaClientContext | null = null;
  const factory: SchemaClientFactory = (value) => {
    context = value;
    return client;
  };
  const runner = new InterpretationRunner(factory, {
    bigModel: "gpt-big",
    smallModel: "gpt-small",
    maxRetries: 1,
  });
  const run = await runInterpretationPlan(runner, calculation, {
    metadata: { chart: "fixture" },
    developerMessage: "Use English.",
  });
  equal(run.conversationId, "conv_plan", "plan conversation ID");
  equal(client.calls.join(","), "tropical.point.sun,final-synthesis", "only available units called");
  equal(run.units["tropical.point.ascendant"]?.model, "deterministic", "unavailable unit model");
  equal(
    (run.units["tropical.point.ascendant"]?.value as { status: string }).status,
    "unavailable",
    "unavailable unit status",
  );
  equal(context?.metadata["chart"], "fixture", "per-chart metadata");
  equal(context?.developerMessage, "Use English.", "per-chart instruction");
});

await test("generated chart names are deterministic and exactly three words", () => {
  const fingerprint = `sha256:${"1234abcd".repeat(8)}`;
  const first = generatedChartName(fingerprint);
  const second = generatedChartName(fingerprint);
  equal(first, second, "deterministic name");
  equal(first.split("-").length, 3, "three name words");
  assert(/^[a-z]+-[a-z]+-[a-z]+$/u.test(first), "generated name format");
});

console.log(`1..${passed}`);
