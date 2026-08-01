const first = [
  "lunar", "solar", "stellar", "hidden", "silver", "ember", "quiet", "velvet",
  "cosmic", "midnight", "radiant", "ancient", "wild", "sacred", "crimson", "azure",
] as const;
const second = [
  "rebel", "oracle", "wanderer", "builder", "dreamer", "seeker", "guardian", "weaver",
  "pilgrim", "scholar", "healer", "navigator", "witness", "alchemist", "herald", "architect",
] as const;
const third = [
  "strategist", "visionary", "mystic", "storyteller", "pathfinder", "mediator", "creator", "survivor",
  "companion", "pioneer", "listener", "transformer", "protector", "interpreter", "explorer", "artisan",
] as const;

const fingerprintHex = (fingerprint: string): string => {
  const match = /^sha256:([0-9a-f]{64})$/u.exec(fingerprint);
  if (!match) throw new Error("Calculation fingerprint must be a SHA-256 value");
  return match[1] as string;
};

export const generatedChartName = (fingerprint: string): string => {
  const hex = fingerprintHex(fingerprint);
  const pick = (offset: number, values: readonly string[]): string => {
    const index = Number.parseInt(hex.slice(offset, offset + 4), 16) % values.length;
    return values[index] as string;
  };
  return `${pick(0, first)}-${pick(4, second)}-${pick(8, third)}`;
};
