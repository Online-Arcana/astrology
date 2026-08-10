import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";
import type { InterpretationMap } from "../src/interpretation/corpus/types.js";
import type { InterpretationSemanticProvider } from "../src/interpretation/map/provider.js";
import { runInterpretationPlan } from "../src/llm/orchestrate/plan.js";
import type { SchemaClientFactory } from "../src/llm/orchestrate/types.js";
import type { JsonRef } from "../src/types/base.js";
import type { AstralCalculation } from "../src/types/file.js";

const sourceRef = "#/astral-calculation/system/points/sun" as JsonRef;
const unitId = "tropical.point.sun";

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
        value: {
          longitudeDegrees: 12,
          sign: "aries",
        },
      },
    },
  },
  interpretationPlan: {
    schema: "astral-interpretation-plan/1.1.0",
    units: [{
      id: unitId,
      zodiac: "tropical",
      section: "points.sun",
      domain: null,
      allowedSourceRefs: [sourceRef],
    }],
  },
} as unknown as AstralCalculation;

const map: InterpretationMap = {
  unitId,
  subject: {
    title: "Sun",
    plainEnglishDomain: "identity and self-direction",
    technicalLabel: "Sun",
  },
  chartEvidence: [sourceRef],
  semantics: {
    core: [{
      id: "proposition.sun.identity",
      text: "This symbol is associated with identity, self-direction and visible commitment to chosen priorities.",
      tags: ["identity", "self-direction", "chosen priorities"],
      sourceClaimIds: ["claim.sun.identity"],
    }],
    detail: [],
    themes: [],
    strengths: [],
    tensions: [],
  },
  provenance: {
    corpusAtomIds: ["body.sun"],
    sourceClaimIds: ["claim.sun.identity"],
    corpusVersion: "fixture/1",
  },
  neutrality: { worldview: "agnostic" },
  forbiddenClaims: ["divine purpose", "destiny"],
};

const unavailableConversation: SchemaClientFactory = () => {
  throw new Error("conversation bootstrap unavailable");
};

test("whole-run failure reconstructs from the same semantic map", async () => {
  let providerCalls = 0;
  const provider: InterpretationSemanticProvider = {
    mapFor: () => {
      providerCalls += 1;
      return map;
    },
  };

  const result = await runInterpretationPlan(
    calculation,
    readConfig({ ASTRAL_MAX_RETRIES: "1" }),
    unavailableConversation,
    {},
    null,
    provider,
  );

  const recovered = result.run.units[unitId];
  assert.ok(recovered);
  assert.equal(recovered.provenance?.repairKind, "deterministic_reconstruction");
  assert.equal(recovered.provenance?.repairedBy, "deterministic");
  const value = recovered.value as { summary?: string; sourceRefs?: JsonRef[] };
  assert.match(value.summary ?? "", /identity|self-direction|chosen priorities/u);
  assert.equal(value.sourceRefs?.[0], sourceRef);
  assert.ok(providerCalls >= 1);
});

test("missing semantic authority cannot be swallowed by the production fallback catch", async () => {
  const provider: InterpretationSemanticProvider = {
    mapFor: () => {
      throw new Error("semantic authority missing");
    },
  };

  await assert.rejects(
    () => runInterpretationPlan(
      calculation,
      readConfig({}),
      unavailableConversation,
      {},
      null,
      provider,
    ),
    /semantic authority missing/u,
  );
});