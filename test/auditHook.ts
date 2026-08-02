import { readConfig } from "../src/config.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import { object, strictShape, text } from "../src/llm/schema/build.js";
import type {
  InterpretationCall,
  SchemaCall,
  SchemaClient,
  StrictShape,
  UnitAudit,
} from "../src/llm/orchestrate/types.js";

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

const output = {
  value: "Rejected diagnostic candidate",
};

const unit: InterpretationCall = {
  id: "diagnostic-unit",
  label: "Diagnostic unit",
  kind: "small",
  shape: strictShape<{ value: string }>(
    "diagnostic_unit",
    object({ value: text() }),
  ) as unknown as StrictShape<object>,
  allowedSourceRefs: new Set(),
  input: () => ({}),
  audit: (value) => ({
    valid: false,
    value,
    errors: ["diagnostic audit failure"],
  }),
};

class FakeClient implements SchemaClient {
  readonly id = "conv_audit_hook";

  async run<T extends object>(
    _shape: StrictShape<T>,
    _input: unknown,
    _options: SchemaCall,
  ): Promise<T> {
    return output as T;
  }
}

let rejected: {
  attempt: number;
  model: string;
  output: object;
  audit: UnitAudit<object>;
} | null = null;

let failed = false;

try {
  await runInterpretation(
    {},
    [unit],
    readConfig({ ASTRAL_MAX_RETRIES: "1" }),
    () => new FakeClient(),
    {
      onReject: (
        _unit,
        attempt,
        model,
        candidate,
        audit,
      ) => {
        rejected = {
          attempt,
          model,
          output: candidate,
          audit,
        };
      },
    },
  );
} catch (error) {
  failed = error instanceof Error
    && error.message.includes("diagnostic audit failure");
}

assert(failed, "failed audit must remain terminal");
assert(rejected !== null, "rejected output hook must run");
assert(rejected.attempt === 1, "hook must receive the attempt");
assert(rejected.model === "gpt-5.4-nano", "hook must receive the routed model");
assert(rejected.output === output, "hook must receive the exact rejected output");
assert(
  rejected.audit.errors[0] === "diagnostic audit failure",
  "hook must receive the exact audit result",
);

console.log("ok 1 - rejected interpretation output is exposed to audit hooks");
console.log("1..1");
