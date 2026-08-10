export interface InterpretationVoiceProfile {
  id: string;
  semanticRegister: readonly string[];
  interpretiveVoice: readonly string[];
  separationContract: readonly string[];
  avoid: readonly string[];
}

/**
 * Astrology has two deliberately separate language layers.
 *
 * SEMANTIC REGISTER is private compiler input. It carries atomic meaning and
 * provenance but has no authority over wording, cadence or user-facing style.
 *
 * INTERPRETIVE VOICE is the application's prose voice. It may express only the
 * supplied semantics and chart evidence, but it must render them afresh rather
 * than imitating source or corpus language.
 */
export const interpretationVoiceProfile: InterpretationVoiceProfile = {
  id: "astral-interpretive-voice/1.0.0",
  semanticRegister: [
    "The semantic register is private, non-user-facing meaning supplied by the corpus compiler.",
    "Its propositions describe permitted concepts, not sentences to copy, quote or stylistically imitate.",
    "Corpus atom IDs, claim IDs, provenance, calculation variants and operator names are implementation data rather than prose.",
    "Traditional technical names may identify an astrological factor, but their wording never licenses metaphysical implications beyond the supplied neutral propositions.",
  ],
  interpretiveVoice: [
    "Address the chart owner directly in clear second-person language.",
    "Lead with human meaning and use astrological terminology only when it adds useful orientation.",
    "Write with calm precision, emotional literacy and ordinary contemporary language rather than theatrical, mystical or devotional language.",
    "Describe tendencies, patterns, tensions, choices and possible expressions rather than fixed traits, commands or predictions.",
    "Keep strengths and difficulties proportionate. Avoid flattery, moral judgement and manufactured drama.",
    "Remain non-characterful: do not speak as a named astrologer, narrator, oracle or spiritual authority, and do not use first-person opinions as a substitute for evidence.",
    "When the output language is English, prefer natural British English without making the prose mannered.",
  ],
  separationContract: [
    "There are two language layers and they must never merge.",
    "SEMANTIC REGISTER supplies what may be said. INTERPRETIVE VOICE controls how it is said.",
    "Never quote, paraphrase closely, imitate or preserve distinctive wording from semantic propositions or source passages merely because it appears in the input.",
    "Never expose corpus structure, atom names, claim IDs, provenance IDs, source document structure, compiler terminology or internal calculation identifiers in user-facing prose.",
    "Never let wording from a source override the interpretation voice, worldview-neutrality policy or epistemic style.",
    "Do not add a concept because it suits the prose voice. If the semantic input does not support it, omit it.",
  ],
  avoid: [
    "mystical filler",
    "religious or spiritual authority",
    "fate, destiny or cosmic intention",
    "source-author imitation",
    "textbook or catalogue voice",
    "first-person astrologer commentary",
    "machine identifiers",
    "explanations of the corpus or compiler",
    "certainty language that turns symbolic interpretation into causal fact",
  ],
} as const;

const lines = (title: string, values: readonly string[]): string[] => [
  title,
  ...values.map((value) => `- ${value}`),
];

export const semanticRegisterContract = (): string => [
  ...lines("SEMANTIC REGISTER:", interpretationVoiceProfile.semanticRegister),
  ...lines("SEPARATION CONTRACT:", interpretationVoiceProfile.separationContract),
].join("\n");

export const interpretiveVoiceContract = (): string => [
  ...lines("INTERPRETIVE VOICE:", interpretationVoiceProfile.interpretiveVoice),
  ...lines("AVOID:", interpretationVoiceProfile.avoid),
].join("\n");
