import { canonicalise } from "../src/file/canonical.js";
import { crc32c } from "../src/file/crc32c.js";
import { readConfig } from "../src/config.js";
import { ProgressTracker } from "../src/progress/tracker.js";
import type { WorkUnit } from "../src/progress/work.js";
import { compatibilityValid, generatedNamePattern } from "../src/file/invariants.js";
import type { CompatibilityDomainScores, Sign } from "../src/types/astro.js";

const equal = (actual: unknown, expected: unknown, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

const ok = (value: unknown, message: string): void => {
  if (!value) throw new Error(message);
};

const tests: Array<readonly [string, () => void | Promise<void>]> = [];
const test = (name: string, run: () => void | Promise<void>): void => { tests.push([name, run]); };

test("canonical JSON ignores insertion order", () => {
  equal(canonicalise({ b: 1, a: [true, null, "x"] }), '{"a":[true,null,"x"],"b":1}', "canonical form");
});

test("CRC-32C matches the standard vector", () => {
  equal(crc32c(new TextEncoder().encode("123456789")), "e3069283", "CRC-32C");
});

test("configuration uses separate default models", () => {
  const config = readConfig({});
  equal(config.openai.bigModel, "gpt-5.4-mini", "big model");
  equal(config.openai.smallModel, "gpt-5.4-nano", "small model");
  equal(config.chart.maxRetries, 3, "retry count");
});

test("signing configuration requires both keys", () => {
  let failed = false;
  try { readConfig({ ASTRAL_SIGNING_ENABLED: "true" }); } catch { failed = true; }
  ok(failed, "missing signing keys must fail");
});

test("progress remains monotonic and ETA waits for samples", () => {
  const units: WorkUnit[] = [
    { id: "a", label: "A", kind: "local", weight: 1 },
    { id: "b", label: "B", kind: "big", weight: 2 },
    { id: "c", label: "C", kind: "big", weight: 2 },
    { id: "d", label: "D", kind: "local", weight: 1 },
  ];
  const tracker = new ProgressTracker("job", units, 0, 3);
  tracker.start("a", "calculating", 0);
  equal(tracker.snapshot(500).timing.estimatedRemainingSeconds, null, "initial ETA");
  tracker.complete("a", 1000);
  const first = tracker.snapshot(1000).progress.percent;
  tracker.start("b", "interpreting", 1000);
  tracker.complete("b", 3000);
  const second = tracker.snapshot(3000).progress.percent;
  tracker.start("c", "interpreting", 3000);
  tracker.complete("c", 5000);
  const third = tracker.snapshot(5000);
  ok(second > first && third.progress.percent > second, "progress must increase");
  ok(third.timing.estimatedRemainingSeconds !== null, "ETA must appear after three samples");
  tracker.start("d", "assembling", 5000);
  tracker.complete("d", 6000);
  equal(tracker.finish(6000).progress.percent, 100, "completion percent");
});

test("generated names contain exactly three hyphenated words", () => {
  ok(generatedNamePattern.test("Lunar-rebel-strategist"), "valid generated name");
  ok(!generatedNamePattern.test("Lunar rebel strategist"), "spaces must fail");
});

test("compatibility requires every sign and every rank", () => {
  const signs = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"] as const;
  const scores = {} as Record<Sign, CompatibilityDomainScores["signs"][Sign]>;
  signs.forEach((sign, index) => {
    scores[sign] = {
      sign,
      score: 100 - index,
      rank: index + 1,
      level: index < 4 ? "high" : index < 8 ? "medium" : "low",
      relation: index < 4 ? "compatible" : index < 8 ? "neutral" : "incompatible",
      factors: [],
    };
  });
  const domain: CompatibilityDomainScores = { domain: "overall", ranked: [...signs], signs: scores };
  ok(compatibilityValid(domain), "complete compatibility domain");
  domain.signs.pisces.rank = 11;
  ok(!compatibilityValid(domain), "duplicate ranks must fail");
});

for (const [name, run] of tests) {
  await run();
  console.log(`ok ${name}`);
}
console.log(`${tests.length} tests passed`);
