# astrology

Library for astrology calculations, chart geometry, and interpretation.

Calculations are deterministic. LLMs fill fixed interpretation schemas and cannot alter placements, availability, rankings, scores or file structure.

## Current capabilities

- one immutable zodiac system per chart, tropical by default
- separate sidereal charts with one immutable ayanamsha, Lahiri by default
- planets, angles, houses, aspects, dignities, derived points, eclipses and chart patterns
- exact, approximate and unknown-time handling without invented geometry
- deterministic compatibility scores and ranks
- human-first field interpretation with local semantic, style, reference, completion and duplicate audits
- bounded recovery-safe generation using a serial foundation followed by four lanes of up to ten interpretations each
- canonical RFC 8785 `.astral` files with SHA-256, CRC-32C and optional Ed25519 authority
- TypeScript API, CLI and localhost JSON API

## Build

```sh
git clone --recurse-submodules https://github.com/kitty-crow/astrology.git
cd astrology
npm run vendor:build
npm install
npm run ci
npm run build
```

## Use

```sh
astrology calculate < request.json > calculation.json
astrology generate --input request.json --output chart.astral
astrology validate --input chart.astral
```

`generate` requires `OPENAI_API_KEY`. Calculation, place lookup and file validation do not. Configuration is listed in [`.env.example`](.env.example).

## Documentation

[Read the documentation](docs/README.md).
