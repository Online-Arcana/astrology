import { auditWorldviewText } from "../../interpretation/corpus/worldview.js";
import type { JsonRef } from "../../types/base.js";
import type { InterpretationCall } from "../orchestrate/types.js";
import { fallbackCatalogue, type FallbackFamily } from "./catalogue.js";
import { semanticFallbackText } from "./semantic.js";

export interface ReconstructionResult {
  value: object;
  fallbackFields: string[];
  warnings: string[];
  usedXmlFallback: boolean;
}

interface ReconstructionOptions {
  unit: InterpretationCall;
  candidates: readonly object[];
  forceFields?: ReadonlySet<string>;
}

type Schema = Record<string, unknown>;
type RecordValue = Record<string, unknown>;

const record = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const human = (value: string): string => value
  .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
  .replaceAll(/[._-]+/gu, " ")
  .replaceAll(/\s+/gu, " ")
  .trim();

const topicFor = (unit: InterpretationCall): string => {
  const label = human(unit.label);
  if (label.length > 0) return label;
  return human(unit.id) || "this part of your chart";
};

const schemaProperties = (schema: Schema): Record<string, Schema> => {
  const value = schema["properties"];
  if (!record(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Schema] => record(entry[1])),
  );
};

const familyFor = (unit: InterpretationCall): FallbackFamily => {
  if (unit.id === "generated-name") return "generated-name";
  const fields = new Set(Object.keys(schemaProperties(unit.shape.schema)));
  if (fields.has("closingPortrait")) return "final-synthesis";
  if (fields.has("bestExpression")) return "compatibility-sign";
  if (fields.size === 2 && fields.has("overview") && fields.has("sourceRefs")) return "compatibility-overview";
  if (fields.has("centralThemes") && fields.has("narrative")) return "synthesis";
  if (fields.has("desireStyle")) return "sexuality";
  if (fields.has("affectionStyle")) return "romance";
  if (fields.has("vocationalThemes")) return "career";
  if (fields.has("earningStyle")) return "money";
  return "section";
};

const constString = (schema: Schema): string | null =>
  typeof schema["const"] === "string" ? schema["const"] as string : null;

const enumString = (schema: Schema): string | null => {
  const values = schema["enum"];
  if (!Array.isArray(values)) return null;
  return values.find((value): value is string => typeof value === "string") ?? null;
};

const nullable = (schema: Schema): boolean => {
  const variants = schema["anyOf"];
  return Array.isArray(variants) && variants.some((variant) => record(variant) && variant["type"] === "null");
};

const valueType = (schema: Schema): string | null =>
  typeof schema["type"] === "string" ? schema["type"] as string : null;

const stripProcessNarration = (value: string): string => value
  .replaceAll(/(?:^|(?<=[.!?]\s))(?:I (?:will|shall|can|am going to)|Here (?:is|are)|This (?:analysis|interpretation|response)|The supplied (?:JSON|data)|Based on the supplied (?:JSON|data))[^.!?]*(?:[.!?]|$)\s*/giu, "")
  .replaceAll(/#\/[A-Za-z0-9_./~\-]+/gu, "")
  .replaceAll(/\s+/gu, " ")
  .trim();

const incompleteEnding = /(?:\b(?:and|or|but|because|although|while|which|that|when|where|with|to|of|for|from|through|by|as)|[,;:\-–—])\s*$/iu;

const lastCompleteSentence = (value: string): string => {
  const matches = [...value.matchAll(/[^.!?]+[.!?](?=\s|$)/gu)];
  return matches.at(-1)?.[0]?.trim() ?? "";
};

const directAddress = (value: string): string => {
  if (/\b(?:you|your|yourself)\b/iu.test(value)) return value;
  if (/^(?:the|this|that|a|an|difficulty|strength|tension|attraction|compatibility|desire|career|money|romance|intimacy)\b/iu.test(value)) {
    const first = value.charAt(0).toLocaleLowerCase();
    return `You may find that ${first}${value.slice(1)}`;
  }
  return `You may experience ${value.charAt(0).toLocaleLowerCase()}${value.slice(1)}`;
};

const cleanText = (raw: unknown, key: string): string | null => {
  if (typeof raw !== "string") return null;
  let value = stripProcessNarration(raw);
  if (value.length === 0) return null;
  const worldview = auditWorldviewText(value);
  if (!worldview.safe || worldview.requiresReview) return null;
  if (incompleteEnding.test(value)) value = lastCompleteSentence(value);
  if (value.length === 0) return null;
  if (key !== "title" && key !== "value" && key !== "sign" && !value.startsWith("#/")) {
    value = directAddress(value);
  }
  if (key !== "title" && key !== "value" && key !== "sign" && !/[.!?]$/u.test(value)) value += ".";
  return value;
};

const candidateValues = (
  candidates: readonly object[],
  key: string,
): unknown[] => candidates
  .slice()
  .reverse()
  .flatMap((candidate) => record(candidate) && key in candidate ? [candidate[key]] : []);

const fallbackText = (
  family: FallbackFamily,
  key: string,
  unit: InterpretationCall,
  schema: Schema,
): string => {
  const familyFields = fallbackCatalogue[family];
  const commonFields = fallbackCatalogue.section;
  const raw = familyFields[key]
    ?? commonFields[key]
    ?? (key === "title" ? "{topic}" : "You may approach {topicLower} with growing awareness and flexibility.");
  const topic = topicFor(unit);
  const sign = constString(schema) ?? human(unit.id.split(".").at(-1) ?? "this sign");
  return raw
    .replaceAll("{topicLower}", topic.toLocaleLowerCase())
    .replaceAll("{topic}", topic)
    .replaceAll("{sign}", sign.charAt(0).toLocaleUpperCase() + sign.slice(1));
};

const allowedRefs = (unit: InterpretationCall): JsonRef[] => [...unit.allowedSourceRefs];

const validRef = (value: unknown, unit: InterpretationCall): value is JsonRef =>
  typeof value === "string" && unit.allowedSourceRefs.has(value as JsonRef);

const minItems = (schema: Schema): number =>
  typeof schema["minItems"] === "number" && Number.isSafeInteger(schema["minItems"])
    ? Math.max(0, schema["minItems"] as number)
    : 0;

const maxItems = (schema: Schema): number | null =>
  typeof schema["maxItems"] === "number" && Number.isSafeInteger(schema["maxItems"])
    ? Math.max(0, schema["maxItems"] as number)
    : null;

interface BuildState {
  family: FallbackFamily;
  unit: InterpretationCall;
  candidates: readonly object[];
  forceFields: ReadonlySet<string>;
  fallbackFields: Set<string>;
  warnings: string[];
  usedXmlFallback: boolean;
}

const scalarFallback = (state: BuildState, key: string, schema: Schema): string => {
  state.fallbackFields.add(key);
  if (state.unit.semanticMap !== undefined) {
    const semantic = semanticFallbackText(state.unit.semanticMap, key);
    if (semantic !== null) return semantic;
    state.warnings.push(`Semantic reconstruction had no safe rendering for ${key}; XML fallback used`);
  }
  state.usedXmlFallback = true;
  return fallbackText(state.family, key, state.unit, schema);
};

const buildString = (state: BuildState, key: string, schema: Schema, values: readonly unknown[]): string => {
  const constant = constString(schema);
  if (constant !== null) return constant;
  const permitted = schema["enum"];
  if (Array.isArray(permitted)) {
    const candidate = values.find((value) => typeof value === "string" && permitted.includes(value));
    if (typeof candidate === "string") return candidate;
    const selected = enumString(schema);
    if (selected !== null) {
      state.fallbackFields.add(key);
      return selected;
    }
  }
  if (!state.forceFields.has(key)) {
    for (const value of values) {
      const cleaned = cleanText(value, key);
      if (cleaned !== null) return cleaned;
    }
  }
  return scalarFallback(state, key, schema);
};

const buildArray = (state: BuildState, key: string, schema: Schema, values: readonly unknown[]): unknown[] => {
  const itemSchema = record(schema["items"]) ? schema["items"] as Schema : { type: "string" };
  if (key === "sourceRefs") {
    const refs = values
      .flatMap((value) => Array.isArray(value) ? value : [])
      .filter((value): value is JsonRef => validRef(value, state.unit));
    const unique = [...new Set(refs)];
    if (unique.length > 0 && !state.forceFields.has(key)) return unique;
    const fallback = allowedRefs(state.unit).slice(0, Math.max(1, minItems(schema)));
    if (fallback.length > 0) {
      state.fallbackFields.add(key);
      return fallback;
    }
    return [];
  }

  const output: unknown[] = [];
  if (!state.forceFields.has(key)) {
    for (const raw of values) {
      if (!Array.isArray(raw)) continue;
      for (const item of raw) {
        if (valueType(itemSchema) === "string" || nullable(itemSchema)) {
          const cleaned = cleanText(item, key);
          if (cleaned !== null && !output.includes(cleaned)) output.push(cleaned);
        } else if (record(item)) {
          output.push(item);
        }
      }
      if (output.length > 0) break;
    }
  }

  const minimum = Math.max(1, minItems(schema));
  while (output.length < minimum) {
    output.push(scalarFallback(state, key, itemSchema));
  }
  const maximum = maxItems(schema);
  return maximum === null ? output : output.slice(0, maximum);
};

const buildValue = (
  state: BuildState,
  key: string,
  schema: Schema,
  values: readonly unknown[],
): unknown => {
  const type = valueType(schema);
  if (type === "object") {
    const properties = schemaProperties(schema);
    const objects = values.filter(record);
    return Object.fromEntries(Object.entries(properties).map(([child, childSchema]) => [
      child,
      buildValue(state, child, childSchema, objects.flatMap((value) => child in value ? [value[child]] : [])),
    ]));
  }
  if (type === "array") return buildArray(state, key, schema, values);
  if (type === "string") return buildString(state, key, schema, values);
  if (nullable(schema)) {
    const cleaned = state.forceFields.has(key)
      ? null
      : values.map((value) => cleanText(value, key)).find((value): value is string => value !== null);
    return cleaned ?? scalarFallback(state, key, schema);
  }
  state.warnings.push(`Unsupported reconstruction schema at ${key}`);
  return scalarFallback(state, key, schema);
};

const absoluteValue = (
  unit: InterpretationCall,
  family: FallbackFamily,
  key: string,
  schema: Schema,
): unknown => {
  const constant = constString(schema);
  if (constant !== null) return constant;
  const selected = enumString(schema);
  if (selected !== null) return selected;
  const variants = schema["anyOf"];
  if (Array.isArray(variants)) {
    const concrete = variants.find((variant) => record(variant) && variant["type"] !== "null");
    if (record(concrete)) return absoluteValue(unit, family, key, concrete);
    return null;
  }
  const type = valueType(schema);
  if (type === "object") {
    return Object.fromEntries(Object.entries(schemaProperties(schema)).map(([child, childSchema]) => [
      child,
      absoluteValue(unit, family, child, childSchema),
    ]));
  }
  if (type === "array") {
    if (key === "sourceRefs") return allowedRefs(unit).slice(0, Math.max(1, minItems(schema)));
    const item = record(schema["items"]) ? schema["items"] as Schema : { type: "string" };
    return [absoluteValue(unit, family, key, item)];
  }
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  return fallbackText(family, key, unit, schema);
};

const parsed = (unit: InterpretationCall, value: object): object => {
  if (unit.shape.parse === undefined) return value;
  try {
    return unit.shape.parse(value);
  } catch {
    return value;
  }
};

export const fieldsFromAuditErrors = (
  unit: InterpretationCall,
  errors: readonly string[],
): Set<string> => {
  const keys = Object.keys(schemaProperties(unit.shape.schema));
  const selected = new Set<string>();
  for (const error of errors) {
    for (const key of keys) {
      if (error.includes(`.${key}`) || error.includes(`[${key}]`) || new RegExp(`\\b${key}\\b`, "u").test(error)) {
        selected.add(key);
      }
    }
  }
  return selected;
};

export const reconstructUnit = ({
  unit,
  candidates,
  forceFields = new Set<string>(),
}: ReconstructionOptions): ReconstructionResult => {
  try {
    const state: BuildState = {
      family: familyFor(unit),
      unit,
      candidates,
      forceFields,
      fallbackFields: new Set<string>(),
      warnings: [],
      usedXmlFallback: false,
    };
    const value = buildValue(state, unit.id, unit.shape.schema, candidates);
    const objectValue = record(value) ? value : {};
    return {
      value: parsed(unit, objectValue),
      fallbackFields: [...state.fallbackFields],
      warnings: state.warnings,
      usedXmlFallback: state.usedXmlFallback,
    };
  } catch (cause: unknown) {
    const family: FallbackFamily = unit.id === "generated-name" ? "generated-name" : "section";
    const value = absoluteValue(unit, family, unit.id, unit.shape.schema);
    const objectValue = record(value) ? value : {};
    return {
      value: parsed(unit, objectValue),
      fallbackFields: Object.keys(schemaProperties(unit.shape.schema)),
      warnings: [`Deterministic reconstruction recovered from an internal error: ${cause instanceof Error ? cause.message : String(cause)}`],
      usedXmlFallback: true,
    };
  }
};