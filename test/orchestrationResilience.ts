import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import type {
  InterpretationCall,
  InterpretationRecovery,
  SchemaCall,
  SchemaClient,
  StrictShape,
} from "../src/llm/orchestrate/types.js";

const shape: StrictShape<object> = {
  name: "resilience_fixture",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
    },
    required: ["summary"],
  },
};

class Client implements SchemaClient {
  readonly id = "conv_resilience";
  calls = 0;

  constructor(private readonly value: object) {}

  async run<T extends object>(
    _shape: StrictShape<T>,
    _input: unknown,
    _options: SchemaCall,
  ): Promise<T> {
    this.calls += 1;
    return this.value as T;
  }
}

const config = readConfig({ ASTRAL_MAX_RETRIES: "2" });

const unit = (
  error: string,
  soft: boolean,
  onAccept?: (value: object) => void,
): InterpretationCall => ({
  id: "tropical.aspect.moon_south_node_mean_sextile",
  label: "Moon south node mean sextile",
  kind: "small",
  effort: "none",
  tokens: 128,
  shape,
  allowedSourceRefs: new Set(),
  input: ({ correction }) => ({ correction }),
  audit: (value) => ({
    valid: false,
    value,
    errors: [error],
    soft,
  }),
  ...(onAccept === undefined ? {} : { onAccept }),
});

test("a generic semantic warning is accepted without another primary attempt", async () => {
  const client = new Client({ summary: "A source-grounded interpretation." });
  const soft: string[][] = [];
  const accepted: object[] = [];

  const result = await runInterpretation(
    {},
    [unit("summary does not fit its semantic field", true, (value) => accepted.push(value))],
    config,
    () => client,
    {
      onSoftAccept: (_call, _attempt, warnings) => soft.push([...warnings]),
    },
  );

  assert.equal(client.calls, 1);
  assert.equal(result.calls, 1);
  assert.equal(result.retries, 0);
  assert.equal(result.units["tropical.aspect.moon_south_node_mean_sextile"]?.attempts, 1);
  assert.equal(soft.length, 1);
  assert.equal(accepted.length, 1);
});

test("hard audit failures remain terminal", async () => {
  const client = new Client({ summary: "I will now analyse the chart." });

  await assert.rejects(
    () => runInterpretation(
      {},
      [unit("summary contains process narration", false)],
      config,
      () => client,
    ),
    /contains process narration/u,
  );

  assert.equal(client.calls, 2);
});

test("soft-accepted recovered fields rebuild accepted context", async () => {
  let accepted = 0;
  const recovery: InterpretationRecovery = {
    conversationId: "conv_resilience",
    units: {
      "tropical.aspect.moon_south_node_mean_sextile": {
        id: "tropical.aspect.moon_south_node_mean_sextile",
        value: { summary: "Recovered source-grounded interpretation." },
        attempts: 2,
        model: "gpt-test",
      },
    },
    calls: 2,
    retries: 1,
    active: null,
  };

  const client = new Client({ summary: "unused" });
  const result = await runInterpretation(
    {},
    [unit("summary does not fit its semantic field", true, () => { accepted += 1; })],
    config,
    () => client,
    {},
    recovery,
  );

  assert.equal(client.calls, 0);
  assert.equal(accepted, 1);
  assert.equal(result.units["tropical.aspect.moon_south_node_mean_sextile"]?.attempts, 2);
});
