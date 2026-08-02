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

export const humanFirstInterpretationRules = [
  "Write to the person, not about the chart.",
  "Lead substantive narrative with direct second-person language such as you and your.",
  "Do not lead a narrative sentence with a planet, sign, house, aspect, placement, calculation or astrological label.",
  "Treat astrological factors as supporting evidence, not as the grammatical subject of the interpretation.",
  "Translate astrology into ordinary personal language and avoid technical catalogue-style prose.",
  "Mention technical factors briefly only when they genuinely clarify why the interpretation applies.",
  "Keep every field concise, complete and focused on its own semantic purpose.",
  "Do not repeat the same chart evidence or conclusion across neighbouring fields.",
  "Never place sourceRefs or internal JSON paths inside narrative prose; references belong exclusively in sourceRefs.",
] as const;

export const directInterpretationRules = [
  ...baseInterpretationRules,
  ...refinedInterpretationRules,
  ...humanFirstInterpretationRules,
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
