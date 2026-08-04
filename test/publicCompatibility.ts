import {
  ProgressTracker,
  baseWork,
  createOpenAISchemaClientFactory,
  generationRecoverySchema,
  isLegacyAstralFile,
  loadChartGenerationService,
  modelRoutingProfile,
  parseCalculationRequest,
  parseCliArgs,
  readConfig,
  type ReadableAstralFile,
} from "../src/index.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const config = readConfig({});
equal(config.chart.primaryZodiac, "tropical", "public configuration default zodiac");
equal(config.chart.interpretationMode, "tropical", "public configuration interpretation default");
equal(config.chart.ayanamsha, "lahiri", "public configuration sidereal default");
equal(config.openai.smallModel, "gpt-5-nano", "public short entry model");
equal(config.openai.smallEscalationModel, "gpt-5.6-luna", "public short escalation model");
equal(config.openai.bigModel, "gpt-5.6-luna", "public long entry model");
equal(config.openai.bigEscalationModel, "gpt-5.6-luna", "public long escalation model");
equal(config.chart.throwOnInterpretationFailure, false, "public customer-safe completion default");
equal(modelRoutingProfile, "astral-model-routing/1.2.0", "public bounded Luna routing profile");

const request = parseCalculationRequest({
  birth: {
    date: "1991-01-01",
    time: "12:00:00",
    timeAccuracy: "exact",
    placeId: "fixture:place",
  },
}, {
  primaryZodiac: "tropical",
  interpretationMode: "tropical",
  ayanamsha: "lahiri",
});
equal(request.options.primaryZodiac, "tropical", "omitted public request zodiac");
equal(request.options.interpretationMode, "tropical", "omitted public request interpretation mode");

const sidereal = parseCliArgs(["calculate", "--zodiac", "sidereal"]);
assert(sidereal.kind === "calculate", "public CLI calculate command");
equal(sidereal.optionOverrides.primaryZodiac, "sidereal", "public CLI sidereal selection");

const work = baseWork();
assert(work.some(({ id }) => id === "system"), "public work plan retains deterministic chart stage");
assert(!work.some(({ id }) => id === "cross-system"), "new public work plans must not reconcile zodiac systems");
const tracker = new ProgressTracker("public", work, 0, 3);
assert(tracker.snapshot(0).progress.percent === 0, "public progress tracker remains constructible");

const legacy: ReadableAstralFile = {
  schema: "astral/1.0.0",
  "astral-calculation": { schema: "astral-calculation/1.0.0" },
  "astral-chart": { schema: "astral-chart/1.0.0" },
  crc: {
    schema: "astral-crc/1.0.0",
    canonicalisation: "RFC8785",
    encoding: "utf-8",
    scope: ["schema", "astral-calculation", "astral-chart"],
    byteLength: 0,
    sha256: "0".repeat(64),
    sha512: "0".repeat(128),
    crc32c: "00000000",
  },
  authority: null,
};
assert(isLegacyAstralFile(legacy), "legacy astral/1.0.0 files remain publicly readable");

equal(generationRecoverySchema, "astral-generation-recovery/1.1.0", "public recovery schema");
assert(typeof createOpenAISchemaClientFactory === "function", "OpenAI client factory export");
assert(typeof loadChartGenerationService === "function", "chart generation service export");

console.log("1..1");
