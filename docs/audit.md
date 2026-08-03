# Interpretation audit

Every generated scalar string and array item is checked independently by the deterministic NLP audit before it is accepted.

The local pass performs Unicode normalisation, sentence splitting, forbidden-pattern checks, character n-gram cosine screening, field-lexicon fit, duplicate detection and formatting checks. It also detects code fences, headings, bullet markers, placeholders, leaked source references, missing direct address and incomplete prose.

The NLP layer is a zero-token detector, not an execution gate. When it reports a finding, the orchestrator sends the parsed strict-schema candidate and the exact report to the configured small model. The repair call must preserve sound conclusions and source references, make the smallest necessary correction and return the same strict schema. The repaired candidate is audited again.

A remaining heuristic warning cannot terminate chart generation or discard accepted work. After bounded repair attempts, the parsed candidate remains available as a soft fallback and the chart continues. Transport, authentication and persistent schema failures remain separate from NLP findings and use the normal timeout, retry and recovery mechanisms.

Different planets, houses, aspects and life domains may describe opposing context-dependent tendencies. Cross-unit tension is therefore not treated as corruption: someone may be guarded publicly and warm privately, restrained in one setting and intense in another. Cross-unit similarity or apparent contradiction cannot rewrite accepted units or fail a wave. Final synthesis may contextualise those tensions without erasing them.

Strength and tension arrays use scored semantic-role checks rather than one-word vetoes. Theme arrays are semantic labels rather than miniature summaries. Safe local repair may remove process narration, boilerplate, fences, repeated labels, exact duplicate sentences and cosmetic punctuation without spending model tokens.

Recovered fields are audited again in fixed plan order before later fields continue. This restores the original audit context while preserving the same non-fatal repair contract.
