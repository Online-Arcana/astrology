import { readConfig } from "../src/config.js";
import {
  ChartGenerationService,
  type ChartSchemaFactory,
} from "../src/generate/service.js";
import type { InterpretationSemanticProvider } from "../src/interpretation/map/provider.js";
import type { SchemaClient } from "../src/llm/orchestrate/types.js";
import type { BirthInput, JsonRef } from "../src/types/base.js";
import type { AstralCalculation } from "../src/types/file.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const sourceRef = "#/astral-calculation/system/points/sun" as JsonRef;
const calculation = {
  schema: "astral-calculation/1.1.0",
  subject: {
    providedName: "Fixture",
    language: "en-GB",
    adult: true,
    preferredGender: "non-binary",
  },
  settings: {
    primaryZodiac: "tropical",
    siderealAyanamsha: null,
    interpretationMode: "tropical",
  },
  system: {
    zodiac: "tropical",
    ayanamsha: null,
    points: {
      sun: {
        id: "sun",
        status: "exact",
        value: { longitudeDegrees: 12, sign: "aries" },
      },
    },
  },
  interpretationPlan: {
    schema: "astral-interpretation-plan/1.1.0",
    units: [{
      id: "tropical.point.sun",
      zodiac: "tropical",
      section: "points.sun",
      domain: null,
      allowedSourceRefs: [sourceRef],
    }],
  },
  provenance: {
    calculationFingerprint: `sha256:${"1".repeat(64)}`,
  },
} as unknown as AstralCalculation;

const birth: BirthInput = {
  date: "1991-06-15",
  time: "12:30:00",
  timeAccuracy: "exact",
  placeId: "fixture:place",
  name: "Fixture",
  lang: "en-GB",
  preferredGender: "non-binary",
};

const unreachableClient = (): SchemaClient => ({
  id: undefined,
  run: async () => {
    throw new Error("schema client must not be reached before semantic provider validation");
  },
});
const schemaFactory: ChartSchemaFactory = () => () => unreachableClient();

test("ChartGenerationService passes an explicit semantic provider into the live plan", async () => {
  let calls = 0;
  const semanticProvider: InterpretationSemanticProvider = {
    mapFor: () => {
      calls += 1;
      throw new Error("semantic provider reached");
    },
  };
  const service = new ChartGenerationService({
    calculation: { calculate: async () => calculation },
    schemaFactory,
    config: readConfig({ ASTRAL_DEBUG_THROW_ON_INTERPRETATION_FAILURE: "true" }),
    version: "fixture",
    semanticProvider,
    now: () => "2026-08-10T14:00:00.000Z",
  });

  let message = "";
  try {
    await service.generate(birth);
  } catch (cause: unknown) {
    message = cause instanceof Error ? cause.message : String(cause);
  }
  equal(calls, 1, "semantic provider call count");
  equal(message, "semantic provider reached", "provider failure should remain fail-closed");
});

console.log(`1..${passed}`);
