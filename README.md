# astrology

Library for astrology calculations, chart geometry, and interpretation.

The library keeps calculation and interpretation separate. Planetary positions, houses, angles, aspects, dignities, derived points, chart patterns, compatibility scores and ranks are calculated in code. [`kitty-crow/openai-schema`](https://github.com/kitty-crow/openai-schema) fills fixed interpretation fields in one conversation and cannot alter calculation results or output structure.

## Current capabilities

- tropical and sidereal chart calculation with explicit ayanamsha
- luminaries, planets, lunar nodes, angles, houses, aspects, dignities, derived points and chart patterns
- exact, approximate and unknown-time handling without invented geometry
- compatibility analysis with deterministic scores and ranks
- strict field-by-field interpretation with deterministic NLP audit, retries and resumable generation
- canonical RFC 8785 `.astral` files with SHA-256, CRC-32C and optional Ed25519 authority
- TypeScript API, CLI and localhost JSON API; no browser UI

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

`generate` requires `OPENAI_API_KEY`. Calculation, place lookup and file validation do not. See [`.env.example`](.env.example) for configuration.

## Documentation

[Read the documentation](docs/README.md).
