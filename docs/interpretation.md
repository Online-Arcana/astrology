# Interpretation orchestration

`kitty-crow/openai-schema` is the sole structured OpenAI runtime. Deterministic code owns the calculation, interpretation plan, schemas, permitted references, audits, recovery, reconstruction and final assembly.

## Chart basis

A chart has one immutable zodiac basis.

- omitted zodiac means tropical
- sidereal must be selected when the chart is created
- omitted sidereal ayanamsha means Lahiri
- another zodiac or ayanamsha requires another chart
- prompts, source references, snapshots and synthesis are restricted to the selected basis

New charts never generate tropical and sidereal interpretations together and never run cross-system reconciliation.

## Existing and refined instructions

The established rules remain cumulative: strict schema only, every required field present, no reasoning or process narration, no AI or prompt references, no disclaimers, no unsupported calculation, exact permitted references and no merged interpretation fields.

User-facing prose must:

- speak directly to the person using `you` and `your`
- lead with human meaning rather than a placement catalogue
- use technical astrology only as supporting evidence
- keep each property concise, complete and semantically distinct
- avoid repeated conclusions and repeated chart evidence
- keep local JSON paths exclusively in `sourceRefs`

The local audit checks style, semantic role, completeness, references, duplication and deterministic support across every narrative field.

## Paid model lanes

The model IDs are configurable defaults rather than orchestration assumptions.

Short outputs use:

```text
gpt-5-nano -> deterministic NLP audit -> gpt-5.6-luna -> deterministic NLP audit
```

Long interpretations use:

```text
gpt-5.6-luna -> deterministic NLP audit -> gpt-5.6-luna with audit corrections -> deterministic NLP audit
```

The second long-output call intentionally uses Luna again. It receives the first candidate's deterministic audit findings and performs a constrained correction pass rather than repeating the original request unchanged.

A candidate is never accepted merely because it parsed. Entry and escalation results both pass through the same deterministic audit. A unit makes at most two paid calls.

## Deterministic reconstruction

When the escalation result still fails, no further model is called. Reconstruction:

1. preserves usable fields from the entry and escalation candidates
2. removes process narration, internal references, duplicate fragments and incomplete endings
3. restores permitted `sourceRefs` and required schema values
4. replaces only fields identified as missing, malformed or still rejected
5. uses [`fallbacks.xml`](../src/llm/reconstruct/fallbacks.xml) only when a field cannot be recovered unambiguously
6. audits the reconstructed object again

The XML catalogue contains field-specific natural wording for ordinary sections, romance, sexuality, career, money, system synthesis, compatibility, final synthesis and generated names. It is the last net for individual fields, not a replacement for an otherwise usable interpretation.

Production mode always returns a structurally complete unit. Remaining audit concerns are retained in provenance for diagnostics. Core and CLI users may opt into throwing with `ASTRAL_DEBUG_THROW_ON_INTERPRETATION_FAILURE=true`; the browser-facing runtime never enables it.

## Bounded generation

Generation starts with a serial foundation of at most `ASTRAL_FOUNDATION_UNITS`, normally ten. Foundational units are accepted and checkpointed individually.

The accepted foundation becomes a canonical snapshot with a revision, calculation fingerprint, accepted order and SHA-256 identity. Each wave creates up to `ASTRAL_LANE_COUNT` fresh conversations, normally four. Each lane receives up to `ASTRAL_LANE_UNITS`, normally ten, and processes its units sequentially.

A unit may depend only on the shared base snapshot or an earlier unit in the same lane. The planner balances dependencies and expected token cost while respecting `ASTRAL_LANE_CONTEXT_TOKENS`.

## Acceptance, coherence and assembly

Accepted lane results are staged behind a wave barrier. Lane and cross-lane checks detect repeated prose and contradictory conclusions. Coherence corrections use deterministic reconstruction rather than starting another paid generation journey.

In production, unresolved coherence concerns remain diagnostic and do not abort chart delivery. Debug mode may throw to expose them during development.

## Rate limits and transport failures

The shared limiter bounds concurrency, applies exponential backoff with jitter, honours server retry timing and reduces effective concurrency after throttling.

Transport, rate-limit, timeout, truncation, schema and audit failures all follow the same bounded policy: advance from entry to escalation, then reconstruct locally. If an unexpected orchestration error escapes a unit, production performs an emergency deterministic assembly for the full plan instead of leaving the customer without a result.

## Diagnostics

`RunHooks` can receive start, retry, rejected candidate, deterministic repair, completion, checkpoint, wave and structured diagnostic events. Unit provenance records deterministic repair type, XML-backed fields and any remaining audit warnings.
