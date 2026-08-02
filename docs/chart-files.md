# Interpreted charts and `.astral` files

The final artefact path has three strict boundaries:

1. deterministic calculation
2. source-bounded interpretation
3. canonical file assembly and validation

No later boundary may recalculate or alter an earlier value.

## Chart assembly

`assembleChart` consumes one completed `InterpretationRun` and the exact `InterpretationPlan` stored in the calculation.

The assembler rejects:

- a missing planned unit
- an unexpected unit
- duplicate plan IDs
- a result whose internal ID differs from its map key
- invalid attempt counts or empty model names
- a generic section where a specialised romance, sexuality, career or money shape is required
- malformed system, compatibility, cross-system or final synthesis objects
- a source reference outside the unit's fixed `allowedSourceRefs`
- an unresolved reference
- a reference to a deterministic field marked unavailable or unsupported

The final chart is therefore a typed projection of audited field results. It is not a free-form document assembled by the model.

## Subject name

A provided subject name is preserved and attributed to the calculation input.

When no name was provided, the caller must supply a generated chart name containing exactly three hyphenated Unicode words. The name is attributed to the calculation fingerprint. Invalid generated names are rejected.

## Chart provenance

The chart records:

- big and small model IDs
- structured-output schema version
- prompt and astrology catalogues
- NLP audit profile
- total calls and retries
- confirmation that one shared conversation was used
- one phase record for every interpretation unit in plan order

Each phase retains its unit ID, output schema, model and attempt count.

## File assembly

`assembleAstralFile` first creates the unsigned canonical envelope:

```json
{
  "schema": "astral/1.0.0",
  "astral-calculation": {},
  "astral-chart": {},
  "crc": {},
  "authority": null
}
```

The root order is fixed. CRC metadata covers `schema`, `astral-calculation` and `astral-chart` using RFC 8785 canonical JSON and UTF-8 bytes.

The integrity record includes:

- canonical byte length
- SHA-256
- SHA-512
- CRC-32C

Optional Ed25519 authority signs the root schema, calculation, chart and CRC. Private signing keys are runtime inputs and are never stored in the file.

## Encoding

`encodeAstralFile(file)` returns canonical RFC 8785 JSON.

`encodeAstralFile(file, true)` returns indented JSON with a trailing newline for human inspection. Integrity and authority remain valid because verification canonicalises the parsed object rather than hashing presentation whitespace.

`decodeAstralFile` parses JSON and requires a structurally valid `astral/1.0.0` document before returning it.

## Validation

`validateAstralFile` returns independent structure, integrity and authority states.

Structure is `valid` only when:

- root keys and order are exact
- calculation, chart, CRC and optional authority schemas are recognised
- interpretation unit IDs are unique
- both compatibility matrices contain every domain, every sign and ranks 1 through 12
- tropical and sidereal labels remain consistent
- generated subject names match the three-word rule

Integrity states are:

- `valid`: all canonical length and digest fields match
- `modified`: structure is valid but canonical content differs from the stored CRC
- `invalid_crc`: structure or CRC data cannot be validated
- `unsupported`: canonicalisation or encoding is unsupported

Authority states are:

- `unsigned`: no authority block
- `valid_untrusted`: signature is valid but no active matching trust record exists
- `trusted`: signature is valid and issuer, key ID and public key match an active trust record
- `unknown_key`: trust is configured but the key is absent or its issuer or public key does not match
- `revoked`: the matching key is revoked
- `invalid`: signature or signed digest verification fails

Signature verification always occurs before trust classification.
