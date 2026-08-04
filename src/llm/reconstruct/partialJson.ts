type RecordValue = Record<string, unknown>;

const record = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsedObject = (value: string): RecordValue | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    return record(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const appendable = (segments: readonly string[], segment: string): boolean =>
  parsedObject(`{${[...segments, segment].join(",")}}`) !== null;

/**
 * Recover only complete top-level properties from a truncated JSON object.
 * Incomplete strings, arrays and objects are discarded rather than guessed.
 */
export const salvagePartialJsonObject = (raw: string): RecordValue | null => {
  const first = raw.indexOf("{");
  if (first < 0) return null;
  const source = raw.slice(first);
  const complete = parsedObject(source);
  if (complete !== null) return complete;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let segmentStart = -1;
  const segments: string[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === "\"") inString = false;
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{" || character === "[") {
      depth += 1;
      if (depth === 1 && character === "{") segmentStart = index + 1;
      continue;
    }

    if (character === "}" || character === "]") {
      if (character === "}" && depth === 1 && segmentStart >= 0) {
        const segment = source.slice(segmentStart, index).trim();
        if (segment.length > 0 && appendable(segments, segment)) segments.push(segment);
        return parsedObject(`{${segments.join(",")}}`);
      }
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (character === "," && depth === 1 && segmentStart >= 0) {
      const segment = source.slice(segmentStart, index).trim();
      if (segment.length > 0 && appendable(segments, segment)) segments.push(segment);
      segmentStart = index + 1;
    }
  }

  if (!inString && depth === 1 && segmentStart >= 0) {
    const segment = source.slice(segmentStart).trim();
    if (segment.length > 0 && appendable(segments, segment)) segments.push(segment);
  }

  return segments.length === 0 ? null : parsedObject(`{${segments.join(",")}}`);
};
