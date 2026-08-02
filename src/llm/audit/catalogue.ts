export const auditProfile = "nlp-audit/1.0.2" as const;

export const forbiddenPatterns: readonly RegExp[] = [
  /\bas an ai\b/iu,
  /\bi (?:will|shall) (?:analyse|analyze|investigate|examine|review|consider|first)\b/iu,
  /\bfirst,? i (?:will|shall)\b/iu,
  /\bthe next step\b/iu,
  /\bbased on (?:the|this) (?:prompt|provided json|supplied json|instructions?)\b/iu,
  /\baccording to my instructions\b/iu,
  /\bthe schema (?:requires|says|specifies)\b/iu,
  /\bthis (?:response|task|request)\b/iu,
  /\bthe user (?:asked|requested)\b/iu,
  /\bi cannot (?:provide|comply|help)\b/iu,
  /\blanguage model\b/iu,
  /\btoken limit\b/iu,
  /\bstructured output\b/iu,
  /\btool call\b/iu,
  /\bconversation id\b/iu,
  /\bfor entertainment purposes only\b/iu,
  /\bnot (?:a substitute for|professional) (?:medical|legal|financial|scientific) advice\b/iu,
];

export const unwantedExamples: readonly string[] = [
  "I will analyse the supplied chart and explain the requested field.",
  "Based on the provided JSON, the next step is to review the relevant placements.",
  "As an AI language model, I cannot provide professional advice.",
  "The schema requires this response to contain structured output.",
  "According to my instructions, I should interpret the chart without disclaimers.",
];
