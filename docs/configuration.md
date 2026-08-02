# Configuration

## Chart basis

`ASTRAL_PRIMARY_ZODIAC` accepts `tropical` or `sidereal` and defaults to `tropical`.

`ASTRAL_INTERPRETATION_MODE` must select the same zodiac. `both` is unsupported. A second system requires a separate chart.

`ASTRAL_SIDEREAL_AYANAMSHA` defaults to `lahiri`. It is used only by sidereal charts. Selecting another ayanamsha creates a different immutable chart basis.

## Models

- `OPENAI_API_KEY`: required only for interpreted chart generation
- `OPENAI_BIG_MODEL`: broad fields and syntheses
- `OPENAI_SMALL_MODEL`: leaf fields, utilities and truncation condensation
- `OPENAI_REASONING`: `none`, `low`, `medium` or `high`
- `OPENAI_MAX_OUTPUT_TOKENS`: global upper bound for routed field budgets
- `ASTRAL_MAX_RETRIES`: maximum attempts per interpretation unit

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
