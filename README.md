# astrology

Headless composition package for Online Arcana astrology.

This repository owns the public API and CLI, chart generation orchestration, `.astral` document integrity/signing, and composition of the deterministic core, interpretation engine and packager.

Deterministic calculation and browser-safe place data live in `astral-core`. Interpretation, auditing and OpenAI orchestration live in `astral-interpreter`. Browser UI lives in `astral-charts`. Identicon rendering lives in `astral-identicons`.

## Development

```sh
git submodule update --init --recursive
npm run vendor:build
npm ci
npm run check
npm test
npm run build
```
