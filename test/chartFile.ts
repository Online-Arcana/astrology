import { compatibilityDomains, signs, type JsonRef } from "astral-core";
import { assembleChart, buildPlan, deterministicInterpretationPlan, type ChartAssemblyOptions, type InterpretationRun, type Section, type UnitResult } from "astral-interpreter/web";



import { base64url } from "../src/file/codec.js";
import { assembleAstralFile } from "../src/file/document.js";
import { decodeAstralFile, encodeAstralFile, isAstralFile, validateAstralFile } from "../src/file/validate.js";



import type {
  CompatibilityDomain,
  CompatibilityMatrix,
  PointId,
  Sign,
  SignMap,
  ZodiacCalculation,
} from "astral-core";

import type { AstralCalculation, InterpretationUnit, TrustedAuthority } from "../src/types/file.js";


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

const compatibilityMatrix = (): CompatibilityMatrix => {
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
  return { zodiac: "tropical", domains };
};

const deterministicSystem = (): ZodiacCalculation => {
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
    zodiac: "tropical",
    ayanamsha: null,
    ayanamshaDegrees: { status: "exact", value: 0, reason: "none" },
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
  const system = deterministicSystem();
  const matrix = compatibilityMatrix();
  const interpretationPlan = buildPlan(system);
  return {
    schema: "astral-calculation/1.1.0",
    subject: { providedName: null, language: "en", adult: true },
    birth: { date: "1991-06-15", time: "12:30:00", timeAccuracy: "exact" },
    place: {},
    time: {},
    settings: {
      primaryZodiac: "tropical",
      siderealAyanamsha: null,
      interpretationMode: "tropical",
      primaryHouseSystem: "placidus",
      polarFallback: "porphyry",
      houseSystems: ["placidus", "whole_sign", "equal", "porphyry"],
    },
    astronomy: {},
    system,
    compatibility: {
      method: "natal_to_sign_archetype",
      profile: "western_compatibility/1.0.0",
      ...matrix,
    },
    interpretationPlan,
    provenance: {
      generatedAt: "2026-08-01T12:00:00.000Z",
      astralChartsVersion: "0.19.0",
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
      astrologyProfile: "western_natal/1.1.0",
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
  summary: "You approach this area with steady focus.",
  detail: "You develop it through patient attention and practical choices.",
  themes: ["Your focus is deliberate."],
  strengths: ["You can sustain effort."],
  tensions: ["You may become overly rigid."],
  sourceRefs: refs(unit),
});

const valueFor = (unit: InterpretationUnit): object => {
  const base = baseSection(unit);
  if (unit.id.endsWith(".life.romance")) {
    return {
      ...base,
      affectionStyle: "You show warmth through reliable attention.",
      courtshipStyle: "You approach attraction directly but deliberately.",
      attachmentNeeds: "You need trust and consistency.",
      preferredPartnerQualities: ["You value steadiness."],
      relationshipStrengths: ["You offer loyalty."],
      relationshipDifficulties: ["You can resist sudden change."],
      commitmentPattern: "You commit carefully and endure once certain.",
    };
  }
  if (unit.id.endsWith(".life.sexuality")) {
    return {
      ...base,
      desireStyle: "You experience desire directly and privately.",
      libidoPattern: "Your libido tends to be steady.",
      initiationStyle: "You initiate with quiet confidence.",
      preferredPace: "You prefer a measured pace.",
      physicalAffection: "You value tactile closeness.",
      likelyTurnOns: ["You respond to trust."],
      likelyTurnOffs: ["Emotional distance can cool desire."],
      experimentationStyle: "You experiment once trust is secure.",
      emotionalSexConnection: "You need emotional depth alongside attraction.",
      controlAndSurrender: "You seek a negotiated balance of control and surrender.",
      powerDynamics: "You prefer explicit and consensual power dynamics.",
      exclusivityPattern: "You tend towards committed exclusivity.",
      sexualCommunication: "You communicate best through direct clarity.",
      likelyFrustrations: ["Ambiguity can frustrate you."],
    };
  }
  if (unit.id.endsWith(".life.careerAndVocation")) {
    return {
      ...base,
      vocationalThemes: ["You are drawn to technical problem-solving."],
      suitableFields: ["Systems work can suit you."],
      preferredWorkEnvironment: "You work best with meaningful autonomy.",
      leadershipStyle: "You lead practically.",
      authorityRelationship: "You question authority when it lacks evidence.",
      ambitionPattern: "You build ambition gradually.",
      publicReputation: "You may be known as reliable.",
      careerStrengths: ["You analyse problems thoroughly."],
      careerRisks: ["You can overwork."],
    };
  }
  if (unit.id.endsWith(".life.moneyAndMaterialSecurity")) {
    return {
      ...base,
      earningStyle: "You earn through developed skill.",
      spendingStyle: "You spend selectively.",
      securityNeeds: "You feel safer with reserves.",
      riskTolerance: "You accept measured risk.",
      materialStrengths: ["You plan resources carefully."],
      financialBlindSpots: ["You can become too rigid."],
    };
  }
  if (unit.id === "final-synthesis") {
    return {
      essence: "You are a deliberate builder.",
      definingThemes: ["You seek purposeful development."],
      strongestAssets: ["Your persistence supports long work."],
      recurringTensions: ["Control can become restrictive."],
      relationshipPattern: "You build loyalty through consistency.",
      sexualPattern: "You combine direct desire with privacy.",
      friendshipPattern: "You are selective and dependable.",
      vocationalPattern: "You thrive in technical responsibility.",
      moneyPattern: "You protect material stability.",
      developmentalArc: "You grow through greater flexibility.",
      closingPortrait: "You are steady, discerning and capable of lasting evolution.",
      sourceRefs: refs(unit),
    };
  }
  if (unit.id.endsWith(".synthesis")) {
    return {
      centralThemes: ["You sustain focused effort."],
      contradictions: ["You balance movement with rest."],
      gifts: ["Your resolve is durable."],
      growthEdges: ["Greater flexibility supports you."],
      narrative: "You build a coherent life through deliberate choices.",
      sourceRefs: refs(unit),
    };
  }
  if (unit.id.includes(".compatibility.")) {
    if (unit.id.endsWith(".overview")) return { overview: "You seek mutual respect in this domain.", sourceRefs: refs(unit) };
    const sign = unit.id.split(".").at(-1) as Sign;
    return {
      sign,
      summary: "You can find a workable connection here.",
      dynamic: "You relate through a direct but measured dynamic.",
      strengths: ["You can build rapport."],
      tensions: ["Different pacing may require care."],
      attraction: "Attraction can be present.",
      sustainability: "The bond can be sustainable with mutual effort.",
      bestExpression: "You do best through mutual respect.",
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
  structuredOutputSchema: "astral-structured-output/1.1.0",
  promptCatalogue: "astral-prompts/1.1.0",
  astrologyCatalogue: "western_natal/1.1.0",
  nlpAuditProfile: "astral-nlp-audit/1.1.0",
  generatedName: "Lunar-rebel-strategist",
};

await test("chart assembler consumes every selected-system unit", () => {
  const calculation = calculationFixture();
  const run = runFixture(calculation);
  const chart = assembleChart(calculation, run, assemblyOptions);
  equal(chart.schema, "astral-chart/1.1.0", "chart schema");
  equal(chart.zodiac, "tropical", "chart zodiac");
  equal(chart.subject.name.value, "Lunar-rebel-strategist", "generated name");
  equal(chart.system.points.sun.title, "tropical.point.sun", "point mapping");
  equal(chart.system.life.sexuality.desireStyle, "You experience desire directly and privately.", "sexuality mapping");
  equal(chart.compatibility.domains.romantic.signs.aries.sign, "aries", "compatibility mapping");
  equal(chart.provenance.phases.length, calculation.interpretationPlan.units.length, "phase provenance count");
});

await test("final worldview failure has a complete deterministic interpretation floor", () => {
  const calculation = calculationFixture();
  const unsafe = runFixture(calculation);
  const sun = unsafe.units["tropical.point.sun"]?.value as Section;
  sun.summary = "God is asking you to accept this purpose.";

  let finalAuditRejected = false;
  try {
    assembleChart(calculation, unsafe, assemblyOptions);
  } catch (cause: unknown) {
    finalAuditRejected = cause instanceof Error
      && cause.message.includes("Final chart failed worldview-neutrality audit");
  }
  equal(finalAuditRejected, true, "unsafe final chart must still be rejected");

  const recovered = deterministicInterpretationPlan(
    calculation,
    {},
    new Error("final worldview audit rejected generated prose"),
    null,
  );
  const chart = assembleChart(calculation, recovered.run, {
    ...assemblyOptions,
    ...(recovered.generatedName === null ? {} : { generatedName: recovered.generatedName }),
  });
  equal(chart.system.points.sun.status, "written", "recovered Sun interpretation status");
  assert((chart.system.points.sun.summary ?? "").trim().length > 0, "recovered interpretation must contain prose");
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
  unit.value = { ...unit.value, sourceRefs: ["#/astral-calculation/system/points/moon"] };
  let failed = false;
  try { assembleChart(calculation, run, assemblyOptions); } catch { failed = true; }
  equal(failed, true, "source boundary rejection");
});

await test("unsigned astral file round-trips and detects modification", async () => {
  const calculation = calculationFixture();
  const chart = assembleChart(calculation, runFixture(calculation), assemblyOptions);
  const file = await assembleAstralFile(calculation, chart);
  equal(file.schema, "astral/1.1.0", "file schema");
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
  equal((await validateAstralFile(file, [{ ...active, status: "revoked" }])).authority, "revoked", "revoked authority");

  const tampered = structuredClone(file);
  tampered["astral-chart"].finalSynthesis.essence = "Tampered";
  const invalid = await validateAstralFile(tampered, [active]);
  equal(invalid.integrity, "modified", "signed tamper integrity");
  equal(invalid.authority, "invalid", "signed tamper authority");
});

await test("structurally invalid values do not reach integrity or authority validation", async () => {
  equal(isAstralFile({}), false, "empty object structure");
  const validation = await validateAstralFile({ schema: "astral/1.1.0" });
  equal(validation.structure, "invalid", "invalid structure result");
  equal(validation.integrity, "invalid_crc", "invalid structure integrity");
  equal(validation.authority, "invalid", "invalid structure authority");
});

console.log(`1..${passed}`);
