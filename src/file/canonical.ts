import type { Json } from "../types/base.js";

const fail = (kind: string): never => {
  throw new TypeError(`Value is not canonical JSON: ${kind}`);
};

const object = (value: object): string => {
  const proto = Object.getPrototypeOf(value) as object | null;
  if (proto !== Object.prototype && proto !== null) return fail("non-plain object");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => {
      const item = record[key];
      if (item === undefined) return fail("undefined property");
      return `${JSON.stringify(key)}:${write(item)}`;
    })
    .join(",")}}`;
};

const write = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail("non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(write).join(",")}]`;
  if (typeof value === "object") return object(value);
  return fail(typeof value);
};

export const canonicalise = (value: Json | object): string => write(value);
export const canonicalBytes = (value: Json | object): Uint8Array => new TextEncoder().encode(canonicalise(value));
