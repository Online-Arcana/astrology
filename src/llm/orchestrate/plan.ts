import type { Config } from "../../config.js";
import { generatedNamePattern } from "../../file/invariants.js";
import { resolveRef, refsValid } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import type { Section } from "../../types/chart.js";
import type { AstralCalculation, InterpretationUnit } from "../../types/file.js";
import type { NarrativeEntry } from "../audit/field.js";
import { auditStructured } from "../audit/structured.js";
import type { FieldProfile } from "../audit/field.js";
import { fieldProfiles } from "../audit/profiles.js";
import { object, strictShape, text } from "../schema/build.js";
import { shapeForUnit } from "../schema/chart.js";
import { sectionPrompt } from "./prompt.js";
import { runInterpretation } from "./run.js";
import type {
  InterpretationCall,
  InterpretationRecovery,
  InterpretationRun,
  ReasoningEffort,
  RunHooks,
  SchemaClientFactory,
  UnitResult,
} from "./types.js";

export const promptCatalogue = "astral-prompts/1.3.0" as const;
export const structuredOutputCatalogue = "astral-structured-output/1.1.0" as const;
export const nlpAuditProfile = "astral-nlp-audit/1.1.0" as const;
export const modelRoutingProfile = "astral-model-routing/1.1.0" as const;

export interface PlanInterpretationResult {
  run: InterpretationRun;
  generatedName: string | null;
}

interface SourceValue {
  ref: JsonRef;
  value: unknown;
}

interface Route {
  kind: InterpretationCall["kind"];
  effort?: ReasoningEffort;
  tokens: number;
}

const root = (calculation: AstralCalculation): { "astral-calculation": AstralCalculation } => ({
  "astral-calculation": calculation,
});

const useful = (calculation: AstralCalculation, ref: JsonRef): boolean =>
  refsValid(root(calculation), [ref], new Set([ref]));

const sources = (calculation: AstralCalculation, refs: readonly JsonRef[]): SourceValue[] =>
  refs.filter((ref) => useful(calculation, ref)).map((ref) => ({ ref, value: resolveRef(root(calculation), ref) }));

const human = (value: string): string => value
  .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
  .replaceAll(/[._-]+/gu, " ")
  .replaceAll(/\s+/gu, " ")
  .trim();

const task = (unit: InterpretationUnit): string => {
  const subject = human(unit.section);
  const domain = unit.domain ? ` within the ${human(unit.domain)} compatibility domain` : "";
  return sectionPrompt([
    `Write only the final ${subject} interpretation for the selected ${unit.zodiac} zodiac system${domain}.`,
    "Treat the supplied source objects as fixed facts.",
    "Use only references supplied in permittedSourceRefs.",
    "Put exact local JSON references exclusively in sourceRefs; never include a #/ path or source reference in narrative prose.",
    "Do not mention, compare or import the unselected zodiac system or another ayanamsha.",
    "Do not infer unavailable calculations, add extra fields or merge this field with another interpretation field.",
  ].join("\n"));
};

const correctionInstruction = (unit: InterpretationUnit): string => {
  const lines = [
    "Correct only this interpretation unit and return the same strict schema.",
    "Copy every sourceRefs value exactly from permittedSourceRefs.",
    "Never invent, shorten, translate, normalise or alter a source reference.",
    "Never place a source reference or internal JSON path inside narrative prose.",
    "Write directly to the person using you and your, and lead with human meaning rather than chart mechanics.",
    "Do not begin narrative sentences with a planet, sign, house, aspect, placement or calculation label.",
    "Keep every narrative property semantically distinct.",
    "Do not repeat or lightly paraphrase the summary, detail or another property.",
    "Complete every required property and finish every sentence and list entry.",
    `Use only the selected ${unit.zodiac} zodiac system.`,
  ];

  if (unit.section === "life.romance") {
    lines.push(
      "summary must give the concise overall romantic pattern.",
      "detail must explain the pattern without repeating the summary.",
      "affectionStyle must describe how warmth, care or affection is expressed.",
      "courtshipStyle must describe pursuit, attraction or early romantic approach.",
      "attachmentNeeds must describe emotional security, closeness, autonomy or reassurance needs.",
      "commitmentPattern must describe durability, loyalty, exclusivity or independence in commitment.",
    );
  }

  return lines.join("\n");
};

const lexicon = (unit: InterpretationUnit): string[] => {
  const specific = human(`${unit.section} ${unit.domain ?? ""} ${unit.zodiac}`).toLowerCase().split(" ");
  return [...new Set([
    ...specific,
    "astrology", "chart", "planet", "sign", "house", "aspect", "relationship", "compatibility",
    "theme", "pattern", "strength", "tension",
  ].filter((value) => value.length > 2))];
};

const synth = new Set(["synthesis", "finalSynthesis"]);

const route = (unit: InterpretationUnit): Route => {
  if (synth.has(unit.section)) return { kind: "big", tokens: 6_000 };
  if (unit.section === "overview" || unit.section === "compatibility.overview" || unit.section.startsWith("life.")) {
    return { kind: "big", effort: "low", tokens: 3_200 };
  }
  return { kind: "small", effort: "none", tokens: 1_800 };
};

const narrativeEntries = (
  value: unknown,
  path: string,
  key: string | null = null,
): NarrativeEntry[] => {
  if (key === "sourceRefs") return [];
  if (typeof value === "string") return value.length >= 60 && !value.startsWith("#/") ? [{ path, value }] : [];
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => narrativeEntries(item, `${path}[${index}]`));
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([childKey, child]) => narrativeEntries(child, `${path}.${childKey}`, childKey));
};

const acceptedNarratives = (earlier: Readonly<Record<string, unknown>>): NarrativeEntry[] =>
  Object.entries(earlier).flatMap(([id, raw]) => {
    const value = typeof raw === "object" && raw !== null && "value" in raw
      ? (raw as { value: unknown }).value
      : raw;
    return narrativeEntries(value, id);
  });

const genericUnavailable = (unit: InterpretationUnit): UnitResult<object> => {
  const value: Section = {
    status: "unavailable",
    title: human(unit.section),
    summary: null,
    detail: null,
    themes: [],
    strengths: [],
    tensions: [],
    sourceRefs: [],
  };
  return { id: unit.id, value, attempts: 1, model: "deterministic" };
};

const syntheticAllowed = (unit: InterpretationUnit): boolean => ![
  "life.romance",
  "life.sexuality",
  "life.careerAndVocation",
  "life.moneyAndMaterialSecurity",
  "synthesis",
  "compatibility.overview",
  "compatibility.sign",
  "finalSynthesis",
].includes(unit.section);

const substantiveCalls = (
  calculation: AstralCalculation,
): { calls: InterpretationCall[]; synthetic: Record<string, UnitResult<object>> } => {
  const calls: InterpretationCall[] = [];
  const synthetic: Record<string, UnitResult<object>> = {};

  for (const unit of calculation.interpretationPlan.units) {
    const unitSources = sources(calculation, unit.allowedSourceRefs);
    if (unitSources.length === 0) {
      if (!syntheticAllowed(unit)) throw new Error(`Interpretation unit ${unit.id} has no available deterministic source`);
      synthetic[unit.id] = genericUnavailable(unit);
      continue;
    }

    const allowed = new Set(unitSources.map(({ ref }) => ref));
    const specialistKey = unit.section === "life.romance"
      ? "romance"
      : unit.section === "life.sexuality"
        ? "sexuality"
        : unit.section === "life.careerAndVocation"
          ? "career"
          : unit.section === "life.moneyAndMaterialSecurity"
            ? "money"
            : null;
    const specialist = specialistKey === null ? null : fieldProfiles[specialistKey] ?? null;
    const profile: FieldProfile = {
      id: unit.id,
      lexicon: [...new Set([...lexicon(unit), ...(specialist?.lexicon ?? [])])],
      minLength: 2,
      maxLength: 4_000,
      ...(specialist?.fieldLexicons === undefined ? {} : { fieldLexicons: specialist.fieldLexicons }),
    };

    calls.push({
      id: unit.id,
      label: human(unit.id),
      ...route(unit),
      shape: shapeForUnit(unit, [...allowed]),
      allowedSourceRefs: allowed,
      input: ({ correction }) => ({
        instructions: task(unit),
        deterministicData: {
          unit: { id: unit.id, zodiac: unit.zodiac, section: unit.section, domain: unit.domain },
          sources: unitSources,
        },
        permittedSourceRefs: [...allowed],
        ...(correction.length === 0 ? {} : {
          correction: {
            instruction: correctionInstruction(unit),
            auditFailures: correction,
          },
        }),
      }),
      audit: (value, context) => auditStructured(
        value,
        context.calculation,
        allowed,
        { ...profile, priorFields: acceptedNarratives(context.earlier) },
      ),
    });
  }

  return { calls, synthetic };
};

const nameRefs = [
  "#/astral-calculation/provenance/calculationFingerprint",
  "#/astral-calculation/system/derived/dominantPlanets",
  "#/astral-calculation/system/derived/dominantSigns",
] as const satisfies readonly JsonRef[];

const generatedNameCall = (calculation: AstralCalculation): InterpretationCall => {
  const available = sources(calculation, nameRefs);
  const allowed = new Set(available.map(({ ref }) => ref));
  return {
    id: "generated-name",
    label: "Generated chart name",
    kind: "small",
    effort: "none",
    tokens: 128,
    shape: strictShape<{ value: string }>(
      "generated_chart_name",
      object({ value: text() }),
      (value) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError("Generated name output must be an object");
        }
        const keys = Object.keys(value);
        const name = (value as { value?: unknown }).value;
        if (keys.length !== 1 || keys[0] !== "value" || typeof name !== "string") {
          throw new TypeError("Generated name output must contain only value");
        }
        return { value: name };
      },
    ) as unknown as InterpretationCall["shape"],
    allowedSourceRefs: allowed,
    input: ({ correction }) => ({
      instructions: sectionPrompt([
        "Create a memorable chart name of exactly three hyphenated words.",
        "Return only the strict JSON object.",
        "Use ordinary Unicode letters or numbers within each word and no spaces.",
        "Do not include a person name, explanation, punctuation other than the two hyphens or astrological calculations.",
      ].join("\n")),
      deterministicData: available,
      ...(correction.length === 0 ? {} : { auditFailures: correction }),
    }),
    audit: (value) => {
      const candidate = value as { value?: unknown };
      const valid = typeof candidate.value === "string" && generatedNamePattern.test(candidate.value);
      return {
        valid,
        value,
        errors: valid ? [] : ["Generated chart name must contain exactly three hyphenated words"],
      };
    },
  };
};

export const interpretationCalls = (
  calculation: AstralCalculation,
): { calls: InterpretationCall[]; synthetic: Record<string, UnitResult<object>> } => {
  const prepared = substantiveCalls(calculation);
  return {
    calls: calculation.subject.providedName === null
      ? [...prepared.calls, generatedNameCall(calculation)]
      : prepared.calls,
    synthetic: prepared.synthetic,
  };
};

export const runInterpretationPlan = async (
  calculation: AstralCalculation,
  config: Config,
  createClient: SchemaClientFactory,
  hooks: RunHooks = {},
  recovery: InterpretationRecovery | null = null,
): Promise<PlanInterpretationResult> => {
  const prepared = interpretationCalls(calculation);
  if (prepared.calls.length === 0) throw new Error("Interpretation plan contains no callable units");

  const raw = await runInterpretation(root(calculation), prepared.calls, config, createClient, hooks, recovery);
  const generated = raw.units["generated-name"]?.value as { value?: unknown } | undefined;
  const generatedName = calculation.subject.providedName === null
    ? typeof generated?.value === "string" ? generated.value : null
    : null;
  if (calculation.subject.providedName === null && generatedName === null) {
    throw new Error("Interpretation did not produce the required generated chart name");
  }

  const units: Record<string, UnitResult<object>> = {};
  for (const unit of calculation.interpretationPlan.units) {
    const value = raw.units[unit.id] ?? prepared.synthetic[unit.id];
    if (!value) throw new Error(`Interpretation result is missing ${unit.id}`);
    units[unit.id] = value;
  }

  return { run: { ...raw, units }, generatedName };
};
