import { ProgressTracker } from "../../progress/tracker.js";
import type { WorkUnit } from "../../progress/work.js";
import type { ChartProgress } from "../../types/progress.js";
import type { InterpretationCall, RunHooks } from "./types.js";

export const interpretationWork = (units: readonly InterpretationCall[]): WorkUnit[] => units.map((unit) => ({
  id: unit.id,
  label: unit.label,
  kind: unit.kind,
  weight: unit.kind === "big" ? 5 : 2,
}));

export const progressHooks = (
  tracker: ProgressTracker,
  now: () => number,
  emit: (progress: ChartProgress) => void,
): RunHooks => ({
  onStart: (unit, attempt, model) => {
    tracker.start(unit.id, "interpreting", now(), attempt, model);
    emit(tracker.snapshot(now()));
  },
  onRetry: () => emit(tracker.snapshot(now())),
  onComplete: (result) => {
    tracker.complete(result.id, now());
    emit(tracker.snapshot(now()));
  },
});
