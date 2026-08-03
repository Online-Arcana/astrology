import type { JsonRef } from "../../types/base.js";
import type { Section } from "../../types/chart.js";
import { refsValid } from "../../ref/resolve.js";
import { auditField, auditList, type FieldProfile } from "../audit/field.js";
import type { UnitAudit } from "./types.js";

export const auditSection = (
  section: Section,
  calculation: unknown,
  allowed: ReadonlySet<JsonRef>,
  profile: FieldProfile,
): UnitAudit<Section> => {
  const errors: string[] = [];
  const summary = section.summary === null ? null : auditField(section.summary, { ...profile, id: `${profile.id}.summary` });
  const detail = section.detail === null ? null : auditField(section.detail, { ...profile, id: `${profile.id}.detail` });
  const themes = auditList(section.themes, { ...profile, id: `${profile.id}.themes`, minLength: 3 });
  const strengths = auditList(section.strengths, { ...profile, id: `${profile.id}.strengths`, minLength: 3 });
  const tensions = auditList(section.tensions, { ...profile, id: `${profile.id}.tensions`, minLength: 3 });

  if (summary && !summary.valid) errors.push(...summary.issues.map((issue) => issue.message));
  if (detail && !detail.valid) errors.push(...detail.issues.map((issue) => issue.message));
  for (const result of [themes, strengths, tensions]) {
    if (!result.valid) errors.push(...result.issues.map((issue) => issue.message));
  }
  if (!refsValid(calculation, section.sourceRefs, allowed)) errors.push(`${profile.id} contains invalid source references`);

  const unique = [...new Set(errors)];
  const needsRepair = unique.length > 0;

  return {
    valid: !needsRepair,
    value: {
      ...section,
      summary: summary?.value ?? null,
      detail: detail?.value ?? null,
      themes: themes.values,
      strengths: strengths.values,
      tensions: tensions.values,
    },
    errors: unique,
    soft: needsRepair,
    ...(needsRepair ? { repair: "audit" as const } : {}),
  };
};
