# CLI and JSON API

The CLI and HTTP API are thin adapters over the same `CalculationService`. They do not contain astrology, scoring or interpretation logic.

## Calculation request

Both interfaces accept the same JSON request:

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

Calculate from stdin to stdout:

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

Browse place data:

```sh
astral-charts places continents
astral-charts places countries --continent Europe
astral-charts places regions --country GB
astral-charts places cities --country GB --region SCT --query Peterhead
astral-charts places get --id csc:GB:SCT:100
```

Start the JSON server:

```sh
astral-charts serve --host 127.0.0.1 --port 8787
```

The default host is `127.0.0.1`. Exposing the server on another interface is an explicit operator decision.

## HTTP API

### Health

`GET /health`

### Place hierarchy

- `GET /v1/places/continents`
- `GET /v1/places/countries?continent=Europe`
- `GET /v1/places/regions?country=GB`
- `GET /v1/places/cities?country=GB&region=SCT&q=Peterhead`
- `GET /v1/places/place?id=csc%3AGB%3ASCT%3A100`

### Calculation

`POST /v1/calculations`

The content type must be `application/json`. The default body limit is 1 MiB.

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

- 400 for invalid request or calculation input
- 404 for unknown routes or place records
- 405 for unsupported methods
- 413 for request bodies above the configured limit
- 415 for a JSON endpoint without JSON content type
- 422 when civil-time or calculation support cannot construct a chart
- 500 for an unexpected provider or runtime failure

The CLI writes JSON results to stdout or the selected output file. Errors go to stderr and set a non-zero exit code.
