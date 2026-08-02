import { ProgressTracker } from "../../progress/tracker.js";
import type { WorkUnit } from "../../progress/work.js";
import type { ChartProgress } from "../../types/progress.js";
import type { InterpretationCall, RunHooks } from "./types.js";

const weightFor = (unit: InterpretationCall): number => {
  const tokens = unit.tokens ?? (unit.kind === "big" ? 3_200 : 1_800);
  return Math.max(1, Math.ceil(tokens / 800));
};

export const interpretationWork = (units: readonly InterpretationCall[]): WorkUnit[] => units.map((unit) => ({
  id: unit.id,
  label: unit.label,
  kind: unit.kind,
  weight: weightFor(unit),
  phase: "interpretation",
}));

export const progressHooks = (
  tracker: ProgressTracker,
  now: () => number,
  emit: (progress: ChartProgress) => void,
  accepted: readonly string[] = [],
): RunHooks => {
  tracker.restoreAccepted(accepted);
  return {
    onStart: (unit, attempt, model) => {
      tracker.start(unit.id, "interpreting", now(), attempt, model);
      emit(tracker.snapshot(now()));
    },
    onRetry: (unit) => {
      tracker.markRetry(unit.id);
      emit(tracker.snapshot(now()));
    },
    onComplete: (result) => {
      tracker.complete(result.id, now());
      emit(tracker.snapshot(now()));
    },
    onWave: (wave) => {
      tracker.setWave(wave);
      emit(tracker.snapshot(now()));
    },
  };
};
