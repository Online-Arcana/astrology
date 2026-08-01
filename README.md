# astral-charts

Deterministic natal astrology calculation, bounded structured interpretation and portable `.astral` files.

The defining boundary is simple: deterministic code constructs the chart; the LLM interprets predefined fields. It never calculates placements, chooses sections, changes compatibility scores or alters availability.

## Status

The implementation branch establishes:

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
- field-by-field local NLP audit with safe mechanical repair
- strict interpreted-chart assembly from the fixed plan
- canonical `.astral` encoding with optional Ed25519 authority
- independent structure, integrity and trust validation
- `kitty-crow/openai-schema` as the sole OpenAI Conversations and Responses runtime
- one isolated OpenAI conversation per chart
- all substantive fields on the big model and only generated-name utilities on the small model
- recursive audit and narrow correction of each specialised interpretation field
- complete calculation-to-interpretation-to-`.astral` generation service
- CLI commands for calculation, interpreted generation, validation and hierarchical place lookup
- localhost-by-default JSON routes for calculation, generation, validation and place lookup
- deterministic interfaces that remain usable without an OpenAI key

Version `0.14.0` is the first complete implementation candidate against the fixed contracts. CI performs no live OpenAI request; final operational acceptance still requires an explicitly authorised real-key generation test outside the ordinary suite.

## Development

```sh
git submodule update --init --recursive
npm run vendor:build
npm install
npm run ci
```

`vendor:build` compiles every pinned submodule, including `openai-schema`, before the root package resolves its local file dependencies. Ordinary tests use fake clients or injected `fetch` implementations and make no real OpenAI request.

Configuration is documented in `.env.example`. Secrets, conversation IDs and private signing keys are never written to `.astral` files.

## Interfaces

The project exposes CLI commands and a JSON API only. It contains no HTML, CSS, forms or browser application.

See `docs/format.md`, `docs/time.md`, `docs/calculation.md`, `docs/service.md`, `docs/interfaces.md`, `docs/chart-files.md`, `docs/houses.md`, `docs/points.md`, `docs/dignity.md`, `docs/derived.md`, `docs/aspects.md`, `docs/eclipses.md`, `docs/compatibility.md`, `docs/astrology.md`, `docs/audit.md` and `docs/interpretation.md`.
