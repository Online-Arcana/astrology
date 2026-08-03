import { refsValid } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import { auditCompletion } from "./completion.js";
import {
  auditField,
  auditList,
  type FieldProfile,
  type NarrativeEntry,
} from "./field.js";
import type { UnitAudit } from "../orchestrate/types.js";

const structuralStrings = new Set(["status", "sign", "domain"]);

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface State {
  calculation: unknown;
  allowed: ReadonlySet<JsonRef>;
  profile: FieldProfile;
  earlier: NarrativeEntry[];
  errors: string[];
}

const report = (state: State, errors: readonly string[]): void => {
  state.errors.push(...errors);
};

const keyFor = (path: string): string | null => {
  const match = path.match(/(?:^|\.)([^.[\]]+)(?:\[\d+\])?$/u);
  return match?.[1] ?? null;
};

const profileAt = (profile: FieldProfile, path: string): FieldProfile => {
  const key = keyFor(path);
  if (key === null) return profile;
  const specific = profile.fieldLexicons?.[key];
  if (specific === undefined) return profile;
  return {
    ...profile,
    semanticField: key,
    lexicon: [...new Set([...profile.lexicon, ...specific])],
  };
};

const references = (value: unknown, state: State, path: string): JsonRef[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.startsWith("#/"))) {
    report(state, [`${path} must contain local JSON references`]);
    return [];
  }
  const refs = value as JsonRef[];
  if (!refsValid(state.calculation, refs, state.allowed)) {
    report(state, [`${path} contains unresolved, unavailable or unpermitted source references`]);
  }
  return [...refs];
};

const auditText = (value: string, state: State, path: string): string => {
  const profile = profileAt(state.profile, path);
  const result = auditField(value, {
    ...profile,
    id: path,
    priorFields: [...(profile.priorFields ?? []), ...state.earlier],
  });
  if (!result.valid) report(state, result.issues.map(({ message }) => message));
  if (result.value.length >= 20) state.earlier.push({ path, value: result.value });
  return result.value;
};

const visit = (
  value: unknown,
  state: State,
  path: string,
  key: string | null,
): unknown => {
  if (key === "sourceRefs") return references(value, state, path);
  if (typeof value === "string") {
    return key !== null && structuralStrings.has(key) ? value : auditText(value, state, path);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      const profile = profileAt(state.profile, path);
      const result = auditList(value, {
        ...profile,
        id: path,
        priorFields: [...(profile.priorFields ?? []), ...state.earlier],
      });
      if (!result.valid) report(state, result.issues.map(({ message }) => message));
      result.values.forEach((item, index) => {
        if (item.length >= 20) state.earlier.push({ path: `${path}[${index}]`, value: item });
      });
      return result.values;
    }
    return value.map((item, index) => visit(item, state, `${path}[${index}]`, null));
  }

  if (!record(value)) {
    report(state, [`${path} has an unsupported value`]);
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
  const errors = [...new Set([
    ...state.errors,
    ...auditCompletion(audited, profile.id).map(({ message }) => message),
  ])];
  const needsRepair = errors.length > 0;

  return {
    valid: !needsRepair,
    value: audited,
    errors,
    // NLP is a free detector, not an execution gate. The orchestrator sends
    // every finding to the small model for the smallest possible correction.
    // Should heuristic repair remain imperfect, keep the parsed candidate and
    // finish the chart rather than throwing away all accepted work.
    soft: needsRepair,
    ...(needsRepair ? { repair: "completion" as const } : {}),
  };
};
