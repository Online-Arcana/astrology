# astral-charts

Deterministic natal astrology calculation, bounded structured interpretation and portable `.astral` files.

The defining boundary is simple: deterministic code constructs the chart; the LLM interprets predefined fields. It never calculates placements, chooses sections, changes compatibility scores or alters availability.

## Status

The implementation branch currently establishes:

- strict fixed public types for calculation, interpretation and file output
- pinned astronomy, schema, place and civil-time submodules
- separate big and small model configuration
- RFC 8785 canonicalisation
- SHA-256, SHA-512 and CRC-32C integrity
- optional Ed25519 authority primitives
- weighted monotonic progress with evidence-based ETA
- historical civil-time resolution with explicit gap and overlap handling
- hierarchical place selection with stable city IDs and IANA zones
- apparent geocentric Sun, Moon and planetary positions through Pluto
- bounded date-only planetary positions without invented timed geometry
- Ascendant, Descendant, Midheaven, Imum Coeli, Vertex, Antivertex and East Point
- Placidus, Whole Sign, Equal and Porphyry houses with explicit polar fallback
- independent tropical and sidereal houses and point maps
- Lahiri, Fagan-Bradley, Krishnamurti and Raman ayanamshas
- mean and osculating lunar nodes and lunar apogees
- day and night sect with sect-correct Lots of Fortune and Spirit
- a fixed 25-point map with house placements and occupants
- traditional domicile, exaltation, debility, triplicity, bounds and faces
- chart rulers, dispositors, mutual receptions and final dispositors
- weighted balances, planetary and sign dominance, retrogrades and unaspected planets
- deterministic Jones chart-pattern classification
- major, minor, parallel and contra-parallel aspect detection
- all nine required structural aspect patterns with exact aspect membership
- global eclipse-at-birth and prenatal solar and lunar event calculation
- tropical and selected sidereal eclipse positions with true-node attribution
- twelve-domain natal-to-sign compatibility matrices for both zodiac systems
- complete twelve-sign ranks with inspectable weighted factors and JSON references
- one injectable end-to-end deterministic calculation service
- stable RFC 8785 and SHA-256 calculation fingerprints
- fixed field-by-field interpretation plans with permitted JSON references
- strict CLI calculation and hierarchical place commands
- localhost-by-default JSON API over the same service
- field-by-field local NLP audit with safe mechanical repair
- bounded one-conversation interpretation orchestration with narrow retries

The deterministic calculation service, CLI and JSON API are complete. Subsequent milestones assemble the final interpreted chart and write, sign and validate `.astral` files.

## Development

```sh
git submodule update --init --recursive
npm install
npm run vendor:build
npm run ci
```

`vendor:build` compiles the pinned submodules used by the concrete runtime adapters. Ordinary calculation and LLM orchestration tests remain injectable and require no network services or OpenAI key.

Configuration is documented in `.env.example`. Secrets are never written to `.astral` files.

## Interfaces

The project exposes CLI commands and a JSON API only. It contains no HTML, CSS, forms or browser application.

See `docs/format.md`, `docs/time.md`, `docs/calculation.md`, `docs/service.md`, `docs/interfaces.md`, `docs/houses.md`, `docs/points.md`, `docs/dignity.md`, `docs/derived.md`, `docs/aspects.md`, `docs/eclipses.md`, `docs/compatibility.md`, `docs/astrology.md`, `docs/audit.md` and `docs/interpretation.md`.
