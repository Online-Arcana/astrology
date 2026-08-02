import type { StrictShape } from "../orchestrate/types.js";

export type Schema = Record<string, unknown>;

export const text = (): Schema => ({ type: "string" });

export const textEnum = <T extends string>(
  values: readonly T[],
): Schema => {
  if (values.length === 0) {
    throw new Error("Text enum requires at least one permitted value");
  }
  return { type: "string", enum: [...values] };
};

export const nullableText = (): Schema => ({
  anyOf: [text(), { type: "null" }],
});

export const list = (
  items: Schema,
  minItems = 0,
  maxItems?: number,
): Schema => ({
  type: "array",
  items,
  minItems,
  ...(maxItems === undefined ? {} : { maxItems }),
});

export const object = (
  properties: Record<string, Schema>,
): Schema => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

export const literal = <T extends string>(
  value: T,
): Schema => ({
  type: "string",
  const: value,
});

export const strictShape = <T extends object>(
  name: string,
  schema: Schema,
  parse?: (value: unknown) => T,
): StrictShape<T> => ({
  name,
  schema,
  ...(parse === undefined ? {} : { parse }),
});
