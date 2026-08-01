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
- deterministic zodiac, lunar-phase and compatibility primitives
- field-by-field local NLP audit with safe mechanical repair
- bounded one-conversation interpretation orchestration with narrow retries

The remaining eclipse and full compatibility catalogues are implemented in subsequent milestones against these contracts.

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

The finished project exposes CLI commands and a JSON API only. It contains no HTML, CSS, forms or browser application.

See `docs/format.md`, `docs/time.md`, `docs/calculation.md`, `docs/houses.md`, `docs/points.md`, `docs/dignity.md`, `docs/derived.md`, `docs/aspects.md`, `docs/astrology.md`, `docs/audit.md` and `docs/interpretation.md`.
