import type { Config } from "../../config.js";
import type {
  InterpretationRun,
  InterpretationCall,
  RunHooks,
  SchemaClient,
  SchemaClientFactory,
  UnitContext,
  UnitResult,
} from "./types.js";

const modelFor = (config: Config, kind: InterpretationCall["kind"]): string =>
  kind === "big" ? config.openai.bigModel : config.openai.smallModel;

const effortFor = (config: Config, unit: InterpretationCall): string =>
  unit.effort ?? config.openai.reasoning;

const tokensFor = (config: Config, unit: InterpretationCall): number =>
  Math.min(unit.tokens ?? config.openai.maxOutputTokens, config.openai.maxOutputTokens);

const assertConversation = (client: SchemaClient, expected: string | null): string => {
  const id = client.id;
  if (!id) throw new Error("openai-schema did not establish a chart conversation ID");
  if (expected !== null && id !== expected) throw new Error("Chart conversation ID changed during generation");
  return id;
};

export const runInterpretation = async (
  calculation: unknown,
  units: readonly InterpretationCall[],
  config: Config,
  createClient: SchemaClientFactory,
  hooks: RunHooks = {},
): Promise<InterpretationRun> => {
  if (units.length === 0) throw new Error("Interpretation requires at least one unit");
  if (new Set(units.map((unit) => unit.id)).size !== units.length) throw new Error("Interpretation unit IDs must be unique");

  const client = createClient();
  const completed: Record<string, UnitResult<object>> = {};
  let conversationId: string | null = null;
  let calls = 0;
  let retries = 0;

  for (const unit of units) {
    const model = modelFor(config, unit.kind);
    const effort = effortFor(config, unit);
    const tokens = tokensFor(config, unit);
    let accepted: UnitResult<object> | null = null;
    let correction: readonly string[] = [];
    const context = (): UnitContext => ({ calculation, earlier: completed, correction });

    for (let attempt = 1; attempt <= config.chart.maxRetries; attempt += 1) {
      hooks.onStart?.(unit, attempt, model);
      calls += 1;
      const output = await client.run(unit.shape, unit.input(context()), {
        body: {
          model,
          store: false,
          reasoning: { effort },
          max_output_tokens: tokens,
        },
        retries: 0,
      });
      conversationId = assertConversation(client, conversationId);
      const audited = unit.audit(output, context());
      if (audited.valid) {
        accepted = { id: unit.id, value: audited.value, attempts: attempt, model };
        break;
      }
      correction = audited.errors;
      if (attempt < config.chart.maxRetries) {
        retries += 1;
        hooks.onRetry?.(unit, attempt, audited.errors);
      } else {
        throw new Error(`Interpretation unit ${unit.id} failed audit: ${audited.errors.join("; ")}`);
      }
    }

    if (!accepted) throw new Error(`Interpretation unit ${unit.id} produced no accepted output`);
    completed[unit.id] = accepted;
    hooks.onComplete?.(accepted);
  }

  if (conversationId === null) throw new Error("Interpretation completed without a conversation ID");
  return { conversationId, units: completed, calls, retries };
};
