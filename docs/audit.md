# Interpretation audit

Every generated scalar string and every array item is audited independently using `nlp-audit/1.0.3`.

The local audit performs Unicode normalisation, sentence splitting, forbidden-pattern checks, character n-gram cosine screening, field lexicon fit, duplicate detection and cross-field near-duplicate detection. It also rejects code fences, headings, bullet markers and placeholders.

Strength and tension arrays use scored semantic-role checks rather than one-word vetoes. Multiple opposite-role cues are required before rejection, while positive and negative framing allows a tension to explain how a strength becomes difficult, or a strength to explain constructive use of pressure. Clearly misplaced positive or negative prose still fails deterministic audit.

Theme arrays are semantic labels, not miniature summaries. They remain subject to formatting, boilerplate, duplication and cross-field checks, but they do not have to repeat generic words such as `theme`, `chart`, `planet` or the point name. This permits natural labels such as emotional memory, private belonging or instinctive response without weakening audits on summaries, details, strengths or tensions.

Safe repair may remove process narration, boilerplate, fences, repeated labels and exact duplicate sentences. It never invents astrology or source references. A field that remains empty, irrelevant, incomplete or near-duplicated is rejected for narrow regeneration using the same chart conversation.

Recovered fields are audited again in fixed plan order before later fields continue. This restores the original cross-field similarity context and prevents modified temporary state from bypassing the normal audit.
