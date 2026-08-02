# Temporary job recovery

Interrupted generation preserves accepted and staged work locally so a restart does not repeat successful interpretations.

## Recovery ID

Each recoverable job receives eight random lowercase hexadecimal characters. The ID is unrelated to the subject, chart fingerprint or OpenAI identifiers.

Recovery records remain until completion or the configured TTL. Completion deletes the temporary record immediately.

## Authoritative state

`ChartGenerationCheckpoint` stores:

- runtime and recovery schema versions
- immutable selected zodiac and ayanamsha
- deterministic calculation and fingerprint
- accepted interpretation units and canonical order
- local canonical snapshot text, revision and SHA-256 identity
- aggregate calls and retries
- active foundation unit when applicable
- current wave, lane assignments and per-lane positions
- accepted staged results
- active attempt, correction and failure category
- wave conflicts and barrier phase

The local snapshot is authoritative. A remote OpenAI file ID is only disposable transport and is cleared during recovery. The verified local snapshot is uploaded again when work resumes.

Temporary records use owner-only permissions and atomic replacement.

## Resume validation

Current recovery requires the same runtime release, calculation fingerprint, selected zodiac and selected ayanamsha. The service rebuilds the snapshot from accepted units and refuses recovery when its SHA-256 identity does not match.

Accepted units and staged units are validated before use. Stale results created against another snapshot revision cannot enter the wave assembly.

A lane resumes only its unfinished unit. Accepted earlier units in that lane and successful sibling lanes remain staged.

## Legacy 0.18 recovery

`astral-generation-recovery/1.0.0` records are migrated explicitly.

The service reconstructs the birth request, recalculates the selected immutable chart basis, preserves accepted units belonging to that system, converts their old system-prefixed source references and discards the unselected zodiac. The active unfinished selected unit is preserved. Migrated accepted units carry internal provenance identifying the source runtime version.

For the existing `a32fb82b` recovery this means preserving accepted tropical work, excluding sidereal work, rebuilding a tropical snapshot and resuming the unfinished sexuality unit under the 0.19 audit and wave runtime.

## Failure and restart behaviour

Transport, rate-limit, timeout, truncation, schema, audit and coherence failures retain their classification. A host restart reuses local accepted and staged results even when the original OpenAI conversation or uploaded file no longer exists.

New conversations are created from the verified snapshot as necessary. No successful unit is regenerated merely because a remote object expired.

## Progress restoration

Progress is rebuilt from accepted and safely staged weighted units. Stored percentages are not trusted. Retries, rejected drafts and truncation repair attempts do not advance completion.

For interpreted charts the deterministic phase accounts for 1%, accepted interpretation work for 98%, and final validation and assembly for 1%.

## Browser clients

A client should retain the eight-character ID while work is active. Losing a connection is not job failure. The client can fetch persisted progress and request resume after a host restart.
