# Calculation service

`CalculationService` assembles the complete deterministic `astral-calculation/1.0.0` object. Its dependencies are injectable, so tests and non-network runtimes can supply place, civil-time, astronomy, lunar-orbit and eclipse providers without changing calculation rules.

## Pipeline

For one birth input, the service:

1. resolves the selected stable place ID
2. resolves civil time or a bounded local-date interval
3. calculates the astronomy frame and planetary state
4. calculates angles, houses, sect and lots when birth time permits
5. calculates lunar nodes and apogees
6. builds separate tropical and selected sidereal point maps
7. detects longitude and declination aspects
8. detects structural aspect patterns
9. calculates lunar phase and eclipses
10. derives rulers, dispositors, receptions, balances, dominance and Jones pattern
11. calculates all twelve compatibility domains in both zodiac systems
12. builds the fixed interpretation plan
13. records warnings and provenance
14. hashes the deterministic calculation body into its calculation fingerprint

The service does not invoke an LLM.

## Time accuracy

An exact supplied time produces exact timed fields.

An approximate supplied time preserves the supplied instant but marks angles, house cusps, sect, lots and dependent point placements as approximate.

An unknown time resolves the complete local civil date from local midnight to the following local midnight. The midpoint supplies representative planetary, node and apogee values marked `bounded`. Planetary motion is retained only when its classification remains the same at both interval boundaries.

Unknown or unresolved time never produces an Ascendant, Descendant, Midheaven, Imum Coeli, Vertex, Antivertex, East Point, house cusps, sect or lots. Those fixed fields remain present as unavailable values with a reason.

A nonexistent civil time or an unsupported civil-date range cannot produce a complete calculation and raises `CalculationUnavailableError` with the exact calculation reason.

## Interpretation plan

`buildInterpretationPlan` creates a deterministic ordered list of interpretation units. Units are separate for:

- every point
- every house
- every detected aspect and pattern
- each lunar and eclipse field
- each derived and life field
- every compatibility domain overview
- every sign inside every compatibility domain
- cross-system synthesis
- final synthesis

Every unit carries a fixed set of permitted JSON references. The interpretation runtime must pass only those references to that field and must not combine multiple schema fields into one LLM request.

## Fingerprint

The calculation fingerprint is SHA-256 over canonical RFC 8785 JSON containing the full deterministic calculation body, including settings, systems, compatibility, warnings and interpretation plan. The generation timestamp and provenance wrapper are excluded, so repeated calculations with identical input, settings and provider output retain the same fingerprint.

The stored representation is `sha256:<lowercase hex>`.

## Provenance

Provenance records:

- astrology version
- pinned astronomy, place and time provider revisions
- timezone database version and supported range
- calculation, aspect, dignity and compatibility profiles
- deterministic calculation fingerprint

`generatedAt` is operational provenance only and does not alter the fingerprint.
