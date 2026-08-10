# Interpretation semantics

The interpretation code has two separate jobs: decide what an interpretation is allowed to say, then turn that meaning into readable prose. Keeping those jobs separate makes the output easier to audit and keeps source wording, internal identifiers and model habits out of the final text.

The semantic side is built from a reviewed corpus. The writing side receives a prepared interpretation map and renders it in the application's normal voice. The writer is not expected to supply missing astrology knowledge from its own training.

## Corpus data

Corpus code lives under `src/interpretation/corpus/`.

A corpus contains three main kinds of records:

- sources: documents that were reviewed for a specific use;
- atoms: reusable concepts such as a planet, sign, house or aspect;
- claims: small semantic statements attached to an atom and backed by one or more approved source references.

Sources are approved per document, not per website. A technical astronomy document can be approved for calculation work without making interpretation pages from the same publisher valid semantic sources.

The compiler checks that every production atom is approved, has claims, has source provenance and passes the worldview-neutrality rules. Development tools may compile partial corpora, but production compilation uses the complete required atom list in `requirements.ts` and fails if anything is missing.

## Meaning and calculation data

Calculation identifiers are normalised before they reach the corpus. Details that affect how a value was calculated stay as metadata unless they also have an approved semantic meaning.

For example, mean and true lunar nodes resolve to the same semantic node concept while retaining their calculation variant separately. Zodiac system names, calculation variants and JSON paths are not interpretation vocabulary by themselves.

The same rule applies to larger units. An aspect between two points is assembled from the two point meanings, the aspect meaning and the actual chart evidence rather than looking up a pre-written essay for every possible combination.

## Interpretation maps

`InterpretationMap` is the hand-off between semantic compilation and prose generation. It contains the subject of the unit, permitted chart evidence, approved propositions, corpus provenance and the concepts that must not be inferred.

Both model-written prose and deterministic reconstruction use this map. This is important during recovery: losing access to the model must not switch the application to a different interpretation system.

The map is internal data. Proposition wording is not a prose template. The writer is expected to express the supported meaning in fresh language, and the audit checks for near-copying of corpus text and leakage of compiler terminology.

## Writing voice

Astrology has one user-facing interpretive voice and a separate internal semantic register.

The user-facing text is direct, clear and non-theatrical. It normally addresses the chart owner as `you`, describes tendencies rather than certainties, and does not invent a named astrologer or first-person narrator. Internal source names, claim IDs, atom IDs and machine labels stay out of the prose.

The semantic register is only there to constrain meaning. It can be terse and technical because the user never sees it directly.

## Worldview neutrality

Interpretation text must not assume a religious or metaphysical worldview. Claims about divine intention, karma, reincarnation, souls, fate, predestination, supernatural intervention or a purposeful universe are rejected.

Technical names are treated by context. `Part of Spirit`, for example, remains a valid name for that calculated point; the name does not allow the interpretation to make claims about a soul or spiritual destiny.

The same checks apply to source ingestion, corpus claims, generated prose, corrective output, deterministic reconstruction and the completed interpretation. Ambiguous wording is sent to the lightweight worldview classifier. A classifier may accept or reject the wording, but it does not rewrite it.

The application is also neutral about why astrology might be meaningful to a user. Prose describes astrological associations rather than claiming that a chart placement literally causes an event or personality trait.

## Source ingestion

Semantic source material is reviewed before claim extraction. Obvious worldview contamination causes the passage to be rejected. Clean-looking passages still go through the source classifier before they can be distilled into claims.

Contaminated passages are not "cleaned up" and then admitted. If a usable neutral basis for a meaning cannot be found, that part of the corpus stays incomplete until it can be reviewed properly.

Calculation and architecture references are kept separate from semantic sources. They may support astronomy, geometry or compiler design, but they cannot be used as provenance for interpretation claims unless the specific document has also been approved as a semantic source.

## Runtime

For a corpus-backed run, the service prepares and validates all required interpretation maps before starting paid generation. If a required map cannot be produced, generation fails before opening the model conversation.

Each model call receives the semantic map, the permitted deterministic chart evidence and the writing instructions as separate fields. Output is checked for schema validity, grounding, field duplication, voice problems and worldview neutrality. Rejected output goes through the existing correction/escalation path.

If generation still fails, deterministic reconstruction uses the same interpretation map and application-owned sentence templates. The old XML fallback catalogue remains only for legacy, unmapped generation while the reviewed corpus is being completed.

## Current migration state

The runtime can already accept a semantic provider, but the built-in loader does not enable corpus-backed generation by default because the production corpus is not complete yet. Calls without a provider are marked as legacy/unmapped rather than pretending to have reviewed semantic authority.

The migration is complete when the reviewed corpus covers every atom in `requirements.ts`, production compilation succeeds with completeness checking enabled, and the normal generation service always receives the compiled semantic provider. At that point the legacy semantic path can be removed instead of kept as a silent fallback.
