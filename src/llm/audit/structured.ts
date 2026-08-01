import { refsValid } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import { auditField, auditList, type FieldProfile } from "./field.js";
import type { UnitAudit } from "../orchestrate/types.js";

const structuralStrings = new Set(["status", "sign", "domain"]);

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface State {
  calculation: unknown;
  allowed: ReadonlySet<JsonRef>;
  profile: FieldProfile;
  earlier: string[];
  errors: string[];
}

const references = (value: unknown, state: State, path: string): JsonRef[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.startsWith("#/"))) {
    state.errors.push(`${path} must contain local JSON references`);
    return [];
  }
  const refs = value as JsonRef[];
  if (!refsValid(state.calculation, refs, state.allowed)) {
    state.errors.push(`${path} contains unresolved, unavailable or unpermitted source references`);
  }
  return [...refs];
};

const text = (value: string, state: State, path: string): string => {
  const result = auditField(value, {
    ...state.profile,
    id: path,
    priorFields: [...(state.profile.priorFields ?? []), ...state.earlier],
  });
  if (!result.valid) state.errors.push(...result.issues.map(({ message }) => message));
  if (result.value.length >= 20) state.earlier.push(result.value);
  return result.value;
};

const visit = (value: unknown, state: State, path: string, key: string | null): unknown => {
  if (key === "sourceRefs") return references(value, state, path);
  if (typeof value === "string") {
    return key !== null && structuralStrings.has(key) ? value : text(value, state, path);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      const result = auditList(value, {
        ...state.profile,
        id: path,
        priorFields: [...(state.profile.priorFields ?? []), ...state.earlier],
      });
      if (!result.valid) state.errors.push(...result.issues.map(({ message }) => message));
      state.earlier.push(...result.values.filter((item) => item.length >= 20));
      return result.values;
    }
    return value.map((item, index) => visit(item, state, `${path}[${index}]`, null));
  }
  if (!record(value)) {
    state.errors.push(`${path} has an unsupported value`);
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(value)) {
    output[childKey] = visit(child, state, `${path}.${childKey}`, childKey);
  }
  return output;
};

export const auditStructured = <T extends object>(
  value: T,
  calculation: unknown,
  allowed: ReadonlySet<JsonRef>,
  profile: FieldProfile,
): UnitAudit<T> => {
  const state: State = {
    calculation,
    allowed,
    profile,
    earlier: [],
    errors: [],
  };
  const audited = visit(value, state, profile.id, null) as T;
  return {
    valid: state.errors.length === 0,
    value: audited,
    errors: state.errors,
  };
};
