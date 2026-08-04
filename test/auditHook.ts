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

const unit = (kind: InterpretationCall["kind"]): InterpretationCall => ({
  id: `diagnostic-${kind}`,
  label: `Diagnostic ${kind}`,
  kind,
  shape: strictShape<{ value: string }>(
    `diagnostic_${kind}`,
    object({ value: text() }),
  ) as unknown as StrictShape<object>,
  allowedSourceRefs: new Set(),
  input: ({ correction }) => ({ correction }),
  audit: (value) => ({
    valid: false,
    value,
    errors: ["diagnostic audit failure"],
  }),
});

class FakeClient implements SchemaClient {
  readonly id: string;
  readonly models: string[] = [];
  readonly inputs: unknown[] = [];

  constructor(id: string) {
    this.id = id;
  }

  async run<T extends object>(
    _shape: StrictShape<T>,
    input: unknown,
    options: SchemaCall,
  ): Promise<T> {
    this.models.push(options.body.model);
    this.inputs.push(input);
    return output as T;
  }
}

type Rejection = {
  attempt: number;
  model: string;
  output: object;
  audit: UnitAudit<object>;
};

const config = readConfig({ ASTRAL_MAX_RETRIES: "2" });

const rejected: Rejection[] = [];
const shortClient = new FakeClient("conv_audit_hook_short");
const shortResult = await runInterpretation(
  {},
  [unit("small")],
  config,
  () => shortClient,
  {
    onReject: (
      _unit,
      attempt,
      model,
      candidate,
      audit,
    ) => {
      rejected.push({
        attempt,
        model,
        output: candidate,
        audit,
      });
    },
  },
);

assert(rejected.length === 2, "entry and escalation outputs must both reach the audit hook");
assert(rejected[0]?.attempt === 1, "entry hook must receive attempt one");
assert(rejected[0]?.model === "gpt-5-nano", "entry hook must receive the short entry model");
assert(rejected[1]?.attempt === 2, "escalation hook must receive attempt two");
assert(rejected[1]?.model === "gpt-5.6-luna", "escalation hook must receive the short escalation model");
assert(rejected.every((capture) => capture.output === output), "hook must receive the exact rejected output");
assert(
  rejected.every((capture) => capture.audit.errors[0] === "diagnostic audit failure"),
  "hook must receive the exact audit result for both tiers",
);
assert(
  shortResult.units["diagnostic-small"]?.provenance?.repairedBy === "deterministic",
  "production must complete through deterministic reconstruction",
);

const longClient = new FakeClient("conv_audit_hook_long");
const longResult = await runInterpretation(
  {},
  [unit("big")],
  config,
  () => longClient,
);
assert(
  longClient.models.join(",") === "gpt-5.6-luna,gpt-5.6-luna",
  "long entry and escalation must both use Luna",
);
const longEscalationInput = longClient.inputs[1] as { correction?: readonly string[] };
assert(
  longEscalationInput.correction?.includes("diagnostic audit failure") === true,
  "the second Luna call must receive the deterministic NLP failure",
);
assert(
  longResult.units["diagnostic-big"]?.provenance?.repairedBy === "deterministic",
  "failed long escalation must complete deterministically",
);

console.log("ok 1 - short entry and Luna escalation are both audited");
console.log("ok 2 - long Luna escalation receives NLP correction context");
console.log("1..2");
