import {
  legacyBirthInput,
  migrateLegacyInterpretation,
  type LegacyGenerationCheckpoint,
} from "../src/generate/migration.js";
import type { AstralCalculation } from "../src/types/file.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fingerprint = `sha256:${"3".repeat(64)}`;
const legacy: LegacyGenerationCheckpoint = {
  schema: "astral-generation-recovery/1.0.0",
  version: "0.18.2",
  calculationFingerprint: fingerprint,
  calculation: {
    schema: "astral-calculation/1.0.0",
    subject: { providedName: "Kitty", language: "en" },
    birth: { date: "1991-01-01", time: "12:00", timeAccuracy: "exact" },
    place: { id: "GB/peterhead" },
    provenance: { calculationFingerprint: fingerprint },
  },
  interpretation: {
    conversationId: "conv_legacy",
    units: {
      "tropical.point.sun": {
        id: "tropical.point.sun",
        attempts: 1,
        model: "gpt-5.4-mini",
        value: {
          summary: "Your purpose develops through visible and deliberate action.",
          sourceRefs: ["#/astral-calculation/systems/tropical/points/sun"],
        },
      },
      "sidereal.point.sun": {
        id: "sidereal.point.sun",
        attempts: 1,
        model: "gpt-5.4-mini",
        value: {
          summary: "A separate sidereal interpretation.",
          sourceRefs: ["#/astral-calculation/systems/sidereal/points/sun"],
        },
      },
    },
    calls: 2,
    retries: 0,
    active: {
      id: "tropical.life.sexuality",
      attempt: 1,
      correction: ["retry this unit"],
    },
  },
};

const calculation = {
  subject: { providedName: "Kitty", language: "en", adult: true },
  system: { zodiac: "tropical" },
  interpretationPlan: {
    units: [
      { id: "tropical.point.sun" },
      { id: "tropical.life.sexuality" },
    ],
  },
} as unknown as AstralCalculation;

const birth = legacyBirthInput(legacy);
equal(birth.placeId, "GB/peterhead", "legacy place ID");
equal(birth.name, "Kitty", "legacy name");
equal(birth.lang, "en", "legacy language");

const migrated = migrateLegacyInterpretation(legacy, calculation);
equal(migrated.orchestration, "waves", "migrated orchestration");
equal(migrated.foundationComplete, true, "legacy work starts from a canonical wave snapshot");
equal(Object.keys(migrated.units).length, 1, "unselected zodiac units must be discarded");
assert(migrated.units["sidereal.point.sun"] === undefined, "sidereal work must not enter a tropical chart");
const sun = migrated.units["tropical.point.sun"];
assert(sun !== undefined, "selected accepted work must be preserved");
equal(sun.provenance?.migratedFromVersion, "0.18.2", "migration provenance");
const refs = (sun.value as { sourceRefs: string[] }).sourceRefs;
equal(refs[0], "#/astral-calculation/system/points/sun", "legacy source reference migration");
equal(migrated.active?.id, "tropical.life.sexuality", "unfinished selected unit");
equal(migrated.conversationId, "conv_legacy", "legacy conversation identity retained as provenance");

console.log("1..1");
