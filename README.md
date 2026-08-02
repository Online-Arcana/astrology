# astrology

Deterministic natal astrology with bounded structured interpretation and portable `.astral` files.

Chart facts are calculated in TypeScript. [`kitty-crow/openai-schema`](https://github.com/kitty-crow/openai-schema) interprets fixed fields in one conversation; it never calculates placements, houses, availability, compatibility scores or ranks.

## Features

- tropical and sidereal natal calculation
- exact, approximate and unknown-time handling without invented geometry
- strict field-by-field interpretation with deterministic NLP audit
- canonical RFC 8785 files with hashes, CRC-32C and optional Ed25519 authority
- CLI and localhost JSON API; no browser UI

## Build

```sh
git clone --recurse-submodules https://github.com/kitty-crow/astral-charts.git astrology
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
