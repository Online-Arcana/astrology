import { readConfig } from "../src/config.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import { object, strictShape, text } from "../src/llm/schema/build.js";
import type {
  InterpretationCall,
  SchemaCall,
  SchemaClient,
  StrictShape,
} from "../src/llm/orchestrate/types.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const calls: InterpretationCall[] = Array.from({ length: 55 }, (_, index) => {
  const id = `tropical.fresh.${index + 1}`;
  return {
    id,
    label: id,
    kind: "small",
    tokens: 64,
    shape: strictShape<{ value: string }>(id.replaceAll(".", "_"), object({ value: text() })) as unknown as StrictShape<object>,
    allowedSourceRefs: new Set(),
    input: ({ earlier }) => ({ id, accepted: Object.keys(earlier) }),
    audit: (value) => ({ valid: true, value, errors: [] }),
  };
});

let sequence = 0;
let uploads = 0;
const callsByConversation = new Map<string, number>();

class Client implements SchemaClient {
  id: string | undefined;
  readonly #id = `fresh-conversation-${sequence += 1}`;

  async uploadFile(name: string, _content: string) {
    uploads += 1;
    return { id: `fresh-file-${uploads}`, name, purpose: "user_data" as const };
  }

  async run<T extends object>(shape: StrictShape<T>, _input: unknown, _options: SchemaCall): Promise<T> {
    this.id = this.#id;
    callsByConversation.set(this.#id, (callsByConversation.get(this.#id) ?? 0) + 1);
    const value = { value: `You complete ${shape.name}.` };
    return (shape.parse ? shape.parse(value) : value) as T;
  }
}

const result = await runInterpretation(
  { provenance: { calculationFingerprint: `sha256:${"2".repeat(64)}` } },
  calls,
  readConfig({
    ASTRAL_FOUNDATION_UNITS: "10",
    ASTRAL_LANE_COUNT: "4",
    ASTRAL_LANE_UNITS: "10",
    ASTRAL_LANE_CONTEXT_TOKENS: "60000",
  }),
  () => new Client(),
);

assert(result.waves === 2, "fifty-five units must require two waves after the ten-unit foundation");
assert(uploads === 2, "each wave must upload its own canonical snapshot");
assert((result.conversationIds?.length ?? 0) >= 6, "the second wave must create conversations not used by the first wave");
assert(new Set(result.conversationIds).size === result.conversationIds?.length, "conversation identifiers must never be reused across waves");
assert([...callsByConversation.values()].every((count) => count <= 10), "no bounded conversation may process more than ten interpretations");
assert([...callsByConversation.values()].reduce((sum, count) => sum + count, 0) === 55, "every interpretation must run exactly once");

console.log("1..1");
