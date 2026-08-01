import { resolveRef, refsValid } from "../../ref/resolve.js";
import type { JsonRef } from "../../types/base.js";
import type { Section } from "../../types/chart.js";
import type { AstralCalculation, InterpretationUnit } from "../../types/file.js";
import { auditStructured } from "../audit/structured.js";
import type { FieldProfile } from "../audit/field.js";
import { shapeForUnit } from "../schema/chart.js";
import { sectionPrompt } from "./prompt.js";
import type { InterpretationCall, InterpretationRun, UnitResult } from "./types.js";
import { InterpretationRunner } from "./run.js";

export const promptCatalogue = "astral-prompts/1.0.0" as const;
export const structuredOutputCatalogue = "astral-structured-output/1.0.0" as const;
export const nlpAuditProfile = "astral-nlp-audit/1.0.0" as const;

export interface PlanRunOptions {
  metadata?: Record<string, string>;
  developerMessage?: string;
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

const sources = (calculation: AstralCalculation, unit: InterpretationUnit): SourceValue[] =>
  unit.allowedSourceRefs
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

export const interpretationCalls = (
  calculation: AstralCalculation,
): { calls: InterpretationCall<object>[]; synthetic: Record<string, UnitResult<object>> } => {
  const calls: InterpretationCall<object>[] = [];
  const synthetic: Record<string, UnitResult<object>> = {};
  const prior: string[] = [];
  for (const unit of calculation.interpretationPlan.units) {
    const unitSources = sources(calculation, unit);
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
      section: unit.section,
      task: task(unit),
      data: {
        unit: {
          id: unit.id,
          zodiac: unit.zodiac,
          section: unit.section,
          domain: unit.domain,
        },
        sources: unitSources,
      },
      shape: shapeForUnit(unit),
      allowedRefs: [...allowed],
      audit: (value) => {
        const audited = auditStructured(value, root(calculation), allowed, profile);
        if (audited.valid) prior.push(...narratives(audited.value));
        return audited;
      },
      reasoningEffort: unit.section === "synthesis" || unit.section === "crossSystem" || unit.section === "finalSynthesis"
        ? "medium"
        : "low",
      maxOutputTokens: unit.section === "finalSynthesis" ? 2_400 : unit.section === "synthesis" ? 1_600 : 1_200,
    });
  }
  return { calls, synthetic };
};

export const runInterpretationPlan = async (
  runner: InterpretationRunner,
  calculation: AstralCalculation,
  options: PlanRunOptions = {},
): Promise<InterpretationRun> => {
  const prepared = interpretationCalls(calculation);
  if (prepared.calls.length === 0) throw new Error("Interpretation plan contains no callable units");
  const run = await runner.run(prepared.calls, {
    calculation: root(calculation),
    ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    ...(options.developerMessage === undefined ? {} : { developerMessage: options.developerMessage }),
  });
  const units: Record<string, UnitResult<object>> = {};
  for (const unit of calculation.interpretationPlan.units) {
    const value = run.units[unit.id] ?? prepared.synthetic[unit.id];
    if (!value) throw new Error(`Interpretation result is missing ${unit.id}`);
    units[unit.id] = value;
  }
  return { ...run, units };
};
