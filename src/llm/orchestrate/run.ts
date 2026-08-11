import type { Config } from "../../config.js";
import { reconstructUnit } from "../reconstruct/reconstruct.js";
import { runInterpretation as runRoutedInterpretation } from "./run-v2.js";
import type {
  InterpretationCall,
  InterpretationRecovery,
  InterpretationRun,
  RunHooks,
  SchemaClientFactory,
  UnitResult,
} from "./types.js";

const localConversationId = (): string =>
  `local-final-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const safeAttempts = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 1;

const safeCount = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

const normaliseResult = (
  call: InterpretationCall,
  result: UnitResult<object>,
): UnitResult<object> => {
  if (result.provenance?.repairedBy !== "deterministic" || call.semanticMap === undefined) return result;
  const rebuilt = reconstructUnit({ unit: call, candidates: [result.value] });
  return {
    ...result,
    id: call.id,
    value: rebuilt.value,
    attempts: safeAttempts(result.attempts),
    model: result.model.trim().length > 0 ? result.model : "deterministic",
    provenance: {
      ...result.provenance,
      repairedBy: "deterministic",
      repairKind: rebuilt.usedXmlFallback ? "xml_fallback" : "deterministic_reconstruction",
      fallbackFields: rebuilt.fallbackFields,
      auditWarnings: [
        ...(result.provenance.auditWarnings ?? []),
        ...rebuilt.warnings,
      ],
    },
  };
};

const normaliseRun = (
  calls: readonly InterpretationCall[],
  run: InterpretationRun,
): InterpretationRun => {
  const byId = new Map(calls.map((call) => [call.id, call]));
  return {
    ...run,
    units: Object.fromEntries(Object.entries(run.units).map(([id, result]) => {
      const call = byId.get(id);
      return [id, call === undefined ? result : normaliseResult(call, result)];
    })),
  };
};

const normaliseRecovery = (
  calls: readonly InterpretationCall[],
  recovery: InterpretationRecovery | null,
): InterpretationRecovery | null => {
  if (recovery === null) return null;
  const byId = new Map(calls.map((call) => [call.id, call]));
  const normaliseMap = (
    values: Readonly<Record<string, UnitResult<object>>>,
  ): Record<string, UnitResult<object>> => Object.fromEntries(
    Object.entries(values).map(([id, result]) => {
      const call = byId.get(id);
      return [id, call === undefined ? result : normaliseResult(call, result)];
    }),
  );
  return {
    ...recovery,
    units: normaliseMap(recovery.units),
    ...(recovery.wave === null || recovery.wave === undefined
      ? {}
      : {
          wave: {
            ...recovery.wave,
            staged: normaliseMap(recovery.wave.staged),
          },
        }),
  };
};

const finalFallback = (
  calls: readonly InterpretationCall[],
  hooks: RunHooks,
  recovery: InterpretationRecovery | null,
  cause: unknown,
): InterpretationRun => {
  const units: Record<string, UnitResult<object>> = {};
  for (const call of calls) {
    const recovered = recovery?.units[call.id];
    const rebuilt = reconstructUnit({
      unit: call,
      candidates: recovered === undefined ? [] : [recovered.value],
    });
    const warning = `Final production fallback: ${cause instanceof Error ? cause.message : String(cause)}`;
    const result: UnitResult<object> = {
      id: call.id,
      value: rebuilt.value,
      attempts: safeAttempts(recovered?.attempts),
      model: recovered?.model?.trim() ? recovered.model : "deterministic",
      provenance: {
        ...(recovered?.provenance ?? {}),
        repairedBy: "deterministic",
        repairKind: rebuilt.usedXmlFallback ? "xml_fallback" : "deterministic_reconstruction",
        fallbackFields: rebuilt.fallbackFields,
        auditWarnings: [
          ...(recovered?.provenance?.auditWarnings ?? []),
          ...rebuilt.warnings,
          warning,
        ],
      },
    };
    units[call.id] = result;
    try { call.onAccept?.(result.value); } catch { /* Customer delivery outranks optional callbacks. */ }
    try { hooks.onComplete?.(result); } catch { /* Diagnostics must not block delivery. */ }
  }
  const recoveredConversation = recovery?.conversationId;
  const conversationId = recoveredConversation?.trim() ? recoveredConversation : localConversationId();
  return {
    conversationId,
    units,
    calls: safeCount(recovery?.calls),
    retries: safeCount(recovery?.retries),
    orchestration: "waves",
    conversationIds: [conversationId],
    snapshotRevision: safeCount(recovery?.snapshot?.revision),
    waves: safeCount(recovery?.wave?.id),
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
  const normalisedRecovery = normaliseRecovery(calls, recovery);
  try {
    const run = await runRoutedInterpretation(
      calculation,
      calls,
      config,
      createClient,
      hooks,
      normalisedRecovery,
    );
    return normaliseRun(calls, run);
  } catch (cause: unknown) {
    if (config.chart.throwOnInterpretationFailure) throw cause;
    return finalFallback(calls, hooks, normalisedRecovery, cause);
  }
};
