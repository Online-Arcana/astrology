import { canonicalise } from "../src/file/canonical.js";
import { crc32c } from "../src/file/crc32c.js";
import { readConfig } from "../src/config.js";
import { ProgressTracker } from "../src/progress/tracker.js";
import type { WorkUnit } from "../src/progress/work.js";
import { compatibilityValid, generatedNamePattern } from "../src/file/invariants.js";
import type { CompatibilityDomainScores, Sign } from "../src/types/astro.js";
import { signPosition, siderealPosition } from "../src/zodiac/position.js";
import { lunarPhase } from "../src/astro/lunar.js";
import { detectAspect } from "../src/aspect/detect.js";
import { rankCompatibility } from "../src/compat/rank.js";
import { auditField, auditList } from "../src/llm/audit/field.js";
import { fieldProfiles } from "../src/llm/audit/profiles.js";
import { resolveRef, refsValid } from "../src/ref/resolve.js";

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

test("sign positions preserve absolute and sign-relative longitude", () => {
  const position = signPosition(359.999);
  equal(position.sign, "pisces", "sign");
  equal(signPosition(360).sign, "aries", "wrapped sign");
  equal(siderealPosition(10, 24).sign, "pisces", "sidereal subtraction");
});

test("lunar phase uses deterministic eight-phase sectors", () => {
  equal(lunarPhase(0, 0).phase.value, "new", "new moon");
  equal(lunarPhase(0, 90).phase.value, "first_quarter", "first quarter");
  equal(lunarPhase(0, 180).phase.value, "full", "full moon");
});

test("aspect detection selects the closest permitted aspect", () => {
  const aspect = detectAspect(
    { id: "sun", longitudeDegrees: 0, speedDegreesPerDay: 1 },
    { id: "moon", longitudeDegrees: 119, speedDegreesPerDay: 13 },
  );
  equal(aspect?.kind, "trine", "aspect kind");
  ok((aspect?.strength ?? 0) > 0.8, "aspect strength");
});

test("compatibility ranking is deterministic and complete", () => {
  const raw = (["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"] as const)
    .map((sign, index) => ({ sign, score: index * 9, factors: [] }));
  const ranked = rankCompatibility("tropical", "sexual", raw);
  equal(ranked.ranked[0], "pisces", "highest sign");
  equal(ranked.signs.aries.rank, 12, "lowest rank");
  equal(ranked.signs.pisces.relation, "compatible", "level mapping");
});

test("NLP audit removes process narration but preserves astrology", () => {
  const result = auditField(
    "I will analyse the supplied JSON. Mars and Venus describe a direct desire style with strong erotic pace and clear initiation.",
    fieldProfiles["sexuality"]!,
  );
  ok(result.valid, "repaired field should be valid");
  ok(result.repaired, "field should be repaired");
  ok(!result.value.includes("I will"), "process sentence removed");
});

test("NLP audit rejects cross-field duplication and audits arrays item by item", () => {
  const prior = "Saturn and the Midheaven favour patient career ambition, structured authority and durable professional achievement.";
  const result = auditField(prior, { ...fieldProfiles["career"]!, priorFields: [prior] });
  ok(!result.valid, "near duplicate must fail");
  const list = auditList(["Venus supports affectionate courtship.", "Venus supports affectionate courtship."], fieldProfiles["romance"]!);
  ok(list.issues.some((issue) => issue.code === "duplicate"), "duplicate list item");
});

test("JSON references must resolve and remain in the permitted set", () => {
  const root = { systems: { tropical: { points: { venus: { status: "exact", value: 12 } } } } };
  const ref = "#/systems/tropical/points/venus" as const;
  equal((resolveRef(root, ref) as { value: number }).value, 12, "resolved value");
  ok(refsValid(root, [ref], new Set([ref])), "allowed reference");
  ok(!refsValid(root, [ref], new Set()), "disallowed reference");
});

for (const [name, run] of tests) {
  await run();
  console.log(`ok ${name}`);
}
console.log(`${tests.length} tests passed`);
