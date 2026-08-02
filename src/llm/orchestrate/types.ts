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

export interface SchemaClient {
  readonly id: string | undefined;
  run<T extends object>(shape: StrictShape<T>, input: unknown, options: SchemaCall): Promise<T>;
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
  shape: StrictShape<object>;
  allowedSourceRefs: ReadonlySet<JsonRef>;
  input(context: UnitContext): unknown;
  audit(value: object, context: UnitContext): UnitAudit<object>;
}

export interface UnitAudit<T extends object> {
  valid: boolean;
  value: T;
  errors: string[];
}

export interface UnitResult<T extends object> {
  id: string;
  value: T;
  attempts: number;
  model: string;
}

export interface ActiveInterpretationUnit {
  id: string;
  attempt: number;
  correction: readonly string[];
}

export interface InterpretationRecovery {
  conversationId: string | null;
  units: Readonly<Record<string, UnitResult<object>>>;
  calls: number;
  retries: number;
  active: ActiveInterpretationUnit | null;
}

export type InterpretationCheckpoint = InterpretationRecovery;

export interface InterpretationRun {
  conversationId: string;
  units: Readonly<Record<string, UnitResult<object>>>;
  calls: number;
  retries: number;
}

export interface RunHooks {
  onStart?: (unit: InterpretationCall, attempt: number, model: string) => void;
  onComplete?: (result: UnitResult<object>) => void;
  onRetry?: (unit: InterpretationCall, attempt: number, errors: readonly string[]) => void;
  onCheckpoint?: (checkpoint: InterpretationCheckpoint) => void | Promise<void>;
}
