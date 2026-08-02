import type { Config } from "../../config.js";
import { coherenceIssues, conflictingUnits } from "./coherence.js";
import { foundationPlan, wavePlan, type LanePlan } from "./planner.js";
import { AdaptiveLimiter } from "./rateLimit.js";
import { buildSnapshot, snapshotInput, snapshotText, type InterpretationSnapshot } from "./snapshot.js";
import type {
  ActiveInterpretationUnit,
  InterpretationCall,
  InterpretationCheckpoint,
  InterpretationFailureKind,
  InterpretationRecovery,
  InterpretationRun,
  LaneCheckpoint,
  RunHooks,
  SchemaClient,
  SchemaClientFactory,
  SnapshotCheckpoint,
  UnitContext,
  UnitResult,
  WaveCheckpoint,
} from "./types.js";

interface Counters {
  calls: number;
  retries: number;
  conversations: Set<string>;
}

interface ExecutionOptions {
  calculation: unknown;
  unit: InterpretationCall;
  client: SchemaClient;
  createClient: SchemaClientFactory;
  config: Config;
  limiter: AdaptiveLimiter;
  hooks: RunHooks;
  earlier: Readonly<Record<string, UnitResult<object>>>;
  snapshot: InterpretationSnapshot | null;
  remoteFileId: string | null;
  counters: Counters;
  correction?: readonly string[];
}

const baseModelFor = (config: Config, kind: InterpretationCall["kind"]): string =>
  kind === "big" ? config.openai.bigModel : config.openai.smallModel;

const modelFor = (config: Config, unit: InterpretationCall, attempt: number): string =>
  unit.kind === "small" && attempt > 1 ? config.openai.bigModel : baseModelFor(config, unit.kind);

const effortFor = (config: Config, unit: InterpretationCall, model: string): string =>
  unit.kind === "small" && model === config.openai.bigModel
    ? "low"
    : unit.effort ?? config.openai.reasoning;

const tokensFor = (config: Config, unit: InterpretationCall): number =>
  Math.min(unit.tokens ?? config.openai.maxOutputTokens, config.openai.maxOutputTokens);

const count = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
};

const conversation = (client: SchemaClient, counters: Counters): string => {
  const id = client.id;
  if (!id) throw new Error("openai-schema did not establish an interpretation conversation ID");
  counters.conversations.add(id);
  return id;
};

const rawText = (cause: unknown): string => {
  if (typeof cause !== "object" || cause === null) return "";
  const candidate = (cause as Record<string, unknown>)["rawText"];
  return typeof candidate === "string" ? candidate : "";
};

const responseStatus = (cause: unknown): string | null => {
  if (typeof cause !== "object" || cause === null) return null;
  const candidate = (cause as Record<string, unknown>)["responseStatus"];
  return typeof candidate === "string" ? candidate : null;
};

const httpStatus = (cause: unknown): number | null => {
  if (typeof cause !== "object" || cause === null) return null;
  const candidate = (cause as Record<string, unknown>)["status"];
  return typeof candidate === "number" ? candidate : null;
};

const truncation = (cause: unknown): boolean => {
  if (responseStatus(cause) === "incomplete") return true;
  const raw = rawText(cause).trim();
  if (raw.length === 0) return false;
  return !/[}\]]\s*$/u.test(raw) || /[,;:\-–—]\s*$/u.test(raw);
};

const failureKind = (cause: unknown): InterpretationFailureKind => {
  if (httpStatus(cause) === 429) return "rate_limit";
  if (truncation(cause)) return "truncation";
  if (responseStatus(cause) === "failed") return "transport";
  if (cause instanceof Error && /timeout|deadline|timed out/iu.test(cause.message)) return "timeout";
  if (rawText(cause).length > 0) return "schema";
  return "transport";
};

const callInput = (
  unit: InterpretationCall,
  context: UnitContext,
  snapshot: InterpretationSnapshot | null,
  remoteFileId: string | null,
): unknown => {
  const input = unit.input(context);
  return snapshot === null ? input : snapshotInput(remoteFileId, snapshot, input);
};

const repairInstruction = [
  "The primary interpretation response was truncated or malformed.",
  "Return a concise, complete replacement for the entire strict schema from the beginning.",
  "Preserve the conclusions and useful meaning present in partialCandidate instead of independently changing the interpretation.",
  "Condense verbose material, complete unfinished thoughts and fill missing properties only from deterministicInput and snapshot context.",
  "Write directly to the person using you and your.",
  "Never place internal JSON references in prose; references belong only in sourceRefs.",
  "Finish every required property, sentence and list entry.",
].join("\n");

const repairTruncation = async (
  options: ExecutionOptions,
  cause: unknown,
  context: UnitContext,
): Promise<UnitResult<object> | null> => {
  const repairClient = options.createClient();
  const model = options.config.openai.smallModel;
  const partialCandidate = rawText(cause);
  options.counters.calls += 1;
  let output: object;
  try {
    output = await options.limiter.run(() => repairClient.run(
      options.unit.shape,
      options.snapshot === null
        ? {
            instruction: repairInstruction,
            truncationReason: responseStatus(cause) ?? "malformed_json",
            partialCandidate,
            deterministicInput: options.unit.input(context),
          }
        : snapshotInput(options.remoteFileId, options.snapshot, {
            instruction: repairInstruction,
            truncationReason: responseStatus(cause) ?? "malformed_json",
            partialCandidate,
            deterministicInput: options.unit.input(context),
          }),
      {
        body: {
          model,
          store: false,
          reasoning: { effort: "none" },
          max_output_tokens: tokensFor(options.config, options.unit),
        },
        retries: 0,
      },
    ));
  } catch {
    return null;
  }
  conversation(repairClient, options.counters);
  const audited = options.unit.audit(output, context);
  if (!audited.valid) {
    await options.hooks.onReject?.(options.unit, 1, model, output, audited);
    return null;
  }
  return {
    id: options.unit.id,
    value: audited.value,
    attempts: 1,
    model: baseModelFor(options.config, options.unit.kind),
    provenance: { repairedBy: model, repairKind: "truncation_condensation" },
  };
};

const executeUnit = async (options: ExecutionOptions): Promise<UnitResult<object>> => {
  let correction = [...(options.correction ?? [])];
  const maximumAttempts = options.config.chart.maxRetries;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const model = modelFor(options.config, options.unit, attempt);
    const context: UnitContext = {
      calculation: options.calculation,
      earlier: options.earlier,
      correction,
    };
    options.hooks.onStart?.(options.unit, attempt, model);
    options.counters.calls += 1;

    let output: object;
    try {
      output = await options.limiter.run(() => options.client.run(
        options.unit.shape,
        callInput(options.unit, context, options.snapshot, options.remoteFileId),
        {
          body: {
            model,
            store: false,
            reasoning: { effort: effortFor(options.config, options.unit, model) },
            max_output_tokens: tokensFor(options.config, options.unit),
          },
          retries: 0,
        },
      ));
      conversation(options.client, options.counters);
    } catch (cause: unknown) {
      if (options.client.id !== undefined) conversation(options.client, options.counters);
      if (truncation(cause)) {
        const repaired = await repairTruncation(options, cause, context);
        if (repaired !== null) {
          options.hooks.onComplete?.(repaired);
          return repaired;
        }
      }
      if (attempt >= maximumAttempts || failureKind(cause) !== "schema") throw cause;
      options.counters.retries += 1;
      correction = [`Previous output could not be parsed completely: ${cause instanceof Error ? cause.message : String(cause)}`];
      options.hooks.onRetry?.(options.unit, attempt, correction);
      continue;
    }

    const audited = options.unit.audit(output, context);
    const softAccepted = !audited.valid && audited.soft === true && attempt >= maximumAttempts;
    if (audited.valid || softAccepted) {
      const result: UnitResult<object> = { id: options.unit.id, value: audited.value, attempts: attempt, model };
      if (softAccepted) options.hooks.onSoftAccept?.(options.unit, attempt, audited.errors);
      options.hooks.onComplete?.(result);
      return result;
    }

    await options.hooks.onReject?.(options.unit, attempt, model, output, audited);
    correction = [...audited.errors];
    if (attempt < maximumAttempts) {
      options.counters.retries += 1;
      options.hooks.onRetry?.(options.unit, attempt, correction);
      continue;
    }
    throw new Error(`Interpretation unit ${options.unit.id} failed audit: ${audited.errors.join("; ")}`);
  }
  throw new Error(`Interpretation unit ${options.unit.id} produced no accepted output`);
};

const restore = (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  recovery: InterpretationRecovery,
  maximumAttempts: number,
): Record<string, UnitResult<object>> => {
  const known = new Map(calls.map((call) => [call.id, call]));
  const completed: Record<string, UnitResult<object>> = {};
  for (const [id, result] of Object.entries(recovery.units)) {
    const call = known.get(id);
    if (call === undefined) throw new Error(`Recovery contains unknown interpretation unit ${id}`);
    if (result.id !== id) throw new Error(`Recovered interpretation unit ID mismatch for ${id}`);
    if (!Number.isSafeInteger(result.attempts) || result.attempts < 1 || result.attempts > maximumAttempts) {
      throw new Error(`Recovered interpretation attempts are invalid for ${id}`);
    }
    const audited = call.audit(result.value, { calculation, earlier: completed, correction: [] });
    if (!audited.valid && audited.soft !== true) {
      throw new Error(`Recovered interpretation unit ${id} failed audit: ${audited.errors.join("; ")}`);
    }
    completed[id] = { ...result, value: audited.value };
  }
  return completed;
};

const emptyRecovery = (): InterpretationRecovery => ({
  conversationId: null,
  units: {},
  calls: 0,
  retries: 0,
  active: null,
  orchestration: "waves",
  foundationComplete: false,
  snapshot: null,
  wave: null,
});

const active = (id: string, correction: readonly string[] = []): ActiveInterpretationUnit => ({
  id,
  attempt: 1,
  correction: [...correction],
});

const laneCheckpoint = (plan: LanePlan): LaneCheckpoint => ({
  id: plan.id,
  conversationId: null,
  assignments: plan.units.map(({ id }) => id),
  completed: [],
  active: null,
  status: "pending",
  failureKind: null,
});

export const runInterpretation = async (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  config: Config,
  createClient: SchemaClientFactory,
  hooks: RunHooks = {},
  recovery: InterpretationRecovery | null = null,
): Promise<InterpretationRun> => {
  if (calls.length === 0) throw new Error("Interpretation requires at least one unit");
  if (new Set(calls.map(({ id }) => id)).size !== calls.length) throw new Error("Interpretation unit IDs must be unique");

  const recovered = recovery ?? emptyRecovery();
  const completed = restore(calculation, calls, recovered, config.chart.maxRetries);
  const counters: Counters = {
    calls: count(recovered.calls, "Recovery call count"),
    retries: count(recovered.retries, "Recovery retry count"),
    conversations: new Set(recovered.conversationId === null ? [] : [recovered.conversationId]),
  };
  const limiter = new AdaptiveLimiter(config.chart.laneCount ?? 4);
  const order = calls.map(({ id }) => id);
  let foundationComplete = recovered.foundationComplete ?? false;
  let snapshotState: SnapshotCheckpoint | null = recovered.snapshot ?? null;
  let currentWave: WaveCheckpoint | null = recovered.wave ?? null;
  let waveNumber = currentWave?.id ?? 0;
  let primaryConversationId = recovered.conversationId;
  let checkpointTail = Promise.resolve();

  const checkpoint = async (activeUnit: ActiveInterpretationUnit | null): Promise<void> => {
    if (hooks.onCheckpoint === undefined) return;
    const value: InterpretationCheckpoint = {
      conversationId: primaryConversationId,
      units: { ...completed },
      calls: counters.calls,
      retries: counters.retries,
      active: activeUnit,
      orchestration: "waves",
      foundationComplete,
      snapshot: snapshotState,
      wave: currentWave,
    };
    checkpointTail = checkpointTail.then(async () => { await hooks.onCheckpoint?.(value); });
    await checkpointTail;
  };

  if (!foundationComplete) {
    const maximum = config.chart.foundationUnits ?? 10;
    const remainingFoundation = Math.max(0, maximum - Object.keys(completed).length);
    const foundation = remainingFoundation === 0
      ? []
      : foundationPlan(calls, completed, remainingFoundation);
    const client = createClient(primaryConversationId ?? undefined);
    let contextTokens = 0;
    for (const unit of foundation) {
      const estimate = unit.tokens ?? 1_800;
      if (contextTokens > 0 && contextTokens + estimate > (config.chart.laneContextTokens ?? 60_000)) break;
      await checkpoint(active(unit.id));
      const result = await executeUnit({
        calculation,
        unit,
        client,
        createClient,
        config,
        limiter,
        hooks,
        earlier: completed,
        snapshot: null,
        remoteFileId: null,
        counters,
      });
      completed[unit.id] = result;
      unit.onAccept?.(result.value);
      contextTokens += estimate;
      primaryConversationId = conversation(client, counters);
      await checkpoint(null);
    }
    foundationComplete = true;
    await checkpoint(null);
  }

  let snapshot = await buildSnapshot(calculation, completed, order, snapshotState?.revision ?? 0);
  snapshotState = {
    revision: snapshot.revision,
    sha256: snapshot.sha256,
    remoteFileId: snapshotState?.sha256 === snapshot.sha256 ? snapshotState.remoteFileId : null,
    acceptedOrder: [...snapshot.acceptedOrder],
  };
  await checkpoint(null);

  while (Object.keys(completed).length < calls.length) {
    waveNumber += 1;
    const plans = wavePlan(
      calls,
      completed,
      config.chart.laneCount ?? 4,
      config.chart.laneUnits ?? 10,
    );
    if (plans.length === 0) throw new Error("Interpretation planner could not produce a dependency-safe wave");

    const uploader = createClient();
    let remoteFileId = snapshotState.remoteFileId;
    if (remoteFileId === null && uploader.uploadFile !== undefined) {
      const upload = uploader.uploadFile.bind(uploader);
      const uploaded = await limiter.run(() => upload(
        `astral-snapshot-${snapshot.revision}.json`,
        snapshotText(snapshot),
      ));
      remoteFileId = uploaded.id;
      snapshotState = { ...snapshotState, remoteFileId };
    }

    const staged: Record<string, UnitResult<object>> = currentWave?.baseSnapshotRevision === snapshot.revision
      ? { ...currentWave.staged }
      : {};
    const lanes = plans.map(laneCheckpoint);
    currentWave = {
      id: waveNumber,
      baseSnapshotRevision: snapshot.revision,
      lanes,
      staged,
      conflicts: [],
      assembled: false,
    };
    await hooks.onWave?.(currentWave);
    await checkpoint(null);

    const laneRuns = plans.map(async (plan, index): Promise<void> => {
      const lane = lanes[index];
      if (lane === undefined) throw new Error(`Missing checkpoint for ${plan.id}`);
      const client = createClient(lane.conversationId ?? undefined);
      lane.status = "running";
      let contextTokens = 0;
      const local: Record<string, UnitResult<object>> = {};
      for (const unit of plan.units) {
        const existing = staged[unit.id];
        if (existing !== undefined) {
          local[unit.id] = existing;
          lane.completed.push(unit.id);
          continue;
        }
        const estimate = unit.tokens ?? 1_800;
        if (contextTokens > 0 && contextTokens + estimate > (config.chart.laneContextTokens ?? 60_000)) break;
        lane.active = active(unit.id);
        currentWave = { ...(currentWave as WaveCheckpoint), lanes: [...lanes], staged: { ...staged } };
        await checkpoint(lane.active);
        try {
          const result = await executeUnit({
            calculation,
            unit,
            client,
            createClient,
            config,
            limiter,
            hooks,
            earlier: { ...completed, ...local },
            snapshot,
            remoteFileId,
            counters,
          });
          staged[unit.id] = result;
          local[unit.id] = result;
          lane.completed.push(unit.id);
          lane.conversationId = conversation(client, counters);
          lane.active = null;
          contextTokens += estimate;
          currentWave = { ...(currentWave as WaveCheckpoint), lanes: [...lanes], staged: { ...staged } };
          await checkpoint(null);
        } catch (cause: unknown) {
          lane.status = "failed";
          lane.failureKind = failureKind(cause);
          lane.active = { ...active(unit.id), failureKind: lane.failureKind };
          currentWave = { ...(currentWave as WaveCheckpoint), lanes: [...lanes], staged: { ...staged } };
          await checkpoint(lane.active);
          throw cause;
        }
      }
      lane.status = "complete";
      lane.active = null;
      const laneUnits = Object.fromEntries(lane.completed.map((id) => [id, staged[id] as UnitResult<object>]));
      const issues = coherenceIssues(laneUnits, "lane");
      if (issues.length > 0) {
        lane.status = "blocked";
        currentWave = {
          ...(currentWave as WaveCheckpoint),
          lanes: [...lanes],
          conflicts: [...new Set([...(currentWave?.conflicts ?? []), ...issues.map(({ message }) => message)])],
          staged: { ...staged },
        };
      }
      await checkpoint(null);
    });

    const outcomes = await Promise.allSettled(laneRuns);
    const failed = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    if (failed !== undefined) throw failed.reason;

    const waveIssues = coherenceIssues(staged, "wave");
    if (waveIssues.length > 0) {
      const affected = conflictingUnits(waveIssues);
      currentWave = {
        ...(currentWave as WaveCheckpoint),
        conflicts: [...new Set([...(currentWave?.conflicts ?? []), ...waveIssues.map(({ message }) => message)])],
        staged: { ...staged },
      };
      for (const id of affected) {
        const unit = calls.find((candidate) => candidate.id === id);
        if (unit === undefined) continue;
        const client = createClient();
        const correction = waveIssues.filter(({ units }) => units.includes(id)).map(({ message }) => message);
        const result = await executeUnit({
          calculation,
          unit,
          client,
          createClient,
          config,
          limiter,
          hooks,
          earlier: { ...completed, ...staged },
          snapshot,
          remoteFileId,
          counters,
          correction,
        });
        staged[id] = {
          ...result,
          provenance: { ...(result.provenance ?? {}), repairKind: "coherence_correction" },
        };
      }
      const remaining = coherenceIssues(staged, "wave");
      if (remaining.length > 0) {
        currentWave = { ...(currentWave as WaveCheckpoint), conflicts: remaining.map(({ message }) => message), staged: { ...staged } };
        await checkpoint(null);
        throw new Error(`Wave coherence failed: ${remaining.map(({ message }) => message).join("; ")}`);
      }
    }

    for (const id of order) {
      const result = staged[id];
      if (result === undefined) continue;
      completed[id] = result;
      calls.find((call) => call.id === id)?.onAccept?.(result.value);
    }
    currentWave = { ...(currentWave as WaveCheckpoint), staged: { ...staged }, assembled: true, conflicts: [] };
    snapshot = await buildSnapshot(calculation, completed, order, snapshot.revision + 1);
    snapshotState = {
      revision: snapshot.revision,
      sha256: snapshot.sha256,
      remoteFileId: null,
      acceptedOrder: [...snapshot.acceptedOrder],
    };
    await hooks.onWave?.(currentWave);
    await checkpoint(null);
    currentWave = null;
  }

  const conversationIds = [...counters.conversations];
  const conversationId = primaryConversationId ?? conversationIds[0] ?? recovered.conversationId;
  if (conversationId === null || conversationId === undefined) {
    throw new Error("Interpretation completed without a conversation ID");
  }
  return {
    conversationId,
    units: completed,
    calls: counters.calls,
    retries: counters.retries,
    orchestration: "waves",
    conversationIds,
    snapshotRevision: snapshot.revision,
    waves: waveNumber,
  };
};
