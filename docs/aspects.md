# Aspects and patterns

All aspect and pattern detection is deterministic and versioned. The LLM receives the completed records and may only explain them.

## Ecliptic aspects

`western_aspects/1.0.0` detects the required major and minor aspects from ecliptic longitude. Every record retains the exact angle, actual angle, orb, permitted orb, applying or separating state, class, character, strength and rule references.

When multiple aspect angles could fall inside their allowed orbs, the detector selects the closest proportional fit. It never emits two different ecliptic aspects for the same point pair.

## Declination aspects

`declination_aspects/1.0.0` detects:

- parallel when two points have similar declination in the same celestial hemisphere
- contra-parallel when their absolute declinations are similar in opposite hemispheres

The base orb is one degree. An aspect involving the Sun or Moon permits one and a half degrees. Strength decreases linearly from exact to the configured orb limit.

Declination aspects remain separate from ecliptic longitude aspects and do not replace them.

## Pattern eligibility

`western_patterns/1.0.0` uses planets and luminaries only. Nodes, angles, lots and Lilith may participate in ordinary aspect lists but do not create structural aspect patterns in this profile.

Every pattern record contains the exact participating point IDs and the actual aspect IDs that satisfy the rule. Pattern strength is the mean strength of those required aspects.

## Pattern rules

- stellium: a maximal clique of at least three mutual conjunctions
- T-square: one opposition whose endpoints both square a focal planet
- grand trine: three mutual trines
- grand cross: two oppositions and four squares among four planets
- Yod: a sextile base whose endpoints both quincunx the focal planet
- kite: a grand trine plus an additional planet opposite one trine vertex and sextile the other two
- mystic rectangle: two oppositions, two trines and two sextiles among four planets
- grand sextile: six sextiles, six trines and three oppositions among six planets
- Thor's hammer: a square base whose endpoints both sesquiquadrate the focal planet

Element is reported only when every participating point occupies the same element. Modality is reported only when every participating point occupies the same modality. Otherwise the respective field is `null`.
