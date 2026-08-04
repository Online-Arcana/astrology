import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";
import { runInterpretationPlan } from "../src/llm/orchestrate/plan.js";
import type {
  InterpretationCall,
  SchemaClientFactory,
} from "../src/llm/orchestrate/types.js";
import { reconstructUnit } from "../src/llm/reconstruct/reconstruct.js";
import { shapeForUnit } from "../src/llm/schema/chart.js";
import type { JsonRef } from "../src/types/base.js";
import type { AstralCalculation, InterpretationUnit } from "../src/types/file.js";

const units: InterpretationUnit[] = [
  {
    id: "tropical.point.sun",
    zodiac: "tropical",
    section: "points.sun",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "tropical.life.romance",
    zodiac: "tropical",
    section: "life.romance",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "tropical.life.sexuality",
    zodiac: "tropical",
    section: "life.sexuality",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "tropical.life.careerAndVocation",
    zodiac: "tropical",
    section: "life.careerAndVocation",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "tropical.life.moneyAndMaterialSecurity",
    zodiac: "tropical",
    section: "life.moneyAndMaterialSecurity",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "tropical.synthesis",
    zodiac: "tropical",
    section: "synthesis",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "tropical.compatibility.overall.overview",
    zodiac: "tropical",
    section: "compatibility.overview",
    domain: "overall",
    allowedSourceRefs: [],
  },
  {
    id: "tropical.compatibility.overall.aries",
    zodiac: "tropical",
    section: "compatibility.sign",
    domain: "overall",
    allowedSourceRefs: [],
  },
  {
    id: "tropical.cross-system",
    zodiac: "tropical",
    section: "crossSystem",
    domain: null,
    allowedSourceRefs: [],
  },
  {
    id: "final-synthesis",
    zodiac: "tropical",
    section: "finalSynthesis",
    domain: null,
    allowedSourceRefs: [],
  },
];

const callFor = (unit: InterpretationUnit): InterpretationCall => ({
  id: unit.id,
  label: unit.id,
  kind: "big",
  shape: shapeForUnit(unit, []),
  allowedSourceRefs: new Set(),
  input: () => ({}),
  audit: (value) => ({ valid: true, value, errors: [] }),
});

const containsUndefined = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(containsUndefined);
  if (value === null || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(containsUndefined);
};

test("every interpretation schema has a strict deterministic fallback", () => {
  for (const unit of units) {
    const call = callFor(unit);
    const rebuilt = reconstructUnit({ unit: call, candidates: [] });
    assert.equal(rebuilt.usedXmlFallback, true, `${unit.section} must use the fallback catalogue`);
    assert.equal(containsUndefined(rebuilt.value), false, `${unit.section} must fill every required property`);
    assert.doesNotThrow(
      () => call.shape.parse?.(rebuilt.value),
      `${unit.section} fallback must pass its strict parser`,
    );
  }
});

test("production emergency completion keeps available deterministic references", async () => {
  const ref = "#/astral-calculation/source" as JsonRef;
  const calculation = {
    subject: { providedName: "Fixture", language: "en", adult: true },
    source: { status: "exact", value: { sign: "aries" }, reason: "none" },
    interpretationPlan: {
      units: [{
        id: "tropical.point.sun",
        zodiac: "tropical",
        section: "points.sun",
        domain: null,
        allowedSourceRefs: [ref],
      }],
    },
  } as unknown as AstralCalculation;
  const failFactory: SchemaClientFactory = () => {
    throw new Error("provider unavailable");
  };

  const result = await runInterpretationPlan(
    calculation,
    readConfig({}),
    failFactory,
  );
  const value = result.run.units["tropical.point.sun"]?.value as {
    status?: unknown;
    summary?: unknown;
    sourceRefs?: unknown;
  };
  assert.equal(value.status, "written");
  assert.equal(typeof value.summary, "string");
  assert.deepEqual(value.sourceRefs, [ref]);
  assert.equal(
    result.run.units["tropical.point.sun"]?.provenance?.repairedBy,
    "deterministic",
  );
});
