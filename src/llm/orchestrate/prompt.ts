export const worldviewNeutralityRules = [
  "Keep every interpretation religiously and metaphysically agnostic.",
  "Do not assume, assert or imply belief in God or gods, divine will, providence, prayer, angels, demons, heaven, hell, salvation or religious doctrine.",
  "Do not assume, assert or imply souls, soul contracts, soul purpose, karma, karmic debt, past lives, reincarnation or spiritual obligations.",
  "Do not describe people, relationships or events as fated, destined, predestined, meant to be or cosmically required.",
  "Do not give the universe, cosmos, life or any unnamed external force intentions such as wanting, teaching, sending, placing, guiding or choosing events for the person.",
  "Do not invoke supernatural intervention, divine purpose, cosmic plans, sacred callings, spiritual missions or metaphysical causes.",
  "Technical astrological proper names such as Part of Spirit may remain as names only; never infer a religious or spiritual claim from the name.",
  "Use psychologically and experientially neutral language that a religious, non-religious or uncertain reader could all read without accepting a metaphysical premise.",
  "Treat astrology as an interpretive symbolic framework: prefer wording such as can describe, may suggest, is associated with or astrologically points towards, and do not claim that a placement literally causes a trait or event.",
] as const;

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
  ...worldviewNeutralityRules,
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

export const completionInterpretationRules = [
  "Complete the entire schema before adding optional detail.",
  "Use one or two complete sentences for ordinary narrative properties unless the schema clearly needs more.",
  "Keep summary fields to one or two complete sentences and detail fields to several focused sentences.",
  "Keep list entries short, independent and complete.",
  "Do not spend most of the response elaborating early properties or omit later properties.",
  "Finish every sentence, clause and list entry naturally.",
  "Before returning, verify that every required property is present and no text ends midway through a thought.",
] as const;

export const directInterpretationRules = [
  ...baseInterpretationRules,
  ...refinedInterpretationRules,
  ...humanFirstInterpretationRules,
  ...completionInterpretationRules,
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