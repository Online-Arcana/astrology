import { auditOpenedInterpretations } from "../src/browser/maintenanceAudit.js";
import type { JsonRef } from "../src/types/base.js";
import type { AstralFile, InterpretationUnit } from "../src/types/file.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const ref = "#/astral-calculation/system/marker" as JsonRef;
const unit: InterpretationUnit = {
  id: "tropical.overview",
  zodiac: "tropical",
  section: "overview",
  domain: null,
  allowedSourceRefs: [ref],
};

const section = () => ({
  status: "written" as const,
  title: "Overall chart interpretation",
  summary: "You recognise the central pattern of your chart and use it as a practical guide.",
  detail: "You develop this theme through deliberate choices, balancing your strengths with the tensions that require attention.",
  themes: ["You integrate the main chart themes into your daily decisions."],
  strengths: ["You use your strongest patterns with steady awareness."],
  tensions: ["You can work constructively with the tensions in your chart."],
  sourceRefs: [ref],
});

const fixture = (): AstralFile => ({
  schema: "astral/1.1.0",
  "astral-calculation": {
    schema: "astral-calculation/1.1.0",
    subject: { providedName: "Test person", language: "en-GB", adult: true, preferredGender: "non-binary" },
    system: { marker: { status: "exact", value: "fixture", reason: "none" } },
    interpretationPlan: { schema: "astral-interpretation-plan/1.1.0", zodiac: "tropical", units: [unit] },
  },
  "astral-chart": {
    schema: "astral-chart/1.1.0",
    zodiac: "tropical",
    subject: { name: { value: "Test person", source: "provided", sourceRefs: [] } },
    system: { zodiac: "tropical", overview: section() },
  },
  crc: {},
  authority: null,
} as unknown as AstralFile);

const unavailableSection = () => ({
  status: "unavailable" as const,
  title: "Overall chart interpretation",
  summary: null,
  detail: null,
  themes: [],
  strengths: [],
  tensions: [],
  sourceRefs: [],
});

const complete = auditOpenedInterpretations(fixture());
assert(complete.complete, "complete interpreted section must pass maintenance audit");
assert(complete.invalidUnitIds.length === 0, "complete section must have no invalid unit IDs");

const truncated = fixture();
truncated["astral-chart"].system.overview.detail = "You understand this chart theme because";
const truncatedAudit = auditOpenedInterpretations(truncated);
assert(!truncatedAudit.complete, "truncated prose must require regeneration");
assert(truncatedAudit.invalidUnitIds.includes(unit.id), "truncated unit ID must be reported");

const badReference = fixture();
badReference["astral-chart"].system.overview.sourceRefs = ["#/astral-calculation/missing" as JsonRef];
const referenceAudit = auditOpenedInterpretations(badReference);
assert(!referenceAudit.complete, "unresolved source reference must require regeneration");

const falseUnavailable = fixture();
falseUnavailable["astral-chart"].system.overview = unavailableSection();
const falseUnavailableAudit = auditOpenedInterpretations(falseUnavailable);
assert(!falseUnavailableAudit.complete, "unavailable prose must be rejected when deterministic evidence exists");

const unavailable = fixture();
unavailable["astral-chart"].system.overview = unavailableSection();
const unavailableSystem = unavailable["astral-calculation"].system as unknown as {
  marker: { status: "unavailable"; value: null; reason: "insufficient_data" };
};
unavailableSystem.marker = { status: "unavailable", value: null, reason: "insufficient_data" };
const unavailableAudit = auditOpenedInterpretations(unavailable);
assert(unavailableAudit.complete, "genuinely unavailable section must not force regeneration");

console.log("1..5");
console.log("ok 1 - complete current interpretation passes");
console.log("ok 2 - truncated interpretation requires regeneration");
console.log("ok 3 - unresolved references require regeneration");
console.log("ok 4 - false unavailable interpretation requires regeneration");
console.log("ok 5 - genuinely unavailable interpretation remains valid");
