import type { Config } from "../../config.js";
import { coherenceIssues, conflictingUnits } from "./coherence.js";
import { foundationPlan, wavePlan, type LanePlan } from "./planner.js";
import { AdaptiveLimiter } from "./rateLimit.js";
import { buildSnapshot, snapshotInput, snapshotText, type InterpretationSnapshot } from "./snapshot.js";
import { fieldsFromAuditErrors, reconstructUnit } from "../reconstruct/reconstruct.js";
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
  UnitAudit,
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
  config: Config;
  limiter: AdaptiveLimiter;
  hooks: RunHooks;
  earlier: Readonly<Record<string, UnitResult<object>>>;
  snapshot: InterpretationSnapshot | null;
  remoteFileId: string | null;
  counters: Counters;
  resume: ActiveInterpretationUnit | null;
  correction: readonly string[];
  onState(active: ActiveInterpretationUnit | null): Promise<void>;
}

const paidAttempts = 2;

const entryModelFor = (config: Config, kind: InterpretationCall["kind"]): string =>
  kind === "big" ? config.openai.bigModel : config.openai.smallModel;

const escalationModelFor = (config: Config, kind: InterpretationCall["kind"]): string =>
  kind === "big" ? config.openai.bigEscalationModel : config.openai.smallEscalationModel;

const modelFor = (config: Config, unit: InterpretationCall, attempt: number): string =>
  attempt <= 1 ? entryModelFor(config, unit.kind) : escalationModelFor(config, unit.kind);

const effortFor = (config: Config, unit: InterpretationCall, attempt: number): string =>
  attempt > 1 && unit.kind === "small" ? "low" : unit.effort ?? config.openai.reasoning;

const tokensFor = (config: Config, unit: InterpretationCall): number =>
  Math.min(unit.tokens ?? config.openai.maxOutputTokens, config.openai.maxOutputTokens);

const count = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
};

const activeCopy = (value: ActiveInterpretationUnit | null): ActiveInterpretationUnit | null => {
  if (value === null) return null;
  return {
    id: value.id,
    attempt: value.attempt,
    correction: [...value.correction],
    ...(value.failureKind === undefined ? {} : { failureKind: value.failureKind }),
  };
};

const conversation = (client: SchemaClient, counters: Counters): string | null => {
  const id = client.id;
  if (!id) return null;
  counters.conversations.add(id);
  return id;
};

const localConversationId = (): string =>
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

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

const objectCandidate = (value: unknown): object | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const candidateFromCause = (cause: unknown): object | null => {
  const raw = rawText(cause).trim();
  if (raw.length === 0) return null;
  const attempts = [raw];
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) attempts.push(raw.slice(first, last + 1));
  for (const attempt of attempts) {
    try {
      const value = objectCandidate(JSON.parse(attempt));
      if (value !== null) return value;
    } catch {
      // A malformed partial response remains available only as an audit reason.
    }
  }
  return null;
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

const safeAudit = (
  unit: InterpretationCall,
  value: object,
  context: UnitContext,
): UnitAudit<object> => {
  try {
    return unit.audit(value, context);
  } catch (cause: unknown) {
    return {
      valid: false,
      value,
      errors: [`Audit threw: ${cause instanceof Error ? cause.message : String(cause)}`],
      repair: "audit",
    };
  }
};

const state = (
  unit: InterpretationCall,
  attempt: number,
  correction: readonly string[],
  kind?: InterpretationFailureKind,
): ActiveInterpretationUnit => ({
  id: unit.id,
  attempt,
  correction: [...correction],
  ...(kind === undefined ? {} : { failureKind: kind }),
});

const reconstructionResult = async (
  options: ExecutionOptions,
  candidates: readonly object[],
  context: UnitContext,
  attempt: number,
  model: string,
  errors: readonly string[],
): Promise<UnitResult<object>> => {
  options.hooks.onRepair?.(options.unit, attempt, "deterministic", errors);
  let rebuilt = reconstructUnit({ unit: options.unit, candidates });
  let audited = safeAudit(options.unit, rebuilt.value, context);

  if (!audited.valid) {
    const forced = fieldsFromAuditErrors(options.unit, audited.errors);
    if (forced.size > 0) {
      rebuilt = reconstructUnit({ unit: options.unit, candidates: [rebuilt.value, ...candidates], forceFields: forced });
      audited = safeAudit(options.unit, rebuilt.value, context);
    }
  }

  if (options.config.chart.throwOnInterpretationFailure) {
    throw new Error(`Interpretation unit ${options.unit.id} required deterministic reconstruction: ${errors.join("; ")}`);
  }

  const warnings = [...new Set([...rebuilt.warnings, ...audited.errors])];
  if (!audited.valid) options.hooks.onSoftAccept?.(options.unit, attempt, warnings);
  const result: UnitResult<object> = {
    id: options.unit.id,
    value: audited.value,
    attempts: Math.max(1, Math.min(attempt, paidAttempts)),
    model: candidates.length === 0 ? "deterministic" : model,
    provenance: {
      repairedBy: "deterministic",
      repairKind: rebuilt.usedXmlFallback ? "xml_fallback" : "deterministic_reconstruction",
      fallbackFields: [...rebuilt.fallbackFields],
      auditWarnings: warnings,
    },
  };
  options.hooks.onComplete?.(result);
  await options.onState(null);
  return result;
};

const executeUnit = async (options: ExecutionOptions): Promise<UnitResult<object>> => {
  let correction = [...(options.resume?.correction ?? []), ...options.correction];
  const candidates: object[] = [];
  const resumed = options.resume?.attempt ?? 1;
  const firstAttempt = Number.isSafeInteger(resumed) && resumed >= 1
    ? Math.min(resumed, paidAttempts)
    : 1;
  let lastModel = modelFor(options.config, options.unit, firstAttempt);

  if ((options.resume?.attempt ?? 1) > paidAttempts) {
    const context: UnitContext = { calculation: options.calculation, earlier: options.earlier, correction };
    return reconstructionResult(options, candidates, context, paidAttempts, lastModel, correction);
  }

  for (let attempt = firstAttempt; attempt <= paidAttempts; attempt += 1) {
    const model = modelFor(options.config, options.unit, attempt);
    lastModel = model;
    const context: UnitContext = {
      calculation: options.calculation,
      earlier: options.earlier,
      correction,
    };
    options.hooks.onStart?.(options.unit, attempt, model);
    await options.onState(state(options.unit, attempt, correction));
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
            reasoning: { effort: effortFor(options.config, options.unit, attempt) },
            max_output_tokens: tokensFor(options.config, options.unit),
          },
          retries: 0,
        },
      ));
      conversation(options.client, options.counters);
    } catch (cause: unknown) {
      conversation(options.client, options.counters);
      const partial = candidateFromCause(cause);
      if (partial !== null) candidates.push(partial);
      const kind = failureKind(cause);
      correction = [
        `Previous output failed before acceptance: ${cause instanceof Error ? cause.message : String(cause)}`,
      ];
      if (attempt < paidAttempts) {
        options.counters.retries += 1;
        options.hooks.onRetry?.(options.unit, attempt, correction);
        await options.onState(state(options.unit, attempt + 1, correction, kind));
        continue;
      }
      await options.onState(state(options.unit, attempt, correction, kind));
      return reconstructionResult(options, candidates, context, attempt, model, correction);
    }

    const audited = safeAudit(options.unit, output, context);
    candidates.push(audited.value);
    if (audited.valid) {
      const result: UnitResult<object> = { id: options.unit.id, value: audited.value, attempts: attempt, model };
      options.hooks.onComplete?.(result);
      await options.onState(null);
      return result;
    }

    await options.hooks.onReject?.(options.unit, attempt, model, output, audited);
    correction = [...audited.errors];
    if (attempt < paidAttempts) {
      options.counters.retries += 1;
      options.hooks.onRetry?.(options.unit, attempt, correction);
      await options.onState(state(
        options.unit,
        attempt + 1,
        correction,
        audited.repair === "completion" ? "truncation" : "audit",
      ));
      continue;
    }
    await options.onState(state(
      options.unit,
      attempt,
      correction,
      audited.repair === "completion" ? "truncation" : "audit",
    ));
    return reconstructionResult(options, candidates, context, attempt, model, correction);
  }

  const context: UnitContext = { calculation: options.calculation, earlier: options.earlier, correction };
  return reconstructionResult(options, candidates, context, paidAttempts, lastModel, correction);
};

const validateResult = (
  calculation: unknown,
  call: InterpretationCall,
  result: UnitResult<object>,
  earlier: Readonly<Record<string, UnitResult<object>>>,
  maximumAttempts: number,
): UnitResult<object> => {
  if (result.id !== call.id) throw new Error(`Recovered interpretation unit ID mismatch for ${call.id}`);
  if (!Number.isSafeInteger(result.attempts) || result.attempts < 1 || result.attempts > maximumAttempts) {
    throw new Error(`Recovered interpretation attempts are invalid for ${call.id}`);
  }
  if (typeof result.model !== "string" || result.model.length === 0) {
    throw new Error(`Recovered interpretation model is invalid for ${call.id}`);
  }
  const audited = safeAudit(call, result.value, { calculation, earlier, correction: [] });
  if (!audited.valid && result.provenance?.repairedBy !== "deterministic") {
    throw new Error(`Recovered interpretation unit ${call.id} failed audit: ${audited.errors.join("; ")}`);
  }
  return { ...result, value: audited.value };
};

const restore = (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  recovery: InterpretationRecovery,
  maximumAttempts: number,
): Record<string, UnitResult<object>> => {
  const known = new Map(calls.map((call) => [call.id, call]));
  for (const id of Object.keys(recovery.units)) {
    if (!known.has(id)) throw new Error(`Recovery contains unknown interpretation unit ${id}`);
  }

  const completed: Record<string, UnitResult<object>> = {};
  for (const call of calls) {
    const result = recovery.units[call.id];
    if (result === undefined) continue;
    const restored = validateResult(calculation, call, result, completed, maximumAttempts);
    completed[call.id] = restored;
    call.onAccept?.(restored.value);
  }

  const active = recovery.active;
  if (active !== null) {
    const call = known.get(active.id);
    if (call === undefined || completed[active.id] !== undefined) {
      throw new Error("Recovery active unit must be unfinished and present in the interpretation plan");
    }
    if (!Number.isSafeInteger(active.attempt) || active.attempt < 1) {
      throw new Error(`Recovery attempt is invalid for ${active.id}`);
    }
    if (!active.correction.every((value) => typeof value === "string")) {
      throw new Error(`Recovery correction is invalid for ${active.id}`);
    }
  }
  return completed;
};

const restoreStaged = (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  completed: Readonly<Record<string, UnitResult<object>>>,
  wave: WaveCheckpoint | null,
  maximumAttempts: number,
): Record<string, UnitResult<object>> => {
  if (wave === null || wave.assembled) return {};
  const staged: Record<string, UnitResult<object>> = {};
  const byId = new Map(calls.map((call) => [call.id, call]));
  for (const call of calls) {
    const result = wave.staged[call.id];
    if (result === undefined || completed[call.id] !== undefined) continue;
    staged[call.id] = validateResult(calculation, call, result, { ...completed, ...staged }, maximumAttempts);
  }
  for (const id of Object.keys(wave.staged)) {
    if (!byId.has(id)) throw new Error(`Recovery wave contains unknown interpretation unit ${id}`);
  }
  return staged;
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

const laneCheckpoint = (plan: LanePlan): LaneCheckpoint => ({
  id: plan.id,
  conversationId: null,
  assignments: plan.units.map(({ id }) => id),
  completed: [],
  active: null,
  status: "pending",
  failureKind: null,
});

const recoveredPlans = (
  calls: readonly InterpretationCall[],
  wave: WaveCheckpoint,
): LanePlan[] => {
  const known = new Map(calls.map((call) => [call.id, call]));
  return wave.lanes.map((lane) => {
    const units = lane.assignments.map((id) => {
      const call = known.get(id);
      if (call === undefined) throw new Error(`Recovery lane ${lane.id} contains unknown unit ${id}`);
      return call;
    });
    return {
      id: lane.id,
      units,
      estimatedTokens: units.reduce((total, call) => total + (call.tokens ?? 1_800), 0),
    };
  });
};

const without = (
  values: Readonly<Record<string, UnitResult<object>>>,
  id: string,
): Record<string, UnitResult<object>> => Object.fromEntries(
  Object.entries(values).filter(([key]) => key !== id),
);

const deterministicUnit = (
  calculation: unknown,
  call: InterpretationCall,
  earlier: Readonly<Record<string, UnitResult<object>>>,
  cause: unknown,
): UnitResult<object> => {
  const rebuilt = reconstructUnit({ unit: call, candidates: [] });
  const audited = safeAudit(call, rebuilt.value, { calculation, earlier, correction: [String(cause)] });
  return {
    id: call.id,
    value: audited.value,
    attempts: 1,
    model: "deterministic",
    provenance: {
      repairedBy: "deterministic",
      repairKind: "xml_fallback",
      fallbackFields: rebuilt.fallbackFields,
      auditWarnings: [...new Set([...rebuilt.warnings, ...audited.errors, String(cause)])],
    },
  };
};

const emergencyRun = (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  hooks: RunHooks,
  cause: unknown,
): InterpretationRun => {
  const units: Record<string, UnitResult<object>> = {};
  for (const call of calls) {
    const result = deterministicUnit(calculation, call, units, cause);
    units[call.id] = result;
    call.onAccept?.(result.value);
    hooks.onComplete?.(result);
  }
  const id = localConversationId();
  return {
    conversationId: id,
    units,
    calls: 0,
    retries: 0,
    orchestration: "waves",
    conversationIds: [id],
    snapshotRevision: 0,
    waves: 0,
  };
};

const runCore = async (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  config: Config,
  createClient: SchemaClientFactory,
  hooks: RunHooks,
  recovery: InterpretationRecovery | null,
): Promise<InterpretationRun> => {
  if (calls.length === 0) throw new Error("Interpretation requires at least one unit");
  if (new Set(calls.map(({ id }) => id)).size !== calls.length) throw new Error("Interpretation unit IDs must be unique");

  const recovered = recovery ?? emptyRecovery();
  const completed = restore(calculation, calls, recovered, Math.max(config.chart.maxRetries, paidAttempts));
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

  const checkpoint = async (active: ActiveInterpretationUnit | null): Promise<void> => {
    if (hooks.onCheckpoint === undefined) return;
    const value: InterpretationCheckpoint = {
      conversationId: primaryConversationId,
      units: { ...completed },
      calls: counters.calls,
      retries: counters.retries,
      active: activeCopy(active),
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
    const remaining = Math.max(0, maximum - Object.keys(completed).length);
    const foundation = remaining === 0 ? [] : foundationPlan(calls, completed, remaining);
    const client = createClient(primaryConversationId ?? undefined);
    let contextTokens = 0;
    for (const unit of foundation) {
      const estimate = unit.tokens ?? 1_800;
      if (contextTokens > 0 && contextTokens + estimate > (config.chart.laneContextTokens ?? 60_000)) break;
      const resume = recovered.active?.id === unit.id ? activeCopy(recovered.active) : null;
      const result = await executeUnit({
        calculation,
        unit,
        client,
        config,
        limiter,
        hooks,
        earlier: completed,
        snapshot: null,
        remoteFileId: null,
        counters,
        resume,
        correction: [],
        onState: checkpoint,
      });
      completed[unit.id] = result;
      unit.onAccept?.(result.value);
      contextTokens += estimate;
      primaryConversationId = conversation(client, counters) ?? primaryConversationId;
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
    const resumingWave = currentWave !== null
      && !currentWave.assembled
      && currentWave.baseSnapshotRevision === snapshot.revision;
    if (!resumingWave) waveNumber += 1;
    const plans = resumingWave
      ? recoveredPlans(calls, currentWave as WaveCheckpoint)
      : wavePlan(calls, completed, config.chart.laneCount ?? 4, config.chart.laneUnits ?? 10);
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

    const staged = resumingWave
      ? restoreStaged(calculation, calls, completed, currentWave, Math.max(config.chart.maxRetries, paidAttempts))
      : {};
    const lanes = resumingWave
      ? (currentWave as WaveCheckpoint).lanes.map((lane): LaneCheckpoint => ({
          ...lane,
          assignments: [...lane.assignments],
          completed: [...lane.completed],
          active: activeCopy(lane.active),
          status: lane.status === "complete" && lane.assignments.some((id) => staged[id] === undefined)
            ? "pending"
            : lane.status,
        }))
      : plans.map(laneCheckpoint);
    currentWave = {
      id: waveNumber,
      baseSnapshotRevision: snapshot.revision,
      lanes,
      staged: { ...staged },
      conflicts: resumingWave ? [...(currentWave as WaveCheckpoint).conflicts] : [],
      assembled: false,
    };
    await hooks.onWave?.(currentWave);
    await checkpoint(null);

    const laneRuns = plans.map(async (plan, index): Promise<void> => {
      const lane = lanes[index];
      if (lane === undefined) throw new Error(`Missing checkpoint for ${plan.id}`);
      const client = createClient(lane.conversationId ?? undefined);
      lane.status = "running";
      lane.failureKind = null;
      let contextTokens = 0;
      const local: Record<string, UnitResult<object>> = {};

      for (const unit of plan.units) {
        const existing = staged[unit.id];
        if (existing !== undefined) {
          local[unit.id] = existing;
          if (!lane.completed.includes(unit.id)) lane.completed.push(unit.id);
          continue;
        }
        const estimate = unit.tokens ?? 1_800;
        if (contextTokens > 0 && contextTokens + estimate > (config.chart.laneContextTokens ?? 60_000)) break;
        const resume = lane.active?.id === unit.id ? activeCopy(lane.active) : null;
        const result = await executeUnit({
          calculation,
          unit,
          client,
          config,
          limiter,
          hooks,
          earlier: { ...completed, ...local },
          snapshot,
          remoteFileId,
          counters,
          resume,
          correction: [],
          onState: async (active) => {
            lane.active = activeCopy(active);
            currentWave = { ...(currentWave as WaveCheckpoint), lanes: [...lanes], staged: { ...staged } };
            await checkpoint(active);
          },
        });
        staged[unit.id] = result;
        local[unit.id] = result;
        if (!lane.completed.includes(unit.id)) lane.completed.push(unit.id);
        lane.conversationId = conversation(client, counters);
        lane.active = null;
        contextTokens += estimate;
        currentWave = { ...(currentWave as WaveCheckpoint), lanes: [...lanes], staged: { ...staged } };
        await checkpoint(null);
      }

      lane.status = "complete";
      lane.active = null;
      const laneUnits = Object.fromEntries(lane.completed
        .filter((id) => staged[id] !== undefined)
        .map((id) => [id, staged[id] as UnitResult<object>]));
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
      await checkpoint(null);

      for (const id of affected) {
        const unit = calls.find((candidate) => candidate.id === id);
        const prior = staged[id];
        if (unit === undefined || prior === undefined) continue;
        const correction = waveIssues.filter(({ units }) => units.includes(id)).map(({ message }) => message);
        const client = createClient();
        const result = await reconstructionResult({
          calculation,
          unit,
          client,
          config,
          limiter,
          hooks,
          earlier: { ...completed, ...without(staged, id) },
          snapshot,
          remoteFileId,
          counters,
          resume: null,
          correction,
          onState: checkpoint,
        }, [prior.value], {
          calculation,
          earlier: { ...completed, ...without(staged, id) },
          correction,
        }, prior.attempts, prior.model, correction);
        staged[id] = {
          ...result,
          provenance: { ...(result.provenance ?? {}), repairKind: "coherence_reconstruction" },
        };
        currentWave = { ...(currentWave as WaveCheckpoint), staged: { ...staged } };
        await checkpoint(null);
      }

      const remaining = coherenceIssues(staged, "wave");
      if (remaining.length > 0) {
        currentWave = {
          ...(currentWave as WaveCheckpoint),
          conflicts: remaining.map(({ message }) => message),
          staged: { ...staged },
        };
        await checkpoint(null);
        if (config.chart.throwOnInterpretationFailure) {
          throw new Error(`Wave coherence failed: ${remaining.map(({ message }) => message).join("; ")}`);
        }
      }
    }

    for (const id of order) {
      const result = staged[id];
      if (result === undefined) continue;
      completed[id] = result;
      calls.find((call) => call.id === id)?.onAccept?.(result.value);
    }
    currentWave = { ...(currentWave as WaveCheckpoint), staged: { ...staged }, assembled: true };
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
    await checkpoint(null);
  }

  const conversationIds = [...counters.conversations];
  const conversationId = primaryConversationId ?? conversationIds[0] ?? recovered.conversationId ?? localConversationId();
  if (conversationIds.length === 0) conversationIds.push(conversationId);
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

export const runInterpretation = async (
  calculation: unknown,
  calls: readonly InterpretationCall[],
  config: Config,
  createClient: SchemaClientFactory,
  hooks: RunHooks = {},
  recovery: InterpretationRecovery | null = null,
): Promise<InterpretationRun> => {
  try {
    return await runCore(calculation, calls, config, createClient, hooks, recovery);
  } catch (cause: unknown) {
    if (config.chart.throwOnInterpretationFailure) throw cause;
    return emergencyRun(calculation, calls, hooks, cause);
  }
};
