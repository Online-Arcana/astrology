import type { Config } from "../../config.js";
import { generatedNamePattern } from "../../file/invariants.js";
import { resolveRef, refsValid } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import type { Section } from "../../types/chart.js";
import type { AstralCalculation, InterpretationUnit } from "../../types/file.js";
import { auditStructured } from "../audit/structured.js";
import type { FieldProfile } from "../audit/field.js";
import { object, strictShape, text } from "../schema/build.js";
import { shapeForUnit } from "../schema/chart.js";
import { sectionPrompt } from "./prompt.js";
import { runInterpretation } from "./run.js";
import type {
  InterpretationCall,
  InterpretationRun,
  RunHooks,
  SchemaClientFactory,
  UnitResult,
} from "./types.js";

export const promptCatalogue = "astral-prompts/1.0.0" as const;
export const structuredOutputCatalogue = "astral-structured-output/1.0.0" as const;
export const nlpAuditProfile = "astral-nlp-audit/1.0.1" as const;

export interface PlanInterpretationResult {
  run: InterpretationRun;
  generatedName: string | null;
}

interface SourceValue {
  ref: JsonRef;
  value: unknown;
}

const root = (calculation: AstralCalculation): { "astral-calculation": AstralCalculation } => ({
  "astral-calculation": calculation,
});

const useful = (calculation: AstralCalculation, ref: JsonRef): boolean =>
  refsValid(root(calculation), [ref], new Set([ref]));

const sources = (calculation: AstralCalculation, refs: readonly JsonRef[]): SourceValue[] =>
  refs
    .filter((ref) => useful(calculation, ref))
    .map((ref) => ({ ref, value: resolveRef(root(calculation), ref) }));

const human = (value: string): string => value
  .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
  .replaceAll(/[._-]+/gu, " ")
  .replaceAll(/\s+/gu, " ")
  .trim();

const task = (unit: InterpretationUnit): string => {
  const subject = human(unit.section);
  const domain = unit.domain ? ` within the ${human(unit.domain)} compatibility domain` : "";
  const system = unit.zodiac ? ` for the ${unit.zodiac} zodiac system` : " across both zodiac systems";
  return sectionPrompt([
    `Write only the final ${subject} interpretation${system}${domain}.`,
    "Treat the supplied source objects as fixed facts.",
    "Use only sourceRefs supplied in the source list and cite the exact local JSON references used.",
    "Do not infer unavailable calculations, add extra fields or merge this field with another interpretation field.",
  ].join("\n"));
};

const lexicon = (unit: InterpretationUnit): string[] => {
  const specific = human(`${unit.section} ${unit.domain ?? ""} ${unit.zodiac ?? ""}`).toLowerCase().split(" ");
  return [...new Set([
    ...specific,
    "astrology",
    "chart",
    "planet",
    "sign",
    "house",
    "aspect",
    "relationship",
    "compatibility",
    "theme",
    "pattern",
    "strength",
    "tension",
  ].filter((value) => value.length > 2))];
};

const narratives = (value: unknown): string[] => {
  if (typeof value === "string") return value.length >= 60 && !value.startsWith("#/") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(narratives);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(narratives);
  return [];
};

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

const syntheticAllowed = (unit: InterpretationUnit): boolean =>
  ![
    "life.romance",
    "life.sexuality",
    "life.careerAndVocation",
    "life.moneyAndMaterialSecurity",
    "synthesis",
    "compatibility.overview",
    "compatibility.sign",
    "crossSystem",
    "finalSynthesis",
  ].includes(unit.section);

const substantiveCalls = (
  calculation: AstralCalculation,
): { calls: InterpretationCall[]; synthetic: Record<string, UnitResult<object>> } => {
  const calls: InterpretationCall[] = [];
  const synthetic: Record<string, UnitResult<object>> = {};
  const prior: string[] = [];

  for (const unit of calculation.interpretationPlan.units) {
    const unitSources = sources(calculation, unit.allowedSourceRefs);
    if (unitSources.length === 0) {
      if (!syntheticAllowed(unit)) {
        throw new Error(`Interpretation unit ${unit.id} has no available deterministic source`);
      }
      synthetic[unit.id] = genericUnavailable(unit);
      continue;
    }

    const allowed = new Set(unitSources.map(({ ref }) => ref));
    const profile: FieldProfile = {
      id: unit.id,
      lexicon: lexicon(unit),
      minLength: 2,
      maxLength: 4_000,
      priorFields: prior,
    };

    calls.push({
      id: unit.id,
      label: human(unit.id),
      kind: "big",
      shape: shapeForUnit(unit),
      allowedSourceRefs: allowed,
      input: ({ correction }) => ({
        instructions: task(unit),
        deterministicData: {
          unit: {
            id: unit.id,
            zodiac: unit.zodiac,
            section: unit.section,
            domain: unit.domain,
          },
          sources: unitSources,
        },
        permittedSourceRefs: [...allowed],
        ...(correction.length === 0
          ? {}
          : {
              correction: {
                instruction: "Correct only this field and return the same strict schema.",
                auditFailures: correction,
              },
            }),
      }),
      audit: (value, { calculation: calculationRoot }) => {
        const audited = auditStructured(value, calculationRoot, allowed, profile);
        if (audited.valid) prior.push(...narratives(audited.value));
        return audited;
      },
    });
  }

  return { calls, synthetic };
};

const nameRefs = [
  "#/astral-calculation/provenance/calculationFingerprint",
  "#/astral-calculation/systems/tropical/derived/dominantPlanets",
  "#/astral-calculation/systems/tropical/derived/dominantSigns",
  "#/astral-calculation/systems/sidereal/derived/dominantPlanets",
  "#/astral-calculation/systems/sidereal/derived/dominantSigns",
] as const satisfies readonly JsonRef[];

const generatedNameCall = (calculation: AstralCalculation): InterpretationCall => {
  const available = sources(calculation, nameRefs);
  const allowed = new Set(available.map(({ ref }) => ref));
  return {
    id: "generated-name",
    label: "Generated chart name",
    kind: "small",
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
): Promise<PlanInterpretationResult> => {
  const prepared = interpretationCalls(calculation);
  if (prepared.calls.length === 0) throw new Error("Interpretation plan contains no callable units");

  const raw = await runInterpretation(root(calculation), prepared.calls, config, createClient, hooks);
  const generated = raw.units["generated-name"]?.value as { value?: unknown } | undefined;
  const generatedName = calculation.subject.providedName === null
    ? typeof generated?.value === "string"
      ? generated.value
      : null
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

  return {
    run: { ...raw, units },
    generatedName,
  };
};
