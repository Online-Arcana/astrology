import {
  parseCareerInterpretation,
  parseCompatibilityOverview,
  parseFinalSynthesis,
  parseMoneyInterpretation,
  parseRomanticInterpretation,
  parseSexualInterpretation,
  parseSignCompatibility,
  parseStrictSection,
  parseSystemSynthesis,
} from "../chart/parse.js";
import { compatibilityDomains } from "../compat/catalogue.js";
import { generatedNamePattern } from "../file/invariants.js";
import { auditStructured } from "../llm/audit/structured.js";
import type { FieldProfile } from "../llm/audit/field.js";
import { fieldProfiles } from "../llm/audit/profiles.js";
import { refsValid } from "../ref/resolve.js";
import type { JsonRef } from "../types/base.js";
import type { CompatibilityDomain, Sign } from "../types/astro.js";
import type { AstralFile, InterpretationUnit } from "../types/file.js";
import { signs } from "../zodiac/position.js";

export interface OpenedInterpretationAudit {
  complete: boolean;
  invalidUnitIds: string[];
}

interface ParsedUnit {
  sourceRefs: JsonRef[];
  status?: unknown;
  summary?: unknown;
  detail?: unknown;
}

const compatibilityDomainSet = new Set<CompatibilityDomain>(compatibilityDomains);

const compatibilityDomain = (value: string | undefined): CompatibilityDomain | null =>
  value !== undefined && compatibilityDomainSet.has(value as CompatibilityDomain)
    ? value as CompatibilityDomain
    : null;

const sign = (value: string | undefined): Sign | null =>
  value !== undefined && signs.includes(value as Sign) ? value as Sign : null;

const human = (value: string): string => value
  .replaceAll(/([a-z])([A-Z])/gu, "$1 $2")
  .replaceAll(/[._-]+/gu, " ")
  .replaceAll(/\s+/gu, " ")
  .trim();

const lexicon = (unit: InterpretationUnit): string[] => {
  const specific = human(`${unit.section} ${unit.domain ?? ""} ${unit.zodiac}`).toLowerCase().split(" ");
  return [...new Set([
    ...specific,
    "astrology", "chart", "planet", "sign", "house", "aspect", "relationship", "compatibility",
    "theme", "pattern", "strength", "tension",
  ].filter((value) => value.length > 2))];
};

const profileFor = (unit: InterpretationUnit): FieldProfile => {
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
  return {
    id: unit.id,
    lexicon: [...new Set([...lexicon(unit), ...(specialist?.lexicon ?? [])])],
    minLength: 2,
    maxLength: 4_000,
    ...(specialist?.fieldLexicons === undefined ? {} : { fieldLexicons: specialist.fieldLexicons }),
  };
};

const sectionValue = (file: AstralFile, unitId: string): unknown => {
  const chart = file["astral-chart"];
  if (unitId === "final-synthesis") return chart.finalSynthesis;
  const prefix = `${chart.zodiac}.`;
  if (!unitId.startsWith(prefix)) return undefined;
  const parts = unitId.slice(prefix.length).split(".");
  const group = parts[0];
  const system = chart.system;

  switch (group) {
    case "overview": return system.overview;
    case "big-three": {
      const key = parts[1];
      if (key === "sun" || key === "moon" || key === "ascendant") return system.bigThree[key];
      return undefined;
    }
    case "life": {
      const key = parts[1];
      return key === undefined ? undefined : (system.life as unknown as Record<string, unknown>)[key];
    }
    case "point": {
      const key = parts[1];
      return key === undefined ? undefined : (system.points as unknown as Record<string, unknown>)[key];
    }
    case "house": {
      const key = parts[1];
      return key === undefined ? undefined : (system.houses as unknown as Record<string, unknown>)[key];
    }
    case "aspect": {
      const id = parts.slice(1).join(".");
      return system.aspects.find((value) => value.id === id)?.section;
    }
    case "pattern": {
      const id = parts.slice(1).join(".");
      return system.patterns.find((value) => value.id === id)?.section;
    }
    case "lunar": {
      const key = parts[1];
      if (key === "phase" || key === "nodes" || key === "lilith") return system.lunar[key];
      return undefined;
    }
    case "eclipse": {
      const key = parts[1];
      if (key === "at-birth") return system.eclipses.atBirth;
      if (key === "prenatal-solar") return system.eclipses.prenatalSolar;
      if (key === "prenatal-lunar") return system.eclipses.prenatalLunar;
      return undefined;
    }
    case "rulership-dignity": return system.rulershipAndDignity;
    case "chart-balance": return system.chartBalance;
    case "dominant-themes": return system.dominantThemes;
    case "synthesis": return system.synthesis;
    case "compatibility": {
      const domain = compatibilityDomain(parts[1]);
      if (domain === null) return undefined;
      const selected = chart.compatibility.domains[domain];
      const target = parts[2];
      if (target === "overview") return { overview: selected.overview, sourceRefs: selected.sourceRefs };
      const selectedSign = sign(target);
      return selectedSign === null ? undefined : selected.signs[selectedSign];
    }
    default: return undefined;
  }
};

const parsedValue = (unitId: string, value: unknown): ParsedUnit => {
  if (unitId === "final-synthesis") return parseFinalSynthesis(value);
  const parts = unitId.split(".");
  const group = parts[1];
  if (group === "synthesis") return parseSystemSynthesis(value);
  if (group === "compatibility") {
    const target = parts[3];
    if (target === "overview") return parseCompatibilityOverview(value);
    const selectedSign = sign(target);
    if (selectedSign === null) throw new TypeError(`Unknown compatibility sign in ${unitId}`);
    return parseSignCompatibility(value, selectedSign);
  }
  if (group === "life") {
    const key = parts[2];
    if (key === "romance") return parseRomanticInterpretation(value);
    if (key === "sexuality") return parseSexualInterpretation(value);
    if (key === "careerAndVocation") return parseCareerInterpretation(value);
    if (key === "moneyAndMaterialSecurity") return parseMoneyInterpretation(value);
  }
  return parseStrictSection(value);
};

const writtenContentPresent = (value: ParsedUnit): boolean => {
  if (value.status !== "written") return true;
  return typeof value.summary === "string"
    && value.summary.trim().length > 0
    && typeof value.detail === "string"
    && value.detail.trim().length > 0;
};

const anySourceAvailable = (
  calculation: { "astral-calculation": AstralFile["astral-calculation"] },
  unit: InterpretationUnit,
): boolean => unit.allowedSourceRefs.some((sourceRef) =>
  refsValid(calculation, [sourceRef], new Set([sourceRef])));

const unitValid = (file: AstralFile, unit: InterpretationUnit): boolean => {
  try {
    const parsed = parsedValue(unit.id, sectionValue(file, unit.id));
    const calculation = { "astral-calculation": file["astral-calculation"] };
    const allowed = new Set(unit.allowedSourceRefs);
    if (!refsValid(calculation, parsed.sourceRefs, allowed)) return false;
    if (!writtenContentPresent(parsed)) return false;
    if (parsed.status === "unavailable" || parsed.status === "not_applicable") {
      return !anySourceAvailable(calculation, unit);
    }
    return auditStructured(parsed, calculation, allowed, profileFor(unit)).valid;
  } catch {
    return false;
  }
};

export const auditOpenedInterpretations = (file: AstralFile): OpenedInterpretationAudit => {
  const invalidUnitIds = file["astral-calculation"].interpretationPlan.units
    .filter((unit) => !unitValid(file, unit))
    .map(({ id }) => id);

  const calculation = file["astral-calculation"];
  const name = file["astral-chart"].subject.name;
  if (calculation.subject.providedName === null && !generatedNamePattern.test(name.value)) {
    invalidUnitIds.unshift("generated-name");
  }

  return {
    complete: invalidUnitIds.length === 0,
    invalidUnitIds,
  };
};
