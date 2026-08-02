# Temporary job recovery

Long interpretation runs can be detached from a browser or interrupted after some fields have already passed audit. Temporary job recovery preserves enough trusted local state to continue without discarding accepted work or opening another OpenAI conversation.

## Recovery ID

Each recoverable job receives eight lowercase hexadecimal characters, for example `7ac91e2f`.

The ID is cryptographically random. It is not derived from the subject, chart fingerprint or OpenAI conversation ID, so it does not expose chart information.

The ID exists only while recovery is useful:

- queued, running, failed or interrupted jobs retain it until the configured job TTL expires
- successful completion deletes the recovery record immediately
- completed charts are returned through the normal result path and are not retained under a recovery ID

## Stored state

`TemporaryJobStore` writes one private JSON record per ID. A record contains:

- the temporary ID
- current `ChartProgress`
- the immutable OpenAI conversation ID once established
- caller-owned recovery state
- creation, update and expiry timestamps

For chart generation, `ChartGenerationCheckpoint` supplies the caller-owned state:

- runtime version
- deterministic calculation and its fingerprint
- every accepted interpretation unit
- aggregate call and retry counts
- the active unit, attempt and narrow audit correction when applicable

Files are created with owner-only permissions and updates use a temporary file followed by an atomic rename.

## Resume rules

`ChartGenerationService.resume(...)` requires the same runtime version and verifies the stored calculation fingerprint. Interpretation recovery then:

1. verifies that accepted units form the completed prefix of the fixed plan
2. re-audits every accepted unit locally
3. restores cross-field duplicate context in original order
4. reopens the exact stored OpenAI conversation
5. resumes the active attempt or the first unfinished field
6. emits a new checkpoint before and after remote calls and after accepted fields

Accepted fields are never sent back to the model merely because the browser disconnected or the host restarted.

## Completion lifecycle

The host should save each emitted generation checkpoint together with the latest progress snapshot. When final assembly succeeds, it returns the chart to the caller and saves `status: completed`; `TemporaryJobStore.save(...)` responds by deleting the ID and its file.

Failures remain resumable until their TTL expires. Expired or corrupt records are removed during lookup or `sweep()`.

## Browser clients

A browser should retain the eight-character ID while a job is active. Losing an SSE connection is not job failure. The client can reconnect, fetch the persisted progress and either reattach to the active process or request a resume if the host restarted.
