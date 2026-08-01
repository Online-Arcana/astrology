import type { JsonRef } from "../types/base.js";

const part = (value: string): string => value.replaceAll("~1", "/").replaceAll("~0", "~");

export const resolveRef = (root: unknown, ref: JsonRef): unknown => {
  if (!ref.startsWith("#/")) throw new Error(`Invalid local JSON reference: ${ref}`);
  let current: unknown = root;
  for (const token of ref.slice(2).split("/").map(part)) {
    if (Array.isArray(current)) {
      if (!/^\d+$/u.test(token)) throw new Error(`Array reference is not an index: ${ref}`);
      current = current[Number(token)];
    } else if (current !== null && typeof current === "object") {
      current = (current as Record<string, unknown>)[token];
    } else {
      current = undefined;
    }
    if (current === undefined) throw new Error(`Unresolved JSON reference: ${ref}`);
  }
  return current;
};

export const refsValid = (root: unknown, refs: readonly JsonRef[], allowed: ReadonlySet<JsonRef>): boolean =>
  refs.every((ref) => {
    if (!allowed.has(ref)) return false;
    try {
      const value = resolveRef(root, ref);
      if (value && typeof value === "object" && "status" in value) {
        const status = (value as { status?: unknown }).status;
        return status !== "unavailable" && status !== "unsupported";
      }
      return true;
    } catch {
      return false;
    }
  });
