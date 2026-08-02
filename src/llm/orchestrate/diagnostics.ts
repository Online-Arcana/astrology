import type {
  InterpretationDiagnostic,
  InterpretationDiagnosticKind,
  RunHooks,
  WaveCheckpoint,
} from "./types.js";

const laneFor = (wave: WaveCheckpoint | null, unitId: string | null): string | null => {
  if (wave === null || unitId === null) return null;
  return wave.lanes.find(({ assignments }) => assignments.includes(unitId))?.id ?? null;
};

const base = (
  kind: InterpretationDiagnosticKind,
  now: () => string,
  wave: WaveCheckpoint | null,
): InterpretationDiagnostic => ({
  kind,
  timestamp: now(),
  unitId: null,
  attempt: null,
  model: null,
  configuredOutputTokens: null,
  errors: [],
  repairKind: null,
  snapshotRevision: null,
  snapshotSha256: null,
  wave: wave?.id ?? null,
  lane: null,
  failureKind: null,
});

export const diagnosticHooks = (
  hooks: RunHooks,
  now: () => string,
): RunHooks => {
  const emit = hooks.onDiagnostic;
  if (emit === undefined) return hooks;
  let wave: WaveCheckpoint | null = null;

  return {
    ...hooks,
    onStart: (unit, attempt, model) => {
      hooks.onStart?.(unit, attempt, model);
      void emit({
        ...base("start", now, wave),
        unitId: unit.id,
        attempt,
        model,
        configuredOutputTokens: unit.tokens ?? null,
        lane: laneFor(wave, unit.id),
      });
    },
    onRetry: (unit, attempt, errors) => {
      hooks.onRetry?.(unit, attempt, errors);
      void emit({
        ...base("retry", now, wave),
        unitId: unit.id,
        attempt,
        configuredOutputTokens: unit.tokens ?? null,
        errors: [...errors],
        lane: laneFor(wave, unit.id),
      });
    },
    onReject: async (unit, attempt, model, output, audit) => {
      await hooks.onReject?.(unit, attempt, model, output, audit);
      await emit({
        ...base("reject", now, wave),
        unitId: unit.id,
        attempt,
        model,
        configuredOutputTokens: unit.tokens ?? null,
        errors: [...audit.errors],
        lane: laneFor(wave, unit.id),
        failureKind: "audit",
      });
    },
    onComplete: (result) => {
      hooks.onComplete?.(result);
      void emit({
        ...base("complete", now, wave),
        unitId: result.id,
        attempt: result.attempts,
        model: result.model,
        repairKind: result.provenance?.repairKind ?? null,
        lane: laneFor(wave, result.id),
      });
    },
    onCheckpoint: async (checkpoint) => {
      await hooks.onCheckpoint?.(checkpoint);
      await emit({
        ...base("checkpoint", now, checkpoint.wave ?? wave),
        unitId: checkpoint.active?.id ?? null,
        attempt: checkpoint.active?.attempt ?? null,
        errors: [...(checkpoint.active?.correction ?? [])],
        snapshotRevision: checkpoint.snapshot?.revision ?? null,
        snapshotSha256: checkpoint.snapshot?.sha256 ?? null,
        lane: laneFor(checkpoint.wave ?? wave, checkpoint.active?.id ?? null),
        failureKind: checkpoint.active?.failureKind ?? null,
      });
    },
    onWave: async (value) => {
      wave = value;
      await hooks.onWave?.(value);
      await emit({
        ...base("wave", now, value),
        errors: [...value.conflicts],
        snapshotRevision: value.baseSnapshotRevision,
        failureKind: value.lanes.find(({ failureKind }) => failureKind !== null)?.failureKind ?? null,
      });
    },
  };
};
