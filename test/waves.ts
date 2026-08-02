import { readConfig } from "../src/config.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import { strictShape, object, text } from "../src/llm/schema/build.js";
import type {
  InterpretationCall,
  InterpretationCheckpoint,
  SchemaCall,
  SchemaClient,
  StrictShape,
} from "../src/llm/orchestrate/types.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const calls: InterpretationCall[] = Array.from({ length: 25 }, (_, index) => {
  const id = `tropical.unit.${index + 1}`;
  return {
    id,
    label: id,
    kind: index % 5 === 0 ? "big" : "small",
    tokens: 100,
    shape: strictShape<{ value: string }>(id.replaceAll(".", "_"), object({ value: text() })) as unknown as StrictShape<object>,
    allowedSourceRefs: new Set(),
    input: ({ earlier }) => ({ id, accepted: Object.keys(earlier) }),
    audit: (value) => ({ valid: true, value, errors: [] }),
  };
});

let clients = 0;
let uploads = 0;
let active = 0;
let maximumActive = 0;

class FakeClient implements SchemaClient {
  id: string | undefined;
  readonly #id = `conversation-${clients += 1}`;

  async uploadFile(name: string, _content: string) {
    uploads += 1;
    return { id: `file-${uploads}`, name, purpose: "user_data" as const };
  }

  async run<T extends object>(shape: StrictShape<T>, _input: unknown, _options: SchemaCall): Promise<T> {
    this.id = this.#id;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    const value = { value: `You complete ${shape.name}.` };
    return (shape.parse ? shape.parse(value) : value) as T;
  }
}

const checkpoints: InterpretationCheckpoint[] = [];
const result = await runInterpretation(
  { "astral-calculation": { provenance: { calculationFingerprint: `sha256:${"1".repeat(64)}` } } },
  calls,
  readConfig({
    ASTRAL_FOUNDATION_UNITS: "10",
    ASTRAL_LANE_COUNT: "4",
    ASTRAL_LANE_UNITS: "10",
    ASTRAL_LANE_CONTEXT_TOKENS: "60000",
  }),
  () => new FakeClient(),
  { onCheckpoint: (checkpoint) => { checkpoints.push(checkpoint); } },
);

equal(Object.keys(result.units).length, 25, "accepted unit count");
equal(result.orchestration, "waves", "orchestration mode");
equal(result.waves, 1, "wave count after the foundation");
equal(result.snapshotRevision, 1, "committed snapshot revision");
equal(uploads, 1, "one snapshot upload per wave");
assert(maximumActive <= 4, "at most four interpretation calls may run concurrently");
assert(maximumActive >= 2, "lane calls should run in parallel");
assert((result.conversationIds?.length ?? 0) >= 5, "foundation and lane conversations must be distinct");
assert(checkpoints.some(({ wave }) => wave?.assembled === true), "assembled wave checkpoint must be persisted");
assert(checkpoints.at(-1)?.units["tropical.unit.25"] !== undefined, "final checkpoint must include accepted work");

console.log("1..1");
