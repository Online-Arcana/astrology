# CLI and JSON API

The CLI and HTTP API are thin adapters over the same calculation, generation and validation services. They contain no astrology, compatibility scoring, OpenAI transport or file-integrity implementation.

## Chart request

Calculation and interpreted generation accept the same JSON request:

```json
{
  "birth": {
    "date": "1991-06-15",
    "time": "12:30:00",
    "timeAccuracy": "exact",
    "placeId": "csc:GB:SCT:100",
    "name": "Optional name",
    "lang": "en-GB"
  },
  "options": {
    "primaryZodiac": "tropical",
    "ayanamsha": "lahiri",
    "interpretationMode": "both"
  }
}
```

For unknown birth time, `time` must be `null` and `timeAccuracy` must be `unknown`.

Request options are optional. Missing options use environment configuration.

## CLI

After building, the executable is `dist/cli.js` and the package binary is `astral-charts`.

### Deterministic calculation

```sh
astral-charts calculate < request.json > calculation.json
```

Use files and override selected settings:

```sh
astral-charts calculate \
  --input request.json \
  --output calculation.json \
  --primary-zodiac sidereal \
  --ayanamsha raman \
  --interpretation-mode both
```

### Interpreted `.astral` generation

```sh
astral-charts generate \
  --input request.json \
  --output chart.astral
```

`generate` requires `OPENAI_API_KEY`. It writes the final `astral/1.0.0` document rather than a response wrapper.

Output is canonical RFC 8785 JSON by default. Use `--pretty` for indented JSON with a trailing newline:

```sh
astral-charts generate --input request.json --output chart.astral --pretty
```

Presentation whitespace does not alter integrity or authority verification because validation canonicalises the parsed object.

The calculation-setting overrides accepted by `calculate` are also accepted by `generate`.

### File validation

```sh
astral-charts validate --input chart.astral
```

Provide an optional trusted-authority list:

```sh
astral-charts validate \
  --input chart.astral \
  --trusted trusted-authorities.json \
  --output validation.json
```

The trust file may be a JSON array or an object containing a `trustedAuthorities` array. Each item contains `issuer`, `keyId`, `publicKey` and `status`.

`validate` exits non-zero when:

- structure is invalid
- integrity is not valid
- authority is invalid, unknown or revoked

Unsigned and valid-but-untrusted files remain valid results and do not by themselves cause failure.

### Place data

```sh
astral-charts places continents
astral-charts places countries --continent Europe
astral-charts places regions --country GB
astral-charts places cities --country GB --region SCT --query Peterhead
astral-charts places get --id csc:GB:SCT:100
```

### Server

```sh
astral-charts serve --host 127.0.0.1 --port 8787
```

The default host is `127.0.0.1`. Exposing the server on another interface is an explicit operator decision.

The server starts without an OpenAI key. Deterministic calculation, place lookup and file validation remain available; interpreted generation reports that it is not configured.

## HTTP API

All request bodies use `application/json`. The default body limit is 1 MiB.

### Health

`GET /health`

The response includes `interpretedGeneration`, which is true only when the runtime has an OpenAI key and loaded the generation service.

### Place hierarchy

- `GET /v1/places/continents`
- `GET /v1/places/countries?continent=Europe`
- `GET /v1/places/regions?country=GB`
- `GET /v1/places/cities?country=GB&region=SCT&q=Peterhead`
- `GET /v1/places/place?id=csc%3AGB%3ASCT%3A100`

### Deterministic calculation

`POST /v1/calculations`

A successful response is:

```json
{
  "ok": true,
  "calculation": {
    "schema": "astral-calculation/1.0.0"
  }
}
```

The calculation object is complete; the abbreviated example only shows its schema field.

### Interpreted chart generation

`POST /v1/charts`

It accepts the standard chart request and returns:

```json
{
  "ok": true,
  "file": {
    "schema": "astral/1.0.0"
  }
}
```

The file contains the complete deterministic calculation, interpreted chart, integrity record and optional authority.

When `OPENAI_API_KEY` is absent, the endpoint returns status 503 with `generation_not_configured`. No direct OpenAI call exists in the API layer; generation delegates to the chart-generation service, which uses the pinned `openai-schema` runtime.

### File validation

`POST /v1/files/validate`

```json
{
  "file": {},
  "trustedAuthorities": []
}
```

`trustedAuthorities` is optional. Validation returns status 200 even when the supplied file is invalid, because invalidity is the result being requested:

```json
{
  "ok": true,
  "validation": {
    "structure": "valid",
    "integrity": "valid",
    "authority": "unsigned"
  }
}
```

Malformed validation requests return status 400.

## Errors

Every interface error is structured:

```json
{
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "birth.time is required when birth.timeAccuracy is known"
  }
}
```

HTTP status use is:

- 400 for invalid request, calculation input or validation request
- 404 for unknown routes or place records
- 405 for unsupported methods
- 413 for request bodies above the configured limit
- 415 for a JSON endpoint without JSON content type
- 422 when civil-time or calculation support cannot construct a chart
- 502 when interpretation or final chart generation fails
- 503 when interpreted generation is not configured
- 500 for an unexpected deterministic provider or runtime failure

CLI errors go to stderr and set a non-zero exit code. Successful `calculate`, place and validation commands write JSON. Successful `generate` writes the `.astral` document itself.
