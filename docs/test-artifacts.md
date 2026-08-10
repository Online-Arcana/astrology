# TEST-ONLY chart artifacts

The browser includes a development chart tester for exercising the deterministic chart and viewer without spending model tokens.

A generated test chart contains real deterministic astrology calculation data, while interpretation fields are synthetic Lorem Ipsum placeholders. When no ordinary browser signing identity is available, the tester creates an ephemeral Ed25519 bundle marked `astral-test-signing-key/1.0.0` and signs a chart whose signed provenance contains `astral-test-artifact/1.0.0`.

A test-key artifact is not a production identity. The UI must label it `TEST SIGNATURE — NOT VALID`, the key cannot be persisted in the production passkey vault, and maintenance/canonicalisation cannot use it to sign another chart.

## Package bypass boundary

Only verified test-key artifacts may use the public test-package password. They are wrapped with distinct `ASTRTEST1` magic around the ordinary `ASTRPKG` container. The public test password provides deliberately **no confidentiality** and exists only to avoid password/passkey friction while testing the chart UI.

Opening through the test bypass requires all of the following after the inner `ASTRPKG` container decrypts:

- current `astral/1.1.0` structure;
- valid file integrity/CRC;
- an exact signed test-artifact marker;
- the marker's `signingKeyId` matching the authority `keyId`;
- the authority `keyId` matching SHA-256 of the embedded public key;
- test-key signing mode matching the reserved TEST-ONLY issuer prefix;
- a valid Ed25519 signature over the chart/calculation/CRC scope.

Changing a normal file's issuer, adding a test prefix, editing its test marker, or changing its key ID cannot make it eligible. Prefixing an ordinary encrypted package with `ASTRTEST1` also cannot reveal it: the inner ASTRPKG payload must first decrypt with the public test password, which a normal password-protected package will not do.

This does not attempt to prevent someone who already possesses plaintext chart JSON from creating their own test artifact; possession of the plaintext already means confidentiality has been lost. The security property is that an unknown-password real encrypted package cannot be converted into the test bypass without first obtaining its plaintext by the normal decryption path.
