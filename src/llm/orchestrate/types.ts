import type { JsonRef } from "../../types/base.js";
import type { WorkKind } from "../../progress/work.js";

export interface StrictShape<T extends object> {
  name: string;
  schema: Record<string, unknown>;
  parse?: (value: unknown) => T;
}

export interface SchemaCall {
  body: Record<string, unknown> & { model: string };
  retries?: number;
  retryDelayMs?: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  purpose: "user_data";
}

export interface SchemaClient {
  readonly id: string | undefined;
  run<T extends object>(shape: StrictShape<T>, input: unknown, options: SchemaCall): Promise<T>;
  uploadFile?(name: string, content: string): Promise<UploadedFile>;
  retrieveResponse?(id: string): Promise<unknown>;
}

export type SchemaClientFactory = (conversationId?: string) => SchemaClient;
export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface UnitContext {
  calculation: unknown;
  earlier: Readonly<Record<string, unknown>>;
  correction: readonly string[];
}

export interface InterpretationCall {
  id: string;
  label: string;
  kind: Extract<WorkKind, "big" | "small">;
  effort?: ReasoningEffort;
  tokens?: number;
  dependsOn?: readonly string[];
  shape: StrictShape<object>;
  allowedSourceRefs: ReadonlySet<JsonRef>;
  input(context: UnitContext): unknown;
  audit(value: object, context: UnitContext): UnitAudit<object>;
  onAccept?: (value: object) => void;
}

export interface UnitAudit<T extends object> {
  valid: boolean;
  value: T;
  errors: string[];
  soft?: boolean;
}

export interface UnitResult<T extends object> {
  id: string;
  value: T;
  attempts: number;
  model: string;
  provenance?: {
    repairedBy?: string;
    repairKind?: "truncation_condensation" | "audit_correction" | "coherence_correction";
    migratedFromVersion?: string;
  };
}

export type InterpretationFailureKind =
  | "transport"
  | "rate_limit"
  | "timeout"
  | "truncation"
  | "schema"
  | "audit"
  | "coherence";

export interface ActiveInterpretationUnit {
  id: string;
  attempt: number;
  correction: readonly string[];
  failureKind?: InterpretationFailureKind;
}

export interface SnapshotCheckpoint {
  revision: number;
  sha256: string;
  remoteFileId: string | null;
  acceptedOrder: string[];
  localSnapshot?: string;
}

export type LaneStatus = "pending" | "running" | "blocked" | "complete" | "failed";

export interface LaneCheckpoint {
  id: string;
  conversationId: string | null;
  assignments: string[];
  completed: string[];
  active: ActiveInterpretationUnit | null;
  status: LaneStatus;
  failureKind: InterpretationFailureKind | null;
  position?: number;
}

export type WavePhase = "running" | "barrier" | "assembled";

export interface WaveCheckpoint {
  id: number;
  baseSnapshotRevision: number;
  lanes: LaneCheckpoint[];
  staged: Readonly<Record<string, UnitResult<object>>>;
  conflicts: string[];
  assembled: boolean;
  phase?: WavePhase;
  stagedOrder?: string[];
}

export interface InterpretationRecovery {
  conversationId: string | null;
  units: Readonly<Record<string, UnitResult<object>>>;
  calls: number;
  retries: number;
  active: ActiveInterpretationUnit | null;
  orchestration?: "serial" | "waves";
  foundationComplete?: boolean;
  snapshot?: SnapshotCheckpoint | null;
  wave?: WaveCheckpoint | null;
}

export type InterpretationCheckpoint = InterpretationRecovery;

export interface InterpretationRun {
  conversationId: string;
  units: Readonly<Record<string, UnitResult<object>>>;
  calls: number;
  retries: number;
  orchestration?: "serial" | "waves";
  conversationIds?: string[];
  snapshotRevision?: number;
  waves?: number;
}

export type InterpretationDiagnosticKind =
  | "start"
  | "retry"
  | "reject"
  | "complete"
  | "checkpoint"
  | "wave";

export interface InterpretationDiagnostic {
  kind: InterpretationDiagnosticKind;
  timestamp: string;
  unitId: string | null;
  attempt: number | null;
  model: string | null;
  configuredOutputTokens: number | null;
  errors: string[];
  repairKind: UnitResult<object>["provenance"] extends infer P
    ? P extends { repairKind?: infer R } ? R | null : null
    : null;
  snapshotRevision: number | null;
  snapshotSha256: string | null;
  wave: number | null;
  lane: string | null;
  failureKind: InterpretationFailureKind | null;
}

export interface RunHooks {
  onStart?: (unit: InterpretationCall, attempt: number, model: string) => void;
  onComplete?: (result: UnitResult<object>) => void;
  onRetry?: (unit: InterpretationCall, attempt: number, errors: readonly string[]) => void;
  onReject?: (
    unit: InterpretationCall,
    attempt: number,
    model: string,
    output: object,
    audit: UnitAudit<object>,
  ) => void | Promise<void>;
  onSoftAccept?: (unit: InterpretationCall, attempt: number, warnings: readonly string[]) => void;
  onCheckpoint?: (checkpoint: InterpretationCheckpoint) => void | Promise<void>;
  onWave?: (wave: WaveCheckpoint) => void | Promise<void>;
  onDiagnostic?: (event: InterpretationDiagnostic) => void | Promise<void>;
}
