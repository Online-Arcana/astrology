export const directInterpretationRules = [
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

export const sectionPrompt = (task: string): string => [
  task.trim(),
  "",
  ...directInterpretationRules,
].join("\n");
