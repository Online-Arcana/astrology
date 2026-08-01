import type { JsonRef } from "../../types/base.js";
import type { Section } from "../../types/chart.js";
import type { FieldProfile } from "../audit/field.js";
import { sectionShape } from "../schema/section.js";
import { auditSection } from "./audit.js";
import { sectionPrompt } from "./prompt.js";
import type { InterpretationCall } from "./types.js";

export interface SectionUnitInput {
  id: string;
  label: string;
  kind?: "big" | "small";
  task: string;
  data: unknown;
  refs: readonly JsonRef[];
  profile: FieldProfile;
}

export const sectionUnit = (input: SectionUnitInput): InterpretationCall => {
  const allowed = new Set(input.refs);
  return {
    id: input.id,
    label: input.label,
    kind: input.kind ?? "big",
    shape: sectionShape(input.id) as unknown as InterpretationCall["shape"],
    allowedSourceRefs: allowed,
    input: ({ earlier }) => ({
      instructions: sectionPrompt(input.task),
      deterministicData: input.data,
      permittedSourceRefs: input.refs,
      earlierConclusions: earlier,
    }),
    audit: (value, { calculation }) => auditSection(value as Section, calculation, allowed, input.profile),
  };
};
