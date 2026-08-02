import { ProgressTracker } from "../src/progress/tracker.js";
import type { WorkUnit } from "../src/progress/work.js";
import { diagnosticHooks } from "../src/llm/orchestrate/diagnostics.js";
import { buildSnapshot, snapshotText } from "../src/llm/orchestrate/snapshot.js";
import type {
  InterpretationCall,
  InterpretationDiagnostic,
  InterpretationRecovery,
  UnitResult,
  WaveCheckpoint,
} from "../src/llm/orchestrate/types.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const units: WorkUnit[] = [
  { id: "calculate", label: "Calculate", kind: "local", weight: 1, phase: "deterministic" },
  { id: "tropical.one", label: "One", kind: "small", weight: 1, phase: "interpretation" },
  { id: "tropical.two", label: "Two", kind: "big", weight: 3, phase: "interpretation" },
  { id: "validate", label: "Validate", kind: "local", weight: 1, phase: "final" },
];

const tracker = new ProgressTracker("progress-019", units, 0, 3);
tracker.start("calculate", "calculating", 0);
tracker.complete("calculate", 1);
equal(tracker.snapshot(1).progress.percent, 1, "deterministic phase share");

tracker.start("tropical.one", "interpreting", 1, 1, "gpt-small");
tracker.start("tropical.two", "interpreting", 1, 1, "gpt-big");
tracker.setWave({
  id: 2,
  staged: {},
  lanes: [
    { id: "lane-1", assignments: ["tropical.one"] },
    { id: "lane-2", assignments: ["tropical.two"] },
  ],
});
const parallel = tracker.snapshot(2);
equal(parallel.details?.activeLanes.length, 2, "concurrent active lanes");
equal(parallel.details?.currentWave, 2, "current wave detail");
assert(parallel.stage.label.includes("2 interpretation lanes"), "parallel stage label");

tracker.complete("tropical.one", 3);
tracker.complete("tropical.two", 5);
equal(tracker.snapshot(5).progress.percent, 99, "accepted interpretation share");
tracker.start("validate", "assembling", 5);
tracker.complete("validate", 6);
equal(tracker.finish(6).progress.percent, 100, "final validation share");

const recovered = new ProgressTracker("recovered-019", units, 0, 3);
recovered.restoreAccepted(["calculate", "tropical.one"]);
const recoveredProgress = recovered.snapshot(10);
assert(recoveredProgress.progress.percent > 1, "accepted recovered work must rebuild progress");
assert(recoveredProgress.progress.percent < 99, "unfinished recovered work must not appear complete");

const accepted: Record<string, UnitResult<object>> = {
  "tropical.one": {
    id: "tropical.one",
    value: { summary: "You build confidence through deliberate action." },
    attempts: 1,
    model: "gpt-small",
  },
};
const calculation = { provenance: { calculationFingerprint: `sha256:${"4".repeat(64)}` } };
const first = await buildSnapshot(calculation, accepted, ["tropical.one", "tropical.two"], 0);
const same = await buildSnapshot(calculation, accepted, ["tropical.one", "tropical.two"], 0);
equal(first.sha256, same.sha256, "canonical snapshot identity");
equal(JSON.parse(snapshotText(first)).sha256, first.sha256, "serialised snapshot identity");
const changed = await buildSnapshot(calculation, {
  ...accepted,
  "tropical.two": {
    id: "tropical.two",
    value: { summary: "You balance independence with practical cooperation." },
    attempts: 1,
    model: "gpt-big",
  },
}, ["tropical.one", "tropical.two"], 1);
assert(changed.sha256 !== first.sha256, "accepted work must change the snapshot identity");

const events: InterpretationDiagnostic[] = [];
const hooks = diagnosticHooks({ onDiagnostic: (event) => { events.push(event); } }, () => "2026-08-02T22:00:00.000Z");
const call = {
  id: "tropical.one",
  label: "One",
  kind: "small",
  tokens: 800,
} as InterpretationCall;
const wave: WaveCheckpoint = {
  id: 3,
  baseSnapshotRevision: 1,
  lanes: [{
    id: "lane-1",
    conversationId: "conv-1",
    assignments: [call.id],
    completed: [],
    active: null,
    status: "running",
    failureKind: null,
  }],
  staged: {},
  conflicts: [],
  assembled: false,
};
await hooks.onWave?.(wave);
hooks.onStart?.(call, 1, "gpt-small");
hooks.onRetry?.(call, 1, ["complete the final sentence"]);
hooks.onComplete?.({ ...accepted["tropical.one"]!, provenance: { repairKind: "truncation_condensation" } });
const checkpoint: InterpretationRecovery = {
  conversationId: "conv-1",
  units: accepted,
  calls: 2,
  retries: 1,
  active: null,
  orchestration: "waves",
  foundationComplete: true,
  snapshot: {
    revision: first.revision,
    sha256: first.sha256,
    remoteFileId: null,
    acceptedOrder: [...first.acceptedOrder],
    localSnapshot: snapshotText(first),
  },
  wave,
};
await hooks.onCheckpoint?.(checkpoint);
assert(events.some(({ kind }) => kind === "wave"), "wave diagnostic");
assert(events.some(({ kind, lane }) => kind === "start" && lane === "lane-1"), "lane start diagnostic");
assert(events.some(({ kind, errors }) => kind === "retry" && errors.length === 1), "retry diagnostic");
assert(events.some(({ kind, repairKind }) => kind === "complete" && repairKind === "truncation_condensation"), "repair diagnostic");
assert(events.some(({ kind, snapshotSha256 }) => kind === "checkpoint" && snapshotSha256 === first.sha256), "snapshot diagnostic");

console.log("1..1");
