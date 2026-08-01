# `.astral` format

A `.astral` file is UTF-8 JSON with five root properties in this logical order:

1. `schema`
2. `astral-calculation`
3. `astral-chart`
4. `crc`
5. `authority`

`authority` is always present and may be `null`.

## Integrity

The integrity scope is the first three properties. They are canonicalised according to RFC 8785 and encoded as UTF-8 before byte length, SHA-256, SHA-512 and CRC-32C are calculated. The `crc` and `authority` properties are excluded from this calculation.

## Authority

When enabled, Ed25519 signs the RFC 8785 bytes of the first four properties. The authority block is excluded from its own signature. Public keys use raw 32-byte Ed25519 encoding. Private keys use PKCS#8. Both environment values use base64url encoding.
