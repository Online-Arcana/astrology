import { auditCompletion } from "../src/llm/audit/completion.js";
import { auditField, type FieldProfile } from "../src/llm/audit/field.js";
import { auditStructured } from "../src/llm/audit/structured.js";
import { shapeForUnit } from "../src/llm/schema/chart.js";
import type { JsonRef } from "../src/types/base.js";
import type { InterpretationUnit } from "../src/types/file.js";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profile = (id: string): FieldProfile => ({
  id,
  lexicon: ["tropical", "overview", "astrology", "chart", "planet", "sign", "house", "aspect"],
  minLength: 2,
  maxLength: 4_000,
});

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

test("strength entries accept direct human meaning without chart keywords", () => {
  const result = auditField(
    "You can hold competing priorities together without losing direction or confidence.",
    profile("tropical.overview.strengths[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("tension entries accept direct human meaning without chart keywords", () => {
  const result = auditField(
    "You can become impatient with slower processes, creating avoidable friction when careful pacing would work better.",
    profile("tropical.overview.tensions[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("theme entries may use concise direct semantic language", () => {
  const result = auditField(
    "Your emotional memory shapes instinctive reactions to familiar people and places.",
    profile("tropical.point.moon.themes[2]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("strong evidence for a neighbouring field remains detectable", () => {
  const result = auditField(
    "You discuss needs openly, name boundaries directly and clarify misunderstandings through explicit conversation.",
    {
      ...profile("tropical.life.sexuality.preferredPace"),
      semanticField: "preferredPace",
      fieldLexicons: {
        preferredPace: ["pace", "slow", "fast", "gradual"],
        sexualCommunication: ["discuss", "openly", "boundaries", "conversation", "clarify"],
      },
    },
  );
  assert(!result.valid, "clear neighbouring-field content must be detected");
  assert(result.issues.some(({ code }) => code === "irrelevant"), "wrong field must report semantic irrelevance");
});

test("a tension may describe how a strength becomes difficult", () => {
  const result = auditField(
    "Your confidence and initiative can become excessive, creating pressure to act before everyone else is ready.",
    profile("tropical.aspect.imum_coeli_sun_trine.tensions[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("a strength may describe constructive use of pressure", () => {
  const result = auditField(
    "You can turn pressure and conflict into sharper insight when discipline supports a calm and effective response.",
    profile("tropical.aspect.imum_coeli_sun_trine.strengths[1]"),
  );
  assert(result.valid, result.issues.map(({ message }) => message).join("; "));
});

test("an obvious tension placed in strengths is detected", () => {
  const result = auditField(
    "You face persistent conflict and instability that create pressure and repeatedly undermine workable decisions.",
    profile("tropical.overview.strengths[2]"),
  );
  assert(!result.valid, "opposite-role strength entry must be detected");
  assert(result.issues.some(({ code }) => code === "irrelevant"), "opposite role must report irrelevance");
});

test("an obvious strength placed in tensions is detected", () => {
  const result = auditField(
    "Your reliable discipline and confidence provide a stable capacity for clear and effective action.",
    profile("tropical.overview.tensions[2]"),
  );
  assert(!result.valid, "opposite-role tension entry must be detected");
  assert(result.issues.some(({ code }) => code === "irrelevant"), "opposite role must report irrelevance");
});

test("process narration remains detectable", () => {
  const result = auditField(
    "I will analyse the supplied chart and explain the requested field.",
    profile("tropical.overview.strengths[3]"),
  );
  assert(!result.valid, "process narration must still be detected");
});

test("technical placement-led prose is detected", () => {
  const result = auditField(
    "The Virgo Moon in the eighth house points to a mind that notices hidden psychological layers.",
    profile("tropical.life.mindAndCommunication.detail"),
  );
  assert(!result.valid, "technical opening must be detected");
  assert(result.issues.some(({ code }) => code === "technical_opening"), "technical opening code");
});

test("internal source references are detected outside sourceRefs", () => {
  const result = auditField(
    "Your emotional intensity deepens trust [#/astral-calculation/system/points/moon].",
    profile("tropical.life.emotionalNature.detail"),
  );
  assert(!result.valid, "reference leakage must be detected");
  assert(result.issues.some(({ code }) => code === "reference_leakage"), "reference leakage code");
});

test("path-aware duplicate diagnostics name the matched field and score", () => {
  const value = "You build trust slowly and protect emotional privacy until another person proves consistently reliable.";
  const result = auditField(value, {
    ...profile("tropical.life.sexuality.detail"),
    priorFields: [{ path: "tropical.life.romance.detail", value }],
  });
  assert(!result.valid, "exact cross-field duplicate must be detected");
  assert(
    result.issues.some(({ message }) => message.includes("tropical.life.romance.detail") && message.includes("score 1.0000")),
    "duplicate diagnostic must include path and score",
  );
});

test("structured audit applies a specialised subfield lexicon", () => {
  const result = auditStructured(
    { affectionStyle: "You make care tangible through warm touch and steady reassurance without demanding constant closeness." },
    {},
    new Set<JsonRef>(),
    {
      id: "tropical.life.romance",
      lexicon: ["romance"],
      fieldLexicons: {
        affectionStyle: ["warm", "touch", "reassurance", "care", "closeness"],
      },
      minLength: 2,
      maxLength: 4_000,
    },
  );
  assert(result.valid, result.errors.join("; "));
});

test("missing terminal punctuation is repaired locally", () => {
  const result = auditStructured(
    {
      tensions: [
        "You can become impatient with slower processes, creating avoidable friction when careful pacing would work better",
      ],
    },
    {},
    new Set<JsonRef>(),
    profile("tropical.point.sun"),
  );
  assert(result.valid, result.errors.join("; "));
  const tensions = (result.value as { tensions: string[] }).tensions;
  assert(tensions[0]?.endsWith(".") === true, "cosmetic punctuation must be appended locally");
});

test("natural terminal prepositions are not mistaken for unfinished clauses", () => {
  const issues = auditCompletion(
    { detail: "You may hesitate when deciding which long-term commitment to give your limited energy to" },
    "tropical.house.2",
  );
  assert(!issues.some(({ code }) => code === "dangling_clause"), "terminal preposition must remain valid English");
});

test("completion audit catches genuinely unfinished narrative text", () => {
  const issues = auditCompletion({ detail: "You seek depth and trust because" }, "tropical.life.sexuality");
  assert(issues.some(({ code }) => code === "dangling_clause"), "dangling clause must be detected");
});

test("genuinely unfinished prose requests repair without becoming fatal", () => {
  const result = auditStructured(
    { detail: "You seek depth and trust because" },
    {},
    new Set<JsonRef>(),
    profile("tropical.life.sexuality"),
  );
  assert(!result.valid, "genuinely unfinished prose must not be accepted directly");
  assert(result.repair === "completion", "genuine truncation must request small-model repair");
  assert(result.soft === true, "an unresolved NLP finding must remain non-fatal");
});

test("ordinary NLP findings request small-model repair and remain non-fatal", () => {
  const result = auditStructured(
    {
      tensions: [
        "Difficulty trusting other people can create distance before close relationships have time to develop.",
      ],
    },
    {},
    new Set<JsonRef>(),
    profile("tropical.house.7"),
  );
  assert(!result.valid, "missing second-person language must be detected");
  assert(result.errors.some((message) => message.includes("direct second-person language")), "finding must be retained");
  assert(result.repair === "completion", "finding must be handed to the small-model repair path");
  assert(result.soft === true, "NLP must not terminate chart generation");
});

test("interpretation schemas enumerate only permitted source references", () => {
  const permitted = [
    "#/astral-calculation/system/points/venus",
    "#/astral-calculation/system/houses/placidus/houses/7",
  ] as const satisfies readonly JsonRef[];
  const unit: InterpretationUnit = {
    id: "tropical.life.romance",
    zodiac: "tropical",
    section: "life.romance",
    domain: null,
    allowedSourceRefs: [...permitted],
  };
  const shape = shapeForUnit(unit, permitted);
  const schema = shape.schema as {
    properties?: Record<string, { items?: { enum?: readonly string[] } }>;
  };
  const actual = schema.properties?.["sourceRefs"]?.items?.enum;
  assert(JSON.stringify(actual) === JSON.stringify(permitted), "sourceRefs must use the exact permitted-reference enum");
});

console.log(`1..${passed}`);
