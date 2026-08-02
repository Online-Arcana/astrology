import { assembleChart, type ChartAssemblyOptions } from "../src/chart/assemble.js";
import { buildInterpretationPlan } from "../src/calculate/plan.js";
import { compatibilityDomains } from "../src/compat/catalogue.js";
import { base64url } from "../src/file/codec.js";
import { assembleAstralFile } from "../src/file/document.js";
import { decodeAstralFile, encodeAstralFile, isAstralFile, validateAstralFile } from "../src/file/validate.js";
import type { InterpretationRun, UnitResult } from "../src/llm/orchestrate/types.js";
import type { JsonRef } from "../src/types/base.js";
import type {
  CompatibilityDomain,
  CompatibilityMatrix,
  PointId,
  Sign,
  SignMap,
  Zodiac,
  ZodiacCalculation,
} from "../src/types/astro.js";
import type { Section } from "../src/types/chart.js";
import type { AstralCalculation, InterpretationUnit, TrustedAuthority } from "../src/types/file.js";
import { signs } from "../src/zodiac/position.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>): Promise<void> => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const pointIds = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "north_node_true", "south_node_true", "north_node_mean", "south_node_mean",
  "ascendant", "descendant", "midheaven", "imum_coeli", "vertex", "antivertex", "east_point",
  "part_of_fortune", "part_of_spirit", "lilith_mean", "lilith_true",
] as const satisfies readonly PointId[];

const compatibilityMatrix = (zodiac: Zodiac): CompatibilityMatrix => {
  const domains = {} as CompatibilityMatrix["domains"];
  for (const domain of compatibilityDomains) {
    const scores = {} as SignMap<CompatibilityMatrix["domains"][CompatibilityDomain]["signs"][Sign]>;
    signs.forEach((sign, index) => {
      scores[sign] = {
        sign,
        score: 100 - index * 5,
        rank: index + 1,
        level: index < 4 ? "high" : index < 8 ? "medium" : "low",
        relation: index < 4 ? "compatible" : index < 8 ? "neutral" : "incompatible",
        factors: [],
      };
    });
    domains[domain] = { domain, ranked: [...signs], signs: scores };
  }
  return { zodiac, domains };
};

const deterministicSystem = (zodiac: Zodiac): ZodiacCalculation => {
  const points = Object.fromEntries(pointIds.map((id) => [id, {
    id,
    position: { status: "exact", value: { sign: "aries", degreeWithinSign: 1, longitudeDegrees: 1 }, reason: "none" },
  }]));
  const houses = Object.fromEntries(["placidus", "whole_sign", "equal", "porphyry"].map((system) => [system, {
    system,
    status: "calculated",
    houses: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), { number: index + 1 }])),
  }]));
  return {
    zodiac,
    ayanamsha: zodiac === "sidereal" ? "lahiri" : null,
    ayanamshaDegrees: { status: "exact", value: zodiac === "sidereal" ? 24 : 0, reason: "none" },
    points,
    houses,
    aspects: [],
    declinationAspects: [],
    patterns: [],
    lunarPhase: {},
    eclipses: { atBirth: {}, prenatalSolar: {}, prenatalLunar: {} },
    derived: {
      dispositors: {},
      mutualReceptions: [],
      balances: {},
      dominantPlanets: [],
      dominantSigns: [],
      jonesPattern: {},
    },
  } as unknown as ZodiacCalculation;
};

const calculationFixture = (): AstralCalculation => {
  const tropical = deterministicSystem("tropical");
  const sidereal = deterministicSystem("sidereal");
  const interpretationPlan = buildInterpretationPlan(tropical, sidereal);
  return {
    schema: "astral-calculation/1.0.0",
    subject: { providedName: null, language: "en", adult: true },
    birth: { date: "2000-06-15", time: "12:30:00", timeAccuracy: "exact" },
    place: {},
    time: {},
    settings: {},
    astronomy: {},
    systems: { tropical, sidereal },
    compatibility: {
      method: "natal_to_sign_archetype",
      profile: "western_compatibility/1.0.0",
      tropical: compatibilityMatrix("tropical") as CompatibilityMatrix & { zodiac: "tropical" },
      sidereal: compatibilityMatrix("sidereal") as CompatibilityMatrix & { zodiac: "sidereal" },
    },
    interpretationPlan,
    provenance: {
      generatedAt: "2026-08-01T12:00:00.000Z",
      astralChartsVersion: "0.12.0",
      astronomia: { repository: "fixture", revision: "fixture", version: "1" },
      places: { repository: "fixture", revision: "fixture", version: "1" },
      time: {
        repository: "fixture",
        revision: "fixture",
        version: "1",
        timeZoneDatabaseVersion: "2026a",
        calendar: "proleptic_gregorian",
        supportedRange: "1900/2100",
      },
      astrologyProfile: "western_natal/1.0.0",
      aspectProfile: "western_aspects/1.0.0",
      dignityProfile: "traditional_dignity/1.0.0",
      compatibilityProfile: "western_compatibility/1.0.0",
      calculationFingerprint: `sha256:${"1".repeat(64)}`,
    },
    warnings: [],
  } as unknown as AstralCalculation;
};

const refs = (unit: InterpretationUnit): JsonRef[] => {
  const first = unit.allowedSourceRefs[0];
  if (!first) throw new Error(`Unit ${unit.id} has no allowed source reference`);
  return [first];
};

const baseSection = (unit: InterpretationUnit): Section => ({
  status: "written",
  title: unit.id,
  summary: "Summary",
  detail: "Detail",
  themes: ["theme"],
  strengths: ["strength"],
  tensions: ["tension"],
  sourceRefs: refs(unit),
});

const valueFor = (unit: InterpretationUnit): object => {
  const base = baseSection(unit);
  if (unit.id.endsWith(".life.romance")) {
    return {
      ...base,
      affectionStyle: "Warm",
      courtshipStyle: "Direct",
      attachmentNeeds: "Trust",
      preferredPartnerQualities: ["steady"],
      relationshipStrengths: ["loyalty"],
      relationshipDifficulties: ["stubbornness"],
      commitmentPattern: "Deliberate",
    };
  }
  if (unit.id.endsWith(".life.sexuality")) {
    return {
      ...base,
      desireStyle: "Direct",
      libidoPattern: "Steady",
      initiationStyle: "Confident",
      preferredPace: "Measured",
      physicalAffection: "Tactile",
      likelyTurnOns: ["trust"],
      likelyTurnOffs: ["distance"],
      experimentationStyle: "Curious",
      emotionalSexConnection: "Important",
      controlAndSurrender: "Balanced",
      powerDynamics: "Negotiated",
      exclusivityPattern: "Committed",
      sexualCommunication: "Explicit",
      likelyFrustrations: ["ambiguity"],
    };
  }
  if (unit.id.endsWith(".life.careerAndVocation")) {
    return {
      ...base,
      vocationalThemes: ["engineering"],
      suitableFields: ["systems"],
      preferredWorkEnvironment: "Autonomous",
      leadershipStyle: "Practical",
      authorityRelationship: "Questioning",
      ambitionPattern: "Sustained",
      publicReputation: "Reliable",
      careerStrengths: ["analysis"],
      careerRisks: ["overwork"],
    };
  }
  if (unit.id.endsWith(".life.moneyAndMaterialSecurity")) {
    return {
      ...base,
      earningStyle: "Skilled",
      spendingStyle: "Selective",
      securityNeeds: "Reserves",
      riskTolerance: "Moderate",
      materialStrengths: ["planning"],
      financialBlindSpots: ["rigidity"],
    };
  }
  if (unit.id === "cross-system") {
    return {
      sharedThemes: ["focus"],
      tropicalEmphasis: ["expression"],
      siderealEmphasis: ["structure"],
      apparentContradictions: ["speed and patience"],
      reconciliations: ["timed action"],
      synthesis: "Both systems describe directed effort.",
      sourceRefs: refs(unit),
    };
  }
  if (unit.id === "final-synthesis") {
    return {
      essence: "A deliberate builder.",
      definingThemes: ["purpose"],
      strongestAssets: ["persistence"],
      recurringTensions: ["control"],
      relationshipPattern: "Loyal",
      sexualPattern: "Direct",
      friendshipPattern: "Selective",
      vocationalPattern: "Technical",
      moneyPattern: "Protective",
      developmentalArc: "Greater flexibility",
      closingPortrait: "A steady and evolving person.",
      sourceRefs: refs(unit),
    };
  }
  if (unit.id.endsWith(".synthesis")) {
    return {
      centralThemes: ["focus"],
      contradictions: ["rest and motion"],
      gifts: ["resolve"],
      growthEdges: ["flexibility"],
      narrative: "A coherent system portrait.",
      sourceRefs: refs(unit),
    };
  }
  if (unit.id.includes(".compatibility.")) {
    if (unit.id.endsWith(".overview")) return { overview: "Domain overview", sourceRefs: refs(unit) };
    const sign = unit.id.split(".").at(-1) as Sign;
    return {
      sign,
      summary: "Summary",
      dynamic: "Dynamic",
      strengths: ["rapport"],
      tensions: ["pace"],
      attraction: "Present",
      sustainability: "Possible",
      bestExpression: "Mutual respect",
      sourceRefs: refs(unit),
    };
  }
  return base;
};

const runFixture = (calculation: AstralCalculation): InterpretationRun => {
  const units = {} as Record<string, UnitResult<object>>;
  calculation.interpretationPlan.units.forEach((unit, index) => {
    units[unit.id] = {
      id: unit.id,
      value: valueFor(unit),
      attempts: index % 7 === 0 ? 2 : 1,
      model: index % 5 === 0 ? "gpt-big" : "gpt-small",
    };
  });
  return {
    conversationId: "conversation-fixture",
    units,
    calls: calculation.interpretationPlan.units.length + 3,
    retries: 3,
  };
};

const assemblyOptions: ChartAssemblyOptions = {
  generatedAt: "2026-08-01T12:30:00.000Z",
  bigModel: "gpt-big",
  smallModel: "gpt-small",
  structuredOutputSchema: "astral-structured-output/1.0.0",
  promptCatalogue: "astral-prompts/1.0.0",
  astrologyCatalogue: "western_natal/1.0.0",
  nlpAuditProfile: "astral-nlp-audit/1.0.0",
  generatedName: "Lunar-rebel-strategist",
};

await test("chart assembler consumes every fixed unit into the final shape", () => {
  const calculation = calculationFixture();
  const run = runFixture(calculation);
  const chart = assembleChart(calculation, run, assemblyOptions);
  equal(chart.schema, "astral-chart/1.0.0", "chart schema");
  equal(chart.subject.name.value, "Lunar-rebel-strategist", "generated name");
  equal(chart.tropical.points.sun.title, "tropical.point.sun", "point mapping");
  equal(chart.sidereal.life.sexuality.desireStyle, "Direct", "specialised sexuality mapping");
  equal(chart.compatibility.tropical.domains.romantic.signs.aries.sign, "aries", "compatibility mapping");
  equal(chart.provenance.phases.length, calculation.interpretationPlan.units.length, "phase provenance count");
  equal(chart.provenance.sharedConversation, true, "shared conversation provenance");
});

await test("chart assembler rejects missing and unexpected interpretation units", () => {
  const calculation = calculationFixture();
  const missing = runFixture(calculation);
  const missingUnits = missing.units as Record<string, UnitResult<object>>;
  delete missingUnits[calculation.interpretationPlan.units[0]?.id as string];
  let missingFailed = false;
  try { assembleChart(calculation, missing, assemblyOptions); } catch { missingFailed = true; }
  equal(missingFailed, true, "missing unit rejection");

  const unexpected = runFixture(calculation);
  const unexpectedUnits = unexpected.units as Record<string, UnitResult<object>>;
  unexpectedUnits["unexpected"] = { id: "unexpected", value: {}, attempts: 1, model: "gpt-small" };
  let unexpectedFailed = false;
  try { assembleChart(calculation, unexpected, assemblyOptions); } catch { unexpectedFailed = true; }
  equal(unexpectedFailed, true, "unexpected unit rejection");
});

await test("chart assembler rejects source references outside the unit boundary", () => {
  const calculation = calculationFixture();
  const run = runFixture(calculation);
  const unit = run.units["tropical.point.sun"];
  assert(unit, "Sun unit fixture");
  unit.value = { ...unit.value, sourceRefs: ["#/astral-calculation/systems/sidereal"] };
  let failed = false;
  try { assembleChart(calculation, run, assemblyOptions); } catch { failed = true; }
  equal(failed, true, "source boundary rejection");
});

await test("unsigned astral file round-trips and detects modification", async () => {
  const calculation = calculationFixture();
  const chart = assembleChart(calculation, runFixture(calculation), assemblyOptions);
  const file = await assembleAstralFile(calculation, chart);
  equal(isAstralFile(file), true, "structural file validity");
  const validation = await validateAstralFile(file);
  equal(validation.structure, "valid", "unsigned structure");
  equal(validation.integrity, "valid", "unsigned integrity");
  equal(validation.authority, "unsigned", "unsigned authority");
  const decoded = decodeAstralFile(encodeAstralFile(file));
  equal(decoded.crc.sha256, file.crc.sha256, "canonical round-trip");

  const modified = structuredClone(file);
  modified["astral-chart"].finalSynthesis.essence = "Modified";
  const changed = await validateAstralFile(modified);
  equal(changed.structure, "valid", "modified structure");
  equal(changed.integrity, "modified", "modified integrity");
});

await test("signed files distinguish trusted untrusted unknown and revoked authorities", async () => {
  const calculation = calculationFixture();
  const chart = assembleChart(calculation, runFixture(calculation), assemblyOptions);
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const privateKey = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const file = await assembleAstralFile(calculation, chart, {
    issuer: "fixture-authority",
    keys: {
      privatePkcs8: `base64url:${base64url(privateKey)}`,
      publicRaw: `base64url:${base64url(publicKey)}`,
    },
    generatedAt: "2026-08-01T12:31:00.000Z",
  });
  assert(file.authority, "signed authority");
  equal((await validateAstralFile(file)).authority, "valid_untrusted", "unconfigured trust");
  const active: TrustedAuthority = {
    issuer: file.authority.issuer,
    keyId: file.authority.keyId,
    publicKey: file.authority.publicKey,
    status: "active",
  };
  equal((await validateAstralFile(file, [active])).authority, "trusted", "active trusted authority");
  equal(
    (await validateAstralFile(file, [{ ...active, status: "revoked" }])).authority,
    "revoked",
    "revoked authority",
  );
  equal(
    (await validateAstralFile(file, [{ ...active, keyId: `sha256:${"2".repeat(64)}` }])).authority,
    "unknown_key",
    "unknown authority key",
  );

  const tampered = structuredClone(file);
  tampered["astral-chart"].finalSynthesis.essence = "Tampered";
  const invalid = await validateAstralFile(tampered, [active]);
  equal(invalid.integrity, "modified", "signed tamper integrity");
  equal(invalid.authority, "invalid", "signed tamper authority");
});

await test("structurally invalid values do not reach integrity or authority validation", async () => {
  equal(isAstralFile({}), false, "empty object structure");
  const validation = await validateAstralFile({ schema: "astral/1.0.0" });
  equal(validation.structure, "invalid", "invalid structure result");
  equal(validation.integrity, "invalid_crc", "invalid structure integrity");
  equal(validation.authority, "invalid", "invalid structure authority");
});

console.log(`1..${passed}`);
