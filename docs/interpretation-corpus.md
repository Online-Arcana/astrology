# Interpretation semantics

The interpretation code has two separate jobs: decide what an interpretation is allowed to say, then turn that meaning into readable prose. Keeping those jobs separate makes the output easier to audit and keeps source wording, internal identifiers and model habits out of the final text.

The semantic side is built from a reviewed corpus. The writing side receives a prepared interpretation map and renders it in the application's normal voice. The writer is not expected to supply missing astrology knowledge from its own training.

## Corpus data

The corpus is authored as XML under `src/interpretation/corpus/data/xml/`. These XML files are the source of truth for interpretation knowledge.

The files are grouped by the kind of material they contain:

- `sources.xml` contains the reviewed source manifest and the exact section IDs approved for use;
- `bodies.xml`, `points.xml`, `angles.xml`, `signs.xml`, `houses.xml` and `aspects.xml` contain the main reusable astrological concepts;
- `patterns.xml`, `conditions.xml`, `derived.xml` and `eclipses.xml` contain calculated or composed concepts;
- `domains.xml` contains application-owned output domains such as work, relationships and compatibility.

Each corpus document contains atoms and claims. An atom is a reusable concept such as the Sun, Capricorn, House 4 or a square. A claim is a small semantic statement attached to an atom. Claims carry tags, confidence, worldview-neutrality markers and references to approved source sections. Atoms also record internal calculation IDs, related atoms and things that must not be inferred from the concept.

The XML is deliberately plain. It contains data and metadata, not executable rules. Composition and selection logic stays in TypeScript.

`src/interpretation/corpus/xml.ts` parses and validates the XML into the existing `CorpusSource`, `CorpusAtom` and `CorpusClaim` runtime types. It rejects malformed structure, unsupported enum values, non-neutral claim markers, DTDs and entity declarations. The normal corpus compiler then performs the semantic, provenance, completeness and worldview checks it performed before the XML migration.

Browser code cannot read repository files directly, so `npm run corpus:embed` generates an ignored `xml.generated.ts` module containing only the raw XML strings. Both Node and browser builds pass those strings through the same XML parser. The generated module is transport only; it is not another editable corpus.

Sources are approved per document and per section, not per website. A technical astronomy document can be approved for calculation work without making interpretation pages from the same publisher valid semantic sources. A claim must name an approved section of an approved semantic source; citing the document alone is not sufficient.

Production compilation uses the complete required atom list in `requirements.ts` and fails if anything is missing.

## Meaning and calculation data

Calculation identifiers are normalised before they reach the corpus. Details that affect how a value was calculated stay as metadata unless they also have an approved semantic meaning.

For example, mean and true lunar nodes resolve to the same semantic node concept while retaining their calculation variant separately. Zodiac system names, calculation variants and JSON paths are not interpretation vocabulary by themselves.

Larger units are composed from reusable atoms. A point placement can contain the point, its sign and its house. An aspect contains its two endpoints and an aspect relation. House units can include the house domain, cusp sign, rulers, occupants and intercepted signs where those calculations are available. Life-domain recipes select relevant chart factors from the same corpus instead of looking up a pre-written essay for every combination.

## Interpretation maps

`InterpretationMap` is the hand-off between semantic compilation and prose generation. It contains the subject of the unit, chart-specific semantic composition, permitted chart evidence, approved propositions, corpus provenance and concepts that must not be inferred.

Both model-written prose and deterministic reconstruction use this map. Losing access to the model must not switch the application to a different interpretation system.

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

Contaminated passages are not "cleaned up" and then admitted. Approval can be limited to a small neutral section of a document while the rest of the document remains excluded.

Calculation and architecture references are kept separate from semantic sources. They may support astronomy, geometry or compiler design, but they cannot be used as provenance for interpretation claims unless the specific document and section have also been approved for semantic use.

## Runtime

The XML corpus is parsed and compiled once with completeness checking enabled when the built-in semantic provider is loaded. Browser generation and the API/server runtime use that provider by default. Low-level service construction still accepts an explicit provider so tests and specialised tooling can supply controlled maps.

Before paid generation starts, the service prepares and validates the semantic maps required by the chart's interpretation plan. If a required map cannot be produced, generation fails before opening the model conversation.

Each model call receives semantic input, deterministic chart evidence and writing instructions as separate fields. Raw chart evidence can contain fields that a particular recipe did not select; those fields are not permission to invent additional astrological meaning. Output is checked for schema validity, grounding, field duplication, voice problems and worldview neutrality. Rejected output goes through the normal correction/escalation path.

If generation still fails, deterministic reconstruction uses the same interpretation map and application-owned sentence templates. The older XML fallback catalogue used by legacy/unmapped compatibility code is separate from this corpus and is not the semantic authority for normal browser or API generation.


## Delivery invariant

Interpretation delivery is fail-soft in production. Corpus, semantic-map, model, audit, correction or reconstruction failures must not leave a requested interpretation empty and must not abort customer delivery. A corpus-backed field first falls back through deterministic semantic reconstruction; if semantic authority itself is unavailable, the engine uses the neutral generic fallback catalogue to produce a schema-complete written interpretation. Units with no usable deterministic source also receive generic written prose with no invented source references. Explicit debug mode may still throw so failures remain testable during development.
