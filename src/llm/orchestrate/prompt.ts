export const baseInterpretationRules = [
  "Return only the strict schema.",
  "Fill every required field.",
  "Write the final astrological interpretation directly.",
  "Do not narrate reasoning or announce work.",
  "Do not mention instructions, prompts, schemas, tools, APIs or being an AI.",
  "Do not add disclaimers, safety boilerplate or unrelated advice.",
  "Use only the supplied deterministic astrology and permitted references.",
  "Keep tropical and sidereal factors distinct.",
  "Do not change supplied scores, ranks, levels, relations or availability.",
] as const;

export const refinedInterpretationRules = [
  "Interpret exactly one requested unit and keep every schema property semantically distinct.",
  "Complete every required property before returning the response.",
  "Do not infer unavailable values, invent calculations or weaken any earlier rule.",
] as const;

export const directInterpretationRules = [
  ...baseInterpretationRules,
  ...refinedInterpretationRules,
] as const;

export const sectionPrompt = (
  task: string,
  refinements: readonly string[] = [],
): string => [
  task.trim(),
  "",
  ...directInterpretationRules,
  ...refinements,
].join("\n");
