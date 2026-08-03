import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import type {
  InterpretationCall,
  SchemaCall,
  SchemaClient,
  StrictShape,
} from "../src/llm/orchestrate/types.js";

const shape: StrictShape<{ detail: string }> = {
  name: "completion_repair_fixture",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      detail: { type: "string" },
    },
    required: ["detail"],
  },
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

class Client implements SchemaClient {
  readonly id: string;

  constructor(
    id: string,
    private readonly onRun: (input: unknown, options: SchemaCall) => object,
  ) {
    this.id = id;
  }

  async run<T extends object>(
    _shape: StrictShape<T>,
    input: unknown,
    options: SchemaCall,
  ): Promise<T> {
    return this.onRun(input, options) as T;
  }
}

test("parsed prose truncation is condensed and completed by the small model", async () => {
  const config = readConfig({
    ASTRAL_MAX_RETRIES: "1",
    OPENAI_SMALL_MODEL: "gpt-small",
    OPENAI_BIG_MODEL: "gpt-big",
  });
  let clients = 0;
  let primaryCalls = 0;
  let repairCalls = 0;
  const repairModels: string[] = [];
  const repairEvents: string[][] = [];

  const createClient = (): SchemaClient => {
    clients += 1;
    return new Client(`conv_${clients}`, (input, options) => {
      if (record(input) && typeof input["instruction"] === "string") {
        repairCalls += 1;
        repairModels.push(options.body.model);
        assert.deepEqual(input["partialCandidate"], {
          detail: "You seek depth and trust because",
        });
        return {
          detail: "You seek depth and trust because dependable intimacy matters to you.",
        };
      }
      primaryCalls += 1;
      return { detail: "You seek depth and trust because" };
    });
  };

  const unit: InterpretationCall = {
    id: "tropical.life.sexuality",
    label: "Sexuality",
    kind: "small",
    effort: "none",
    tokens: 256,
    shape,
    allowedSourceRefs: new Set(),
    input: () => ({ field: "sexuality" }),
    audit: (value) => {
      const detail = (value as { detail?: unknown }).detail;
      if (typeof detail === "string" && /because\s*$/iu.test(detail)) {
        return {
          valid: false,
          value,
          errors: ["tropical.life.sexuality.detail ends with an unfinished clause"],
          repair: "completion",
        };
      }
      return { valid: true, value, errors: [] };
    },
  };

  const result = await runInterpretation(
    {},
    [unit],
    config,
    createClient,
    {
      onRepair: (_unit, _attempt, model, errors) => {
        assert.equal(model, "gpt-small");
        repairEvents.push([...errors]);
      },
    },
  );

  assert.equal(primaryCalls, 1);
  assert.equal(repairCalls, 1);
  assert.deepEqual(repairModels, ["gpt-small"]);
  assert.equal(repairEvents.length, 1);
  assert.equal(result.calls, 2);
  assert.equal(result.retries, 1);
  assert.equal(
    result.units["tropical.life.sexuality"]?.provenance?.repairKind,
    "completion_condensation",
  );
  assert.equal(
    (result.units["tropical.life.sexuality"]?.value as { detail?: string }).detail,
    "You seek depth and trust because dependable intimacy matters to you.",
  );
});
