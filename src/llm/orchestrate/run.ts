import type { Config } from "../../config.js";
import type {
  ActiveInterpretationUnit,
  InterpretationCall,
  InterpretationCheckpoint,
  InterpretationRecovery,
  InterpretationRun,
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

const count = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
};

const activeCopy = (value: ActiveInterpretationUnit | null): ActiveInterpretationUnit | null =>
  value === null
    ? null
    : { id: value.id, attempt: value.attempt, correction: [...value.correction] };

const initial = (recovery: InterpretationRecovery | null): InterpretationRecovery => recovery ?? {
  conversationId: null,
  units: {},
  calls: 0,
  retries: 0,
  active: null,
};

const restore = (
  calculation: unknown,
  units: readonly InterpretationCall[],
  recovery: InterpretationRecovery,
  maximumAttempts: number,
): Record<string, UnitResult<object>> => {
  const known = new Set(units.map(({ id }) => id));
  for (const id of Object.keys(recovery.units)) {
    if (!known.has(id)) throw new Error(`Recovery contains unknown interpretation unit ${id}`);
  }

  const recoveredCount = Object.keys(recovery.units).length;
  if (recoveredCount > 0 && recovery.conversationId === null) {
    throw new Error("Recovered interpretation units require a conversation ID");
  }

  const completed: Record<string, UnitResult<object>> = {};
  let gap = false;

  for (const unit of units) {
    const result = recovery.units[unit.id];
    if (result === undefined) {
      gap = true;
      continue;
    }
    if (gap) throw new Error("Recovered interpretation units must form a completed prefix");
    if (result.id !== unit.id) throw new Error(`Recovered interpretation unit ID mismatch for ${unit.id}`);
    if (!Number.isSafeInteger(result.attempts) || result.attempts < 1 || result.attempts > maximumAttempts) {
      throw new Error(`Recovered interpretation attempts are invalid for ${unit.id}`);
    }
    if (typeof result.model !== "string" || result.model.length === 0) {
      throw new Error(`Recovered interpretation model is invalid for ${unit.id}`);
    }

    const context: UnitContext = {
      calculation,
      earlier: completed,
      correction: [],
    };
    const audited = unit.audit(result.value, context);
    if (!audited.valid) {
      throw new Error(`Recovered interpretation unit ${unit.id} failed audit: ${audited.errors.join("; ")}`);
    }
    completed[unit.id] = { ...result, value: audited.value };
  }

  const pending = units.find(({ id }) => completed[id] === undefined) ?? null;
  const active = recovery.active;
  if (active !== null) {
    if (pending === null || active.id !== pending.id) {
      throw new Error("Recovery active unit must be the first unfinished interpretation unit");
    }
    if (!Number.isSafeInteger(active.attempt) || active.attempt < 1 || active.attempt > maximumAttempts) {
      throw new Error(`Recovery attempt is invalid for ${active.id}`);
    }
    if (!active.correction.every((value) => typeof value === "string")) {
      throw new Error(`Recovery correction is invalid for ${active.id}`);
    }
  }

  return completed;
};

export const runInterpretation = async (
  calculation: unknown,
  units: readonly InterpretationCall[],
  config: Config,
  createClient: SchemaClientFactory,
  hooks: RunHooks = {},
  recovery: InterpretationRecovery | null = null,
): Promise<InterpretationRun> => {
  if (units.length === 0) throw new Error("Interpretation requires at least one unit");
  if (new Set(units.map((unit) => unit.id)).size !== units.length) throw new Error("Interpretation unit IDs must be unique");

  const recovered = initial(recovery);
  const completed = restore(calculation, units, recovered, config.chart.maxRetries);
  let conversationId = recovered.conversationId;
  let calls = count(recovered.calls, "Recovery call count");
  let retries = count(recovered.retries, "Recovery retry count");
  const client = createClient(conversationId ?? undefined);

  const checkpoint = async (active: ActiveInterpretationUnit | null): Promise<void> => {
    if (!hooks.onCheckpoint) return;
    const value: InterpretationCheckpoint = {
      conversationId,
      units: { ...completed },
      calls,
      retries,
      active: activeCopy(active),
    };
    await hooks.onCheckpoint(value);
  };

  for (const unit of units) {
    if (completed[unit.id] !== undefined) continue;

    const resumed = recovered.active?.id === unit.id ? recovered.active : null;
    const model = modelFor(config, unit.kind);
    const effort = effortFor(config, unit);
    const tokens = tokensFor(config, unit);
    let accepted: UnitResult<object> | null = null;
    let correction: readonly string[] = [...(resumed?.correction ?? [])];
    const firstAttempt = resumed?.attempt ?? 1;
    const context = (): UnitContext => ({ calculation, earlier: completed, correction });

    for (let attempt = firstAttempt; attempt <= config.chart.maxRetries; attempt += 1) {
      const active: ActiveInterpretationUnit = { id: unit.id, attempt, correction: [...correction] };
      hooks.onStart?.(unit, attempt, model);
      calls += 1;
      await checkpoint(active);

      let output: object;
      try {
        output = await client.run(unit.shape, unit.input(context()), {
          body: {
            model,
            store: false,
            reasoning: { effort },
            max_output_tokens: tokens,
          },
          retries: 0,
        });
      } catch (cause: unknown) {
        if (client.id !== undefined) conversationId = assertConversation(client, conversationId);
        await checkpoint(active);
        throw cause;
      }

      conversationId = assertConversation(client, conversationId);
      await checkpoint(active);

      const audited = unit.audit(output, context());
      if (audited.valid) {
        accepted = { id: unit.id, value: audited.value, attempts: attempt, model };
        completed[unit.id] = accepted;
        hooks.onComplete?.(accepted);
        await checkpoint(null);
        break;
      }

      correction = [...audited.errors];
      if (attempt < config.chart.maxRetries) {
        retries += 1;
        hooks.onRetry?.(unit, attempt, audited.errors);
        await checkpoint({ id: unit.id, attempt: attempt + 1, correction });
      } else {
        await checkpoint({ id: unit.id, attempt, correction });
        throw new Error(`Interpretation unit ${unit.id} failed audit: ${audited.errors.join("; ")}`);
      }
    }

    if (!accepted) throw new Error(`Interpretation unit ${unit.id} produced no accepted output`);
  }

  if (conversationId === null) throw new Error("Interpretation completed without a conversation ID");
  return { conversationId, units: completed, calls, retries };
};
