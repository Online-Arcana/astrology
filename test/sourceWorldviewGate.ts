import {
  deterministicSourcePassageGate,
  sourceDiscriminatorDecision,
  sourceWorldviewDiscriminatorInput,
} from "../src/interpretation/corpus/sourceDiscriminator.js";
import type { SourceNeutralityAudit } from "../src/interpretation/corpus/types.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

test("obviously metaphysical source passages are dropped before distillation", () => {
  const result = deterministicSourcePassageGate("Your soul carries karmic obligations from past lives.");
  equal(result.sendToDiscriminator, false, "contaminated source should not proceed");
  equal(result.accepted, false, "contaminated source should never be accepted");
  assert(result.reasons.length > 0, "rejection should preserve deterministic reasons");
});

test("deterministically clean passages still require an independent classifier", () => {
  const result = deterministicSourcePassageGate("This configuration is associated with a preference for independence and experimentation.");
  equal(result.sendToDiscriminator, true, "clean passage should proceed to classifier");
  equal(result.accepted, false, "deterministic scan alone must not approve semantic ingestion");
});

test("technical Part of Spirit name does not itself contaminate a secular passage", () => {
  const result = deterministicSourcePassageGate("Part of Spirit is interpreted here through intentional action and chosen priorities.");
  equal(result.sendToDiscriminator, true, "technical proper noun should pass deterministic screening");
});

test("classifier acceptance requires all worldview flags false and adequate confidence", () => {
  const audit: SourceNeutralityAudit = {
    religiousDoctrine: false,
    religiousAgency: false,
    divineAgency: false,
    karmaOrReincarnation: false,
    soulAssumption: false,
    fateOrPredestination: false,
    supernaturalAgency: false,
    cosmicIntentionality: false,
    assumesSpiritualWorldview: false,
    safeForAgnosticCorpus: true,
    requiresReview: false,
    confidence: 0.96,
    findings: [],
  };
  equal(sourceDiscriminatorDecision(audit).accepted, true, "clean high-confidence classifier result should pass");
  equal(sourceDiscriminatorDecision({ ...audit, fateOrPredestination: true }).accepted, false, "any worldview assumption must reject");
  equal(sourceDiscriminatorDecision({ ...audit, confidence: 0.6 }).accepted, false, "low confidence must fail closed");
});

test("source discriminator prompt explicitly forbids sanitising contaminated passages", () => {
  const input = sourceWorldviewDiscriminatorInput("semantic.example", "p-1", "Some passage") as { instructions?: unknown };
  assert(typeof input.instructions === "string", "classifier input should contain instructions");
  assert(input.instructions.includes("not rewriting"), "classifier should not be asked to rewrite sources");
  assert(input.instructions.includes("Do not sanitise"), "classifier should explicitly forbid sanitisation");
});

console.log(`1..${passed}`);
