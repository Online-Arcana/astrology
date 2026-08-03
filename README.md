# astrology

Library for astrology calculations, chart geometry, and interpretation.

Calculations are deterministic. LLMs fill fixed interpretation schemas and cannot alter placements, availability, rankings, scores or file structure.

## Current capabilities

- immutable tropical or sidereal chart systems
- planets, angles, houses, aspects, dignities, derived points, eclipses and patterns
- exact, approximate and unknown-time handling
- deterministic compatibility scores and ranks
- audited, recovery-safe interpretation with bounded parallel lanes
- live token use, estimated cost and historical chart bills
- canonical `.astral` files with integrity checks and optional Ed25519 authority
- customer-formatted and raw file views
- TypeScript API, CLI, JSON API and client-only GitHub Pages frontend

## Build

```sh
git clone --recurse-submodules https://github.com/kitty-crow/astrology.git
cd astrology
npm run vendor:build
npm install
npm run ci
```

Build only the static browser page with:

```sh
npm run build:pages
```

## Use

```sh
astrology calculate < request.json > calculation.json
astrology generate --input request.json --output chart.astral
astrology bills
astrology validate --input chart.astral
```

`generate` requires an OpenAI key. The static page asks the visitor for their own key and keeps browser credentials and chart data locally.

## Documentation

[Read the documentation](docs/README.md), including the [client-only browser frontend](docs/browser.md).
