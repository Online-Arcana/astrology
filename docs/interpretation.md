# Interpretation orchestration

`kitty-crow/openai-schema` is the sole structured OpenAI runtime. Deterministic code owns the calculation, interpretation plan, schemas, permitted references, audits, recovery and final assembly.

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

The refined rules additionally require user-facing prose to:

- speak directly to the person using `you` and `your`
- lead with human meaning rather than a placement catalogue
- use technical astrology only as supporting evidence
- keep each property concise, complete and semantically distinct
- avoid repeated conclusions and repeated chart evidence
- keep local JSON paths exclusively in `sourceRefs`

The local audit checks style, semantic role, completeness, references, duplication and deterministic support across every narrative field.

## Bounded generation

Generation starts with a serial foundation of at most `ASTRAL_FOUNDATION_UNITS`, normally ten. Foundational units are accepted and checkpointed individually.

The accepted foundation becomes a canonical snapshot with a revision, calculation fingerprint, accepted order and SHA-256 identity. The snapshot is uploaded once per wave as OpenAI `user_data` and attached directly as `input_file` context.

Each wave creates up to `ASTRAL_LANE_COUNT` fresh conversations, normally four. Each lane receives up to `ASTRAL_LANE_UNITS`, normally ten, and processes its units sequentially. At most one request per lane is active, so four lanes mean at most four concurrent interpretation requests, not forty.

A unit may depend only on the shared base snapshot or an earlier unit in the same lane. The planner balances dependencies and expected token cost while respecting `ASTRAL_LANE_CONTEXT_TOKENS`.

## Acceptance and assembly

Each unit passes strict parsing and the complete local audit before its lane continues. Rejected drafts never become context for later units.

Accepted lane results are staged behind a wave barrier. Lane and cross-lane checks detect repeated prose and contradictory conclusions. Only affected units are repaired. Once the full wave passes, results are sorted into canonical plan order, assembled atomically and written into a new snapshot revision.

Previous lane conversations are then retired. The next wave creates fresh conversations from the new snapshot.

## Truncation condensation

Prompts require concise, complete schemas and reserve output space for later properties. A rare truncated or malformed response is not accepted directly and does not immediately fail the lane.

The inexpensive model receives the partial candidate, strict schema, deterministic input, permitted references, accepted snapshot and lane context. It returns a concise replacement object from the beginning rather than appending text. The replacement must pass every normal audit. A fresh primary-model generation occurs only when condensation cannot produce a valid result.

## Rate limits and failures

The shared limiter bounds concurrency, applies exponential backoff with jitter, honours server retry timing and reduces effective concurrency after throttling. Successful sibling work remains staged while one lane retries.

Failures are classified as transport, rate limit, timeout, truncation, schema, audit or coherence failures. A paused job retains accepted and staged work for recovery.

## OpenAI file lifecycle

The local snapshot is authoritative. The uploaded file is disposable transport. Recovery verifies the local snapshot identity and uploads it again rather than trusting a stale remote file ID. Superseded remote files may be deleted through the schema client.

## Models and budgets

Leaf fields normally use `OPENAI_SMALL_MODEL`. Broad life areas, overviews and syntheses use `OPENAI_BIG_MODEL`. Retry escalation, reasoning effort and field token ceilings remain bounded by `OPENAI_MAX_OUTPUT_TOKENS`.

Actual progress is based on accepted weighted units, never calls made, retries, token spend or elapsed time.

## Diagnostics

`RunHooks` can receive start, retry, rejected candidate, completion, checkpoint, wave and structured diagnostic events. Diagnostics include unit, attempt, model, configured output allowance, audit failures, repair provenance, snapshot identity, wave, lane and failure category. Rejected raw candidates remain diagnostic data and never enter the chart.
