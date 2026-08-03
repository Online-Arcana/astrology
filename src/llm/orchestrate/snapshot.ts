import type { UnitResult } from "./types.js";

export const interpretationSnapshotSchema = "astral-interpretation-snapshot/1.0.0" as const;

export interface InterpretationSnapshot {
  schema: typeof interpretationSnapshotSchema;
  revision: number;
  calculationFingerprint: string | null;
  acceptedOrder: string[];
  units: Readonly<Record<string, UnitResult<object>>>;
  sha256: string;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fingerprint = (calculation: unknown): string | null => {
  if (!record(calculation)) return null;
  const root = record(calculation["astral-calculation"])
    ? calculation["astral-calculation"] as Record<string, unknown>
    : calculation;
  const provenance = root["provenance"];
  if (!record(provenance)) return null;
  const value = provenance["calculationFingerprint"];
  return typeof value === "string" ? value : null;
};

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(",")}}`;
};

const digest = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256:${[...result].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

export const buildSnapshot = async (
  calculation: unknown,
  accepted: Readonly<Record<string, UnitResult<object>>>,
  order: readonly string[],
  revision: number,
): Promise<InterpretationSnapshot> => {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Snapshot revision must be a non-negative integer");
  const acceptedOrder = order.filter((id) => accepted[id] !== undefined);
  const units = Object.fromEntries(acceptedOrder.map((id) => [id, accepted[id] as UnitResult<object>]));
  const content = {
    schema: interpretationSnapshotSchema,
    revision,
    calculationFingerprint: fingerprint(calculation),
    acceptedOrder,
    units,
  };
  return { ...content, sha256: await digest(canonical(content)) };
};

export const snapshotText = (snapshot: InterpretationSnapshot): string => JSON.stringify(snapshot);

/**
 * Conservative JSON token estimate used before a model request is sent. JSON
 * commonly tokenises more densely than ordinary prose, so three UTF-16 code
 * units per token intentionally leaves headroom rather than chasing an exact
 * tokenizer for every configured model.
 */
export const snapshotTokenEstimate = (snapshot: InterpretationSnapshot): number =>
  Math.max(1, Math.ceil(snapshotText(snapshot).length / 3));

export const snapshotInput = (
  fileId: string | null,
  snapshot: InterpretationSnapshot,
  input: unknown,
): unknown => {
  if (fileId === null) return { snapshot, input };
  const text = JSON.stringify({
    snapshotRevision: snapshot.revision,
    snapshotSha256: snapshot.sha256,
    snapshotTokenEstimate: snapshotTokenEstimate(snapshot),
    input,
  });
  return [{
    role: "user",
    content: [
      { type: "input_file", file_id: fileId },
      { type: "input_text", text },
    ],
  }];
};
