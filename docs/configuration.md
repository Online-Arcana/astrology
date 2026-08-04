# Configuration

## Chart basis

`ASTRAL_PRIMARY_ZODIAC` accepts `tropical` or `sidereal` and defaults to `tropical`.

`ASTRAL_INTERPRETATION_MODE` must select the same zodiac. `both` is unsupported. A second system requires a separate chart.

`ASTRAL_SIDEREAL_AYANAMSHA` defaults to `lahiri`. It is used only by sidereal charts. Selecting another ayanamsha creates a different immutable chart basis.

## Models

Each paid lane has one entry model and one escalation model. Every candidate is parsed and audited locally before acceptance. The routing mechanism does not depend on particular model families, so all four roles remain configurable here.

- `OPENAI_SMALL_MODEL`: short-output entry model, default `gpt-5-nano`
- `OPENAI_SMALL_ESCALATION_MODEL`: short-output escalation model, default `gpt-5.6-luna`
- `OPENAI_BIG_MODEL`: long-output entry model, default `gpt-5.6-luna`
- `OPENAI_BIG_ESCALATION_MODEL`: long-output escalation model, default `gpt-5.6-luna`
- `OPENAI_API_KEY`: required only for interpreted chart generation
- `OPENAI_REASONING`: `none`, `low`, `medium` or `high`
- `OPENAI_MAX_OUTPUT_TOKENS`: global upper bound for routed field budgets

Using Luna for both long-output stages is intentional. The second call receives the deterministic NLP findings from the first attempt and is therefore a correction pass even though the model ID is unchanged.

`ASTRAL_MAX_RETRIES` remains a recovery compatibility bound. New generation performs at most two paid attempts per unit: entry and escalation.

## Guaranteed completion and debugging

After an escalation candidate fails its deterministic NLP audit, the unit is reconstructed locally. Valid fields from either candidate are preserved, ambiguous or malformed fields are replaced individually, and the pre-generated XML catalogue is used only for unresolved fields.

`ASTRAL_DEBUG_THROW_ON_INTERPRETATION_FAILURE=true` disables customer-safe completion and throws when deterministic reconstruction would otherwise be used. This is intended only for CLI and core debugging. It defaults to `false`, and the browser runtime fixes it to `false`.

## Bounded orchestration

- `ASTRAL_FOUNDATION_UNITS`: maximum serial foundation size, default `10`
- `ASTRAL_LANE_COUNT`: maximum simultaneous lane conversations, default `4`
- `ASTRAL_LANE_UNITS`: maximum sequential units per lane, default `10`
- `ASTRAL_LANE_CONTEXT_TOKENS`: lane context safety ceiling, default `60000`

Four lanes do not send forty simultaneous requests. Each lane processes one unit at a time, giving a normal maximum request concurrency of four.

## Recovery

`ASTRAL_JOB_TTL_SECONDS` controls how long incomplete temporary jobs remain recoverable. The local checkpoint and canonical snapshot are authoritative. Remote conversation and file identifiers are disposable.

## Signing

Set `ASTRAL_SIGNING_ENABLED=true` together with both Ed25519 keys:

- `ASTRAL_ED25519_PRIVATE_KEY`
- `ASTRAL_ED25519_PUBLIC_KEY`

`ASTRAL_AUTHORITY_ISSUER` identifies the signing authority.

See [`.env.example`](../.env.example) for the complete current list.
