# Interpretation corpus and worldview-neutral generation

## Production invariant

No interpretation produced by Astrology may assume, assert or imply that the chart owner follows a religion or accepts souls, karma, reincarnation, fate, predestination, supernatural agency, divine intention or a purposeful universe.

This is a production invariant, not a prose preference. It applies to source ingestion, corpus compilation, LLM generation, corrective generation, deterministic reconstruction, recovery/canonicalisation and final chart assembly.

Technical astrological proper nouns such as **Part of Spirit** may remain as names. Their semantic claims must still be entirely worldview-neutral.

Astrology also remains agnostic about the truth status of astrology itself. User-facing prose describes symbolic associations and tendencies. It does not claim that a placement literally causes a personality trait, relationship or event.

## Three source roles

Sources are approved at **document level**, never by domain.

- **Calculation** sources support deterministic astronomy and geometry. They cannot contribute psychological interpretation claims.
- **Semantic** sources may contribute interpretation claims only after explicit document/section approval and passage-level worldview screening.
- **Architecture** sources may inform compiler or composition design. They cannot contribute interpretation meaning.

A source can be useful in one role and prohibited in another. Sharing a publisher, website or domain does not transfer approval.

## Source-ingestion firewall

The intended offline pipeline is:

```text
approved document and section
        |
        v
deterministic worldview scan
        |
        +-- obvious worldview assumption --> DROP PASSAGE
        |
        v
independent LLM worldview classifier
        |
        +-- unsafe / ambiguous / low confidence --> DROP OR MANUAL REVIEW
        |
        v
atomic claim extraction
        |
        v
claim-level neutrality audit
        |
        v
semantic normalisation and reconciliation
        |
        v
project review
        |
        v
compiled corpus
```

A contaminated passage is never sent to a distiller with instructions to "remove the religion" or "make it secular". It is rejected as semantic input.

## Atomic ontology

The corpus distinguishes:

- **entity**: what is acting, such as the Moon or Uranus
- **domain**: where something is expressed, such as a house or life domain
- **style**: how something is expressed, such as a zodiac sign
- **relation**: how principles interact, such as a conjunction or square
- **condition**: a modifier such as dignity or rulership condition
- **derived construct**: a calculated composite such as a T-square or lunar phase

Machine calculation variants are metadata, not meaning. For example:

```text
north_node_mean
        |
        +--> semantic atom: point.north-node
        +--> calculationVariant: mean
```

The word `mean` is not allowed to acquire a psychological interpretation simply because it appears in an identifier.

## Composition instead of cookbook combinations

A specific aspect is decomposed into reusable atoms and operators:

```text
north_node_mean conjunct uranus
        |
        v
point.north-node
+ aspect.conjunction
+ body.uranus
+ deterministic chart evidence
        |
        v
InterpretationMap
```

There is no requirement for a canonical essay named `north_node_mean_conjunct_uranus`. The semantic compiler composes approved atomic claims.

## InterpretationMap

`InterpretationMap` is the contract shared by generation and deterministic reconstruction. It contains:

- human-facing subject/domain labels
- deterministic chart evidence references
- semantic propositions grouped by role
- corpus atom and claim provenance
- an explicit `worldview: "agnostic"` marker
- forbidden claims that the writer must not infer

The map is validated before it can be used for generation.

## Two language layers

Astrology deliberately has **two language layers**.

### Semantic register

The semantic register is private compiler input. It answers **what may be claimed**.

It contains atomic meanings, proposition text, provenance and internal semantic structure. It is not a writing sample and it has no authority over cadence, tone or user-facing wording.

### Interpretive voice

The interpretive voice answers **how supported meaning is expressed**.

It is:

- direct and second-person
- human-first rather than catalogue-first
- calm, precise and emotionally literate
- non-theatrical and non-mystical
- probabilistic and symbolic rather than causal or fatalistic
- non-characterful: there is no named astrologer, oracle or narrator speaking in first person

The model must render supported meaning afresh. It must not imitate a source author or copy corpus propositions as prose merely because those words are present in semantic input.

## Relationship to tarot-core

`Online-Arcana/tarot-core` is an architectural reference for structured prompt serialisation and voice ownership. Tarot has narrator/reader voice boundaries. Astrology adapts the same class of control to a different problem:

```text
Tarot:
private controls / narrative palette / factual input
narrator voice != reader voice

Astrology:
private controls / interpretive voice / semantic input / chart evidence
semantic register != interpretive voice
```

Tarot character profiles, tarot symbolism and tarot prose are not imported into Astrology.

## Runtime audit sequence

The target runtime is:

```text
deterministic chart
        |
        v
unit decomposition
        |
        v
agnostic atomic corpus
        |
        v
InterpretationMap
        |
        v
structured LLM writer
        |
        v
specificity / grounding / field / voice audits
        |
        v
deterministic worldview audit
        |
        +-- ambiguous --> cheap worldview discriminator
        |
        +-- rejected --> corrective generation
        |
        +-- still rejected --> semantic deterministic reconstruction
        |
        v
final whole-chart worldview audit
        |
        v
chart
```

The cheap discriminator is a classifier only. It does not rewrite prose.

## Deterministic reconstruction

Deterministic fallback must ultimately consume the same `InterpretationMap` as the LLM writer. Generic fallback prose is transitional architecture, not the desired semantic source of truth.

No fallback receives a neutrality exemption. Candidate LLM prose that is non-neutral or ambiguous is not reused during reconstruction.

## Corpus completeness

Production compilation is fail-closed. Every atom required by the interpretation plan must exist, be approved, carry semantic provenance and own at least one validated claim.

Review tooling may compile a deliberately partial corpus for development, but a partial corpus cannot be promoted to production merely to avoid missing fields.

If neutral source support for a semantic facet does not exist yet, leave it absent and keep the production corpus incomplete until it is reviewed. Do not invent meaning to satisfy coverage.
