import { readConfig } from "../src/config.js";
import { createOpenAISchemaClientFactory } from "../src/llm/openaiSchema.js";
import { runInterpretationPlan } from "../src/llm/orchestrate/plan.js";
import type { SchemaCall, SchemaClient, StrictShape } from "../src/llm/orchestrate/types.js";
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

await test("pinned openai-schema creates one conversation and sends strict schema responses", async () => {
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
    metadata: { service: "test", calculation_fingerprint: "sha256:fixture" },
    base: "https://example.invalid/v1",
    fetch: fakeFetch,
  });
  const client = factory();
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
  const result = await client.run(shape, { field: "fixture" }, {
    body: { model: "gpt-test", store: false },
    retries: 0,
  });
  equal(result.value, "fixed", "structured result");
  equal(client.id, "conv_fixture", "conversation ID");
  equal(requests.length, 2, "OpenAI request count");
  equal(requests[0]?.url.endsWith("/conversations"), true, "conversation endpoint");
  equal(requests[1]?.url.endsWith("/responses"), true, "responses endpoint");
  equal(
    (requests[1]?.body["conversation"] as { id?: string }).id,
    "conv_fixture",
    "shared conversation body",
  );
  equal(requests[1]?.body["store"], false, "response storage disabled");
  equal(requests[1]?.body["instructions"], "Base developer instruction", "developer instruction");
  equal(
    (requests[1]?.body["metadata"] as { calculation_fingerprint?: string }).calculation_fingerprint,
    "sha256:fixture",
    "calculation metadata",
  );
  const text = requests[1]?.body["text"] as { format?: { type?: string; strict?: boolean; name?: string } };
  equal(text.format?.type, "json_schema", "strict response format type");
  equal(text.format?.strict, true, "strict response format");
  equal(text.format?.name, "fixture", "response schema name");
  equal(typeof requests[1]?.body["input"], "string", "structured input encoded as string");
  const encodedInput = JSON.parse(String(requests[1]?.body["input"])) as { field?: string };
  equal(encodedInput.field, "fixture", "structured input content preserved");
});

const exactRef = "#/astral-calculation/source" as JsonRef;
const unavailableRef = "#/astral-calculation/unavailable" as JsonRef;
const fingerprintRef = "#/astral-calculation/provenance/calculationFingerprint" as JsonRef;
const calculation = {
  schema: "astral-calculation/1.1.0",
  subject: { providedName: null, language: "en", adult: true },
  source: { status: "exact", value: { sign: "aries", meaning: "solar purpose" }, reason: "none" },
  unavailable: { status: "unavailable", value: null, reason: "birth_time_unknown" },
  system: { zodiac: "tropical", derived: { dominantPlanets: [], dominantSigns: [] } },
  settings: { primaryZodiac: "tropical", siderealAyanamsha: null, interpretationMode: "tropical" },
  interpretationPlan: {
    schema: "astral-interpretation-plan/1.1.0",
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
        id: "tropical.life.identityAndPurpose",
        zodiac: "tropical",
        section: "life.identityAndPurpose",
        domain: null,
        allowedSourceRefs: [exactRef],
      },
      {
        id: "final-synthesis",
        zodiac: "tropical",
        section: "finalSynthesis",
        domain: null,
        allowedSourceRefs: [exactRef],
      },
    ],
  },
  provenance: { calculationFingerprint: `sha256:${"1".repeat(64)}` },
} as unknown as AstralCalculation;

class FakeClient implements SchemaClient {
  id: string | undefined;
  readonly models: string[] = [];
  readonly efforts: string[] = [];
  readonly tokens: number[] = [];
  readonly inputs: unknown[] = [];
  #sunAttempts = 0;

  async run<T extends object>(
    shape: StrictShape<T>,
    input: unknown,
    options: SchemaCall,
  ): Promise<T> {
    this.id ??= "conv_plan";
    this.models.push(options.body.model);
    const reasoning = options.body["reasoning"] as { effort?: unknown } | undefined;
    this.efforts.push(typeof reasoning?.effort === "string" ? reasoning.effort : "");
    this.tokens.push(Number(options.body["max_output_tokens"]));
    this.inputs.push(input);
    if (shape.name === "generated_chart_name") return { value: "Solar-purpose-pathfinder" } as T;
    if (shape.name === "final-synthesis") {
      return {
        essence: "You centre your life around clear purpose and deliberate self-expression.",
        definingThemes: ["You develop purpose through sustained choices."],
        strongestAssets: ["You bring steady confidence to visible responsibilities."],
        recurringTensions: ["You may struggle to balance personal aims with relationship needs."],
        relationshipPattern: "You relate best when your directness remains transparent and considerate.",
        sexualPattern: "Your desire responds to confidence, trust and explicit communication.",
        friendshipPattern: "You build friendship through shared purpose and mutual encouragement.",
        vocationalPattern: "You favour visible work that carries a clear sense of purpose.",
        moneyPattern: "You make stronger material choices when they support your central priorities.",
        developmentalArc: "You grow by making your sense of purpose more collaborative and flexible.",
        closingPortrait: "You combine purposeful expression with a growing capacity for relational balance.",
        sourceRefs: [exactRef],
      } as T;
    }
    if (shape.name === "tropical_life_identityAndPurpose") {
      return {
        status: "written",
        title: "Identity and purpose",
        summary: "You favour deliberate choices that give your identity a clear and constructive direction.",
        detail: "Your purpose develops through sustained commitments, allowing ambition to mature into dependable contribution.",
        themes: ["You shape purpose through conscious commitment."],
        strengths: ["You sustain a durable sense of personal direction."],
        tensions: ["You may feel pressure to prove yourself through constant action."],
        sourceRefs: [exactRef],
      } as T;
    }
    this.#sunAttempts += 1;
    if (this.#sunAttempts === 1) {
      return {
        status: "written",
        title: "Solar purpose",
        summary: "I will analyse the supplied JSON.",
        detail: "I will describe the supplied data.",
        themes: ["I will inspect the JSON."],
        strengths: ["I will explain the chart."],
        tensions: ["I will produce an answer."],
        sourceRefs: [exactRef],
      } as T;
    }
    return {
      status: "written",
      title: "Solar purpose",
      summary: "You express purpose most clearly when you act with confidence and visible intention.",
      detail: "You take direct action most effectively when personal aims remain connected to wider responsibilities.",
      themes: ["You seek purposeful self-expression."],
      strengths: ["You show confident initiative."],
      tensions: ["You may identify too strongly with one defining aim."],
      sourceRefs: [exactRef],
    } as T;
  }
}

await test("fixed plan keeps one bounded foundation conversation and routes fields by cost", async () => {
  const client = new FakeClient();
  const result = await runInterpretationPlan(
    calculation,
    readConfig({ ASTRAL_MAX_RETRIES: "2" }),
    () => client,
  );
  equal(result.run.conversationId, "conv_plan", "plan conversation ID");
  equal(result.generatedName, "Solar-purpose-pathfinder", "generated chart name");
  equal(
    result.run.units["tropical.point.ascendant"]?.model,
    "deterministic",
    "unavailable unit model",
  );
  equal(
    (result.run.units["tropical.point.ascendant"]?.value as { status: string }).status,
    "unavailable",
    "unavailable unit status",
  );
  equal(
    client.models.join(","),
    "gpt-5.4-nano,gpt-5.4-nano,gpt-5.4-mini,gpt-5.4-mini,gpt-5.4-nano",
    "leaf audit repair section synthesis and utility model routing",
  );
  equal(
    client.efforts.join(","),
    "none,none,low,low,none",
    "per-field reasoning and audit repair effort",
  );
  equal(
    client.tokens.join(","),
    "1800,1800,3200,6000,128",
    "per-field token ceilings",
  );
  equal(result.run.calls, 5, "OpenAI call count");
  equal(result.run.retries, 1, "small audit repair count");
  const repairInput = client.inputs[1] as { auditErrors?: string[] };
  const failures = repairInput.auditErrors ?? [];
  assert(failures.length > 0, "small repair must include audit findings");
  equal(result.run.units["tropical.point.sun"]?.model, "gpt-5.4-nano", "accepted primary model");
  equal(
    result.run.units["tropical.point.sun"]?.provenance?.repairedBy,
    "gpt-5.4-nano",
    "audit repair model",
  );
  equal(
    result.run.units["tropical.point.sun"]?.provenance?.repairKind,
    "completion_condensation",
    "audit repair provenance",
  );
  equal(result.run.units["generated-name"], undefined, "utility result excluded from chart units");
  assert(result.run.units["tropical.point.sun"] !== undefined, "Sun unit retained");
  assert(result.run.units["tropical.life.identityAndPurpose"] !== undefined, "life section retained");
  equal(fingerprintRef.startsWith("#/"), true, "fingerprint reference fixture");
});

console.log(`1..${passed}`);
