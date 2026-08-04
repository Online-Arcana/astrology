# Browser frontend

The `public/` application runs chart calculation, interpretation, recovery, billing, file viewing, maintenance and optional local authority signing in the visitor's browser. It is suitable for static GitHub Pages hosting and does not require the Node HTTP server.

## Local state

Non-secret chart-form values are stored in this origin's `localStorage` so the selected place, birth data and chart settings survive reloads. Recoverable generation checkpoints, completed charts and usage bills are stored in IndexedDB under `astral-browser`.

API and signing keys are never saved as plaintext by the current browser frontend. Without an encrypted vault they remain in JavaScript memory for the current page session and disappear when the page is closed or refreshed.

No credential is compiled into the Pages assets. Clearing site data removes the encrypted vault, form draft and chart data. The frontend intentionally has no analytics, tag manager, remote font, advertising or third-party script dependency.

## Encrypted credential vault

The optional credential vault uses a user-verified WebAuthn passkey or authenticator PRF result to derive an AES-GCM encryption key. The browser may satisfy verification through Face ID, Touch ID, Windows Hello, an Android biometric prompt, a platform passkey or a compatible security key.

Only ciphertext, IVs, PRF salt, credential identifier and non-secret timestamps are stored in IndexedDB under `astral-secure-vault`. The derived AES key is non-extractable and remains in memory only while the page is unlocked. Locking, refreshing or closing the page clears the decrypted API and signing credentials from application memory.

Browsers or authenticators without WebAuthn PRF support remain usable in memory-only mode. They do not fall back to persistent plaintext storage.

When an older deployed version left `astral.openai-key` or `astral.signing-key` in `localStorage`, the upgraded page captures those values into the current session, removes the plaintext entries immediately and offers to migrate them into the encrypted vault. Closing the page before migration discards that captured copy.

Copy, download, generation and signing controls require the vault to be unlocked when an encrypted vault exists. The page automatically locks after fifteen minutes without pointer or keyboard activity.

Biometric or passkey protection secures credentials at rest. While unlocked, the page necessarily holds the decrypted credentials briefly in memory to call OpenAI or create an Ed25519 signature.

## Credential controls

The OpenAI key has an in-field reveal button plus **Copy key**, **Download key** and **Import key** actions. These actions operate only on the current in-memory value and require vault unlock when encrypted storage is configured.

The Ed25519 bundle remains JSON internally, but the normal interface presents three separate fields:

- **Issuer**
- **Private PKCS8**
- **Public raw key**

The private and public values remain masked and locked until the eye button is used. Revealing them also makes the fields editable. **Copy bundle**, **Download bundle** and **Import bundle** preserve the hidden JSON structure containing `issuer`, `privatePkcs8` and `publicRaw`.

## Generation and signing

Normal chart generation may sign the newly assembled `.astral` file with the currently loaded Ed25519 key. It never replaces the authority on an existing file through the ordinary open/view path.

A verified authority fingerprint matching the loaded key is labelled **Made by this browser key**. GitHub Actions secrets are deliberately not passed to the static build. A deployed browser page cannot use a workflow secret without publishing it.

## Test maintenance tool

Opening an `.astral` file exposes an explicit test-only maintenance card. It always creates a new copy and never mutates the uploaded bytes in place.

The analyser checks:

- current file and calculation schema;
- CRC and authority state;
- embedded birth data needed for regeneration;
- preferred-gender metadata;
- every interpretation unit listed in the deterministic interpretation plan;
- the same strict parser used during chart assembly;
- deterministic NLP quality and completion checks;
- permitted, resolvable source references.

A complete current file may be re-canonicalised or newly signed without an API call. A legacy, modified, incomplete or NLP-invalid file is fully recalculated and regenerated from its embedded birth data using the configured model routing. This adds current required fields, writes the selected preferred gender, completes missing interpretations, recalculates integrity values and optionally signs the resulting copy with the loaded Ed25519 key.

The maintenance tool refuses automatic regeneration when the old file does not contain enough unambiguous birth and place data. It does not invent missing deterministic facts.

## Recovery and stopping

Every accepted checkpoint is written to IndexedDB. Stopping generation aborts current requests and leaves the latest accepted checkpoint available after reload. Resuming reuses accepted work and its accumulated bill.

Temporary checkpoints may be compact. Final customer `.astral` downloads are always indented JSON.

## Usage bills

Completed model responses contribute authoritative input, cached-input, output, reasoning and total-token usage. The page attributes those values by model and runtime lane, estimates cost from the versioned price catalogue, persists final bills and averages completed full-coverage bills to show historical chart cost.

## Customer file view

Current `.astral` files have two views:

- **Formatted** presents customer-readable sections;
- **Raw** shows the complete indented document, including provenance, integrity and authority metadata.

The formatted view groups readings into canonical front-end categories such as general themes, relationships, work, growth, points, houses, aspects, compatibilities, synthesis and technical chart data. Every category starts collapsed, and every reading inside it starts collapsed. A sticky left-hand index links to each category and reading through stable `#section` anchors and automatically opens the selected containers.

The front-end titles are descriptive presentation labels only. They do not rename or modify fields inside the `.astral` JSON.

## Responsive layout

The Pages build injects shared usability safeguards into every HTML page. Form controls and their flex/grid parents are allowed to shrink, capped to their container width and protected against horizontal page overflow. Mobile layouts wrap long labels and action controls instead of allowing any field to escape its card.

The formatted index becomes a single-column block on smaller screens. Signing fields also collapse from a desktop row into a contained vertical layout.

## Build and deploy

```sh
npm run vendor:build
npm install
npm run build:pages
```

The output is written to `public/`. The main application and browser tools are built as one split ESM graph so they share a single in-memory credential and runtime state. The build audits all emitted HTML, JavaScript and CSS, including shared chunks, for known local paths, private-network addresses, location defaults and literal credential assignments.

`.github/workflows/pages.yml` deploys `public/` from `main`. Select **GitHub Actions** as the Pages source in repository settings. The deployed page needs no server-side runtime configuration.
