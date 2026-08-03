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
  createClient: SchemaClientFactory;
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

const activeCopy = (value: ActiveInterpretationUnit | null): ActiveInterpretationUnit | null => {
  if (value === null) return null;
  return {
    id: value.id,
    attempt: value.attempt,
    correction: [...value.correction],
    ...(value.failureKind === undefined ? {} : { failureKind: value.failureKind }),
  };
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

const repairInstruction = [
  "The primary interpretation response was truncated or malformed.",
  "Return a concise, complete replacement for the entire strict schema from the beginning.",
  "Preserve the conclusions and useful meaning present in partialCandidate instead of independently changing the interpretation.",
  "Condense verbose material, complete unfinished thoughts and fill missing properties only from deterministicInput and snapshot context.",
  "Write directly to the person using you and your.",
  "Never place internal JSON references in prose; references belong only in sourceRefs.",
  "Finish every required property, sentence and list entry.",
].join("\n");

const completionRepairInstruction = [
  "The primary interpretation parsed successfully, but one or more prose fields were cut off.",
  "Return a concise, complete replacement for the entire strict schema.",
  "Preserve every sound conclusion and source reference from partialCandidate.",
  "Condense wording where necessary and finish every incomplete sentence or list entry naturally.",
  "Do not invent a new interpretation or change already complete conclusions.",
  "Use deterministicInput and snapshot context only to complete missing meaning.",
  "Write directly to the person using you and your.",
  "Never place internal JSON references in prose; references belong only in sourceRefs.",
].join("\n");

const auditRepairInstruction = [
  "A deterministic NLP audit found one or more possible problems in an otherwise parsed interpretation.",
  "Inspect auditErrors and return the same strict schema with only the smallest necessary corrections.",
  "Preserve every sound conclusion, nuance and source reference from partialCandidate.",
  "Do not flatten context-dependent differences or rewrite the interpretation merely to make it more uniform.",
  "Correct only the specific wording, relevance, duplication, direct-address, formatting or reference issues that are actually present.",
  "Use deterministicInput and snapshot context only to verify or repair the flagged material.",
  "Write directly to the person using you and your.",
  "Never place internal JSON references in prose; references belong only in sourceRefs.",
  "Return the complete strict schema without commentary, reasoning or preamble.",
].join("\n");

const repairTruncation = async (
  options: ExecutionOptions,
  cause: unknown,
  context: UnitContext,
  attempt: number,
  originalModel: string,
): Promise<UnitResult<object> | null> => {
  const repairClient = options.createClient();
  const model = options.config.openai.smallModel;
  const partialCandidate = rawText(cause);
  options.counters.calls += 1;
  options.counters.retries += 1;
  options.hooks.onRepair?.(
    options.unit,
    attempt,
    model,
    [responseStatus(cause) ?? "malformed_json"],
  );
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
    await options.hooks.onReject?.(options.unit, attempt, model, output, audited);
    return null;
  }
  return {
    id: options.unit.id,
    value: audited.value,
    attempts: attempt,
    model: originalModel,
    provenance: { repairedBy: model, repairKind: "truncation_condensation" },
  };
};

const repairAudited = async (
  options: ExecutionOptions,
  partial: object,
  initialAudit: UnitAudit<object>,
  context: UnitContext,
  attempt: number,
  originalModel: string,
): Promise<UnitResult<object> | null> => {
  const repairClient = options.createClient();
  const model = options.config.openai.smallModel;
  const repair = initialAudit.repair ?? "audit";
  const instruction = repair === "completion"
    ? completionRepairInstruction
    : auditRepairInstruction;
  const repairKind = repair === "completion"
    ? "completion_condensation" as const
    : "audit_correction" as const;
  let candidate = partial;
  let errors = [...initialAudit.errors];

  for (let pass = 1; pass <= 2; pass += 1) {
    options.counters.calls += 1;
    options.counters.retries += 1;
    options.hooks.onRepair?.(options.unit, attempt, model, errors);

    let output: object;
    try {
      const input = {
        instruction,
        repairKind: repair,
        repairPass: pass,
        auditErrors: errors,
        partialCandidate: candidate,
        deterministicInput: options.unit.input(context),
      };
      output = await options.limiter.run(() => repairClient.run(
        options.unit.shape,
        options.snapshot === null
          ? input
          : snapshotInput(options.remoteFileId, options.snapshot, input),
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
    if (audited.valid) {
      return {
        id: options.unit.id,
        value: audited.value,
        attempts: attempt,
        model: originalModel,
        provenance: { repairedBy: model, repairKind },
      };
    }

    await options.hooks.onReject?.(options.unit, attempt, model, output, audited);
    if (audited.repair === undefined) return null;
    candidate = audited.value;
    errors = [...audited.errors];
  }

  return null;
};

const executeUnit = async (options: ExecutionOptions): Promise<UnitResult<object>> => {
  let correction = [
    ...(options.resume?.correction ?? []),
    ...options.correction,
  ];
  const maximumAttempts = options.config.chart.maxRetries;
  const firstAttempt = options.resume?.attempt ?? 1;
  if (!Number.isSafeInteger(firstAttempt) || firstAttempt < 1 || firstAttempt > maximumAttempts) {
    throw new Error(`Recovery attempt is invalid for ${options.unit.id}`);
  }

  for (let attempt = firstAttempt; attempt <= maximumAttempts; attempt += 1) {
    const model = modelFor(options.config, options.unit, attempt);
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
            reasoning: { effort: effortFor(options.config, options.unit, model) },
            max_output_tokens: tokensFor(options.config, options.unit),
          },
          retries: 0,
        },
      ));
      conversation(options.client, options.counters);
    } catch (cause: unknown) {
      if (options.client.id !== undefined) conversation(options.client, options.counters);
      const kind = failureKind(cause);
      if (kind === "truncation") {
        const repaired = await repairTruncation(options, cause, context, attempt, model);
        if (repaired !== null) {
          options.hooks.onComplete?.(repaired);
          await options.onState(null);
          return repaired;
        }
      }
      if ((kind === "schema" || kind === "truncation") && attempt < maximumAttempts) {
        options.counters.retries += 1;
        correction = [
          `Previous output was incomplete or malformed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ];
        options.hooks.onRetry?.(options.unit, attempt, correction);
        await options.onState(state(options.unit, attempt + 1, correction, kind));
        continue;
      }
      await options.onState(state(options.unit, attempt, correction, kind));
      throw cause;
    }

    const audited = options.unit.audit(output, context);
    let rejected = false;
    if (!audited.valid && audited.repair !== undefined) {
      await options.hooks.onReject?.(options.unit, attempt, model, output, audited);
      rejected = true;
      const repaired = await repairAudited(options, audited.value, audited, context, attempt, model);
      if (repaired !== null) {
        options.hooks.onComplete?.(repaired);
        await options.onState(null);
        return repaired;
      }
    }

    const softAccepted = !audited.valid && audited.soft === true;
    if (audited.valid || softAccepted) {
      const result: UnitResult<object> = { id: options.unit.id, value: audited.value, attempts: attempt, model };
      if (softAccepted) options.hooks.onSoftAccept?.(options.unit, attempt, audited.errors);
      options.hooks.onComplete?.(result);
      await options.onState(null);
      return result;
    }

    if (!rejected) await options.hooks.onReject?.(options.unit, attempt, model, output, audited);
    correction = [...audited.errors];
    if (attempt < maximumAttempts) {
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
    throw new Error(`Interpretation unit ${options.unit.id} failed audit: ${audited.errors.join("; ")}`);
  }
  throw new Error(`Interpretation unit ${options.unit.id} produced no accepted output`);
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
  const audited = call.audit(result.value, { calculation, earlier, correction: [] });
  if (!audited.valid && audited.soft !== true) {
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
  if (Object.keys(recovery.units).length > 0 && recovery.conversationId === null) {
    throw new Error("Recovered interpretation units require a conversation ID");
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
    if (!Number.isSafeInteger(active.attempt) || active.attempt < 1 || active.attempt > maximumAttempts) {
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
    staged[call.id] = validateResult(
      calculation,
      call,
      result,
      { ...completed, ...staged },
      maximumAttempts,
    );
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
        createClient,
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
      ? restoreStaged(calculation, calls, completed, currentWave, config.chart.maxRetries)
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
        } catch (cause: unknown) {
          lane.status = "failed";
          lane.failureKind = failureKind(cause);
          lane.active = lane.active === null
            ? state(unit, 1, [], lane.failureKind)
            : { ...lane.active, failureKind: lane.failureKind };
          currentWave = { ...(currentWave as WaveCheckpoint), lanes: [...lanes], staged: { ...staged } };
          await checkpoint(lane.active);
          throw cause;
        }
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
          earlier: { ...completed, ...without(staged, id) },
          snapshot,
          remoteFileId,
          counters,
          resume: null,
          correction,
          onState: checkpoint,
        });
        staged[id] = {
          ...result,
          provenance: { ...(result.provenance ?? {}), repairKind: "coherence_correction" },
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
    await checkpoint(null);
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