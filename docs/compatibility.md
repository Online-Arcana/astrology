# Compatibility

`western_compatibility/1.0.0` calculates natal-to-sign-archetype compatibility. It does not invent a second person or simulate synastry. Every domain ranks all twelve signs from the completed natal chart before interpretation.

## Domains

The fixed domains are:

- overall
- romantic
- sexual
- emotional
- communication
- intellectual
- friendship
- business
- domestic
- long-term
- conflict resolution
- spiritual

Romantic and sexual compatibility are separate catalogues with different points, weights and relation values.

## Sign relations

Each candidate sign is compared with the sign occupied by every configured natal point. Whole-sign distance produces one of seven deterministic relations:

- conjunction: zero signs apart
- semisextile: one sign apart
- sextile: two signs apart
- square: three signs apart
- trine: four signs apart
- quincunx: five signs apart
- opposition: six signs apart

Every domain assigns its own value from zero through one to each relation. This allows, for example, an opposition to score more strongly for sexual attraction than for domestic ease without changing the underlying chart fact.

## Domain evidence

Each domain has an explicit weighted point list. Examples include Venus and the Moon for romance, Mars and Venus for sexuality, Mercury for communication, Saturn and Jupiter for business, the Moon and Imum Coeli for domestic compatibility, and Jupiter and Neptune for spiritual compatibility.

The candidate sign's traditional ruler adds a separate resonance factor based on that ruler's natal sign. Scorpio, Aquarius and Pisces may also receive a lower-weight modern co-ruler factor. Modern co-rulership never replaces the traditional ruler.

Every factor retains:

- a stable factor ID
- a versioned rule ID
- its weight
- its zero-through-one relation value
- its contribution to the final score
- the exact JSON reference to the natal point position

Factor contributions sum to the unrounded weighted score, subject only to six-decimal storage rounding.

## Scores and ranks

The score is the weighted mean of all available factors multiplied by 100. Scores are clamped to zero through 100 by the shared ranking boundary.

All twelve signs must appear exactly once. Ties are resolved by the fixed Aries-through-Pisces sign order. Ranks are always 1 through 12.

The fixed bands are:

- 67 through 100: high, compatible
- 34 through 66: medium, neutral
- 0 through 33: low, incompatible

These labels describe the selected domain only. A sign can be high for sexual compatibility and medium or low for long-term or domestic compatibility.

## Unknown birth time

Unavailable time-dependent points, such as the Ascendant, Midheaven or Imum Coeli, are omitted. Remaining weights are renormalised, so every domain still returns a complete twelve-sign ranking without inventing timed placements.

## Tropical and sidereal

Tropical and sidereal matrices are calculated independently from their respective point maps. The sidereal matrix therefore reflects the selected ayanamsha and is not a shifted label applied to tropical results.

The LLM receives the completed scores, ranks, factors and source references. It may interpret them, but it cannot alter any value or ranking.
