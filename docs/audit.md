# Interpretation audit

Every generated scalar string and every array item is audited independently using `nlp-audit/1.0.0`.

The local audit performs Unicode normalisation, sentence splitting, forbidden-pattern checks, character n-gram cosine screening, field lexicon fit, duplicate detection and cross-field near-duplicate detection. It also rejects code fences, headings, bullet markers and placeholders.

Safe repair may remove process narration, boilerplate, fences, repeated labels and exact duplicate sentences. It never invents astrology or source references. A field that remains empty, irrelevant, incomplete or near-duplicated is rejected for narrow regeneration using the same chart conversation.
