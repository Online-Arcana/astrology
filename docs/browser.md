# Browser frontend

The `public/` application runs chart calculation, interpretation, recovery, billing, file viewing, maintenance, optional local authority signing, packaging and unpacking in the visitor's browser. It is suitable for static GitHub Pages hosting and does not require the Node HTTP server.

## Local state

Non-secret chart-form values are stored in this origin's `localStorage` so the selected place, birth data and chart settings survive reloads. Recoverable generation checkpoints, completed charts and usage bills are stored in IndexedDB under `astral-browser`.

API and signing keys are never saved as plaintext by the current browser frontend. Without an encrypted vault they remain in JavaScript memory for the current page session and disappear when the page is closed or refreshed.

Package passwords are different from saved credentials. A package password is used only for the active packaging or opening operation. It is never written to `localStorage`, IndexedDB, session storage, Cache Storage or the generated file, and the password fields are cleared after each attempt.

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

All three fields remain masked and locked until the eye button is used. Revealing them also makes the fields editable. **Copy bundle**, **Download bundle** and **Import bundle** preserve the hidden JSON structure containing `issuer`, `privatePkcs8` and `publicRaw`.

## Packaging dependency

`vendor/astral-packager` is a pinned git submodule and root package dependency. Its build exposes the same `pack()` and `open()` core used by the `astral-pack` CLI and the packager's own GitHub Pages application.

A browser cannot spawn a Node CLI process. The Pages frontend therefore calls that exact shared core directly rather than reimplementing the format.

New containers use ASTRPKG4:

```text
strict JSON
  → canonical semantic value
  → typed protobuf
  → balanced lossless compression
  → AES-256-GCM
  → authenticated public header + ciphertext
```

The complete raw chart, including its CRC and optional authority signature, remains inside the encrypted payload.

## Generation and signing

Normal chart generation may sign the newly assembled raw chart with the currently loaded Ed25519 key. After generation completes, the browser automatically enters the packaging stage and asks for a package password. The only final `.astral` download is the encrypted package.

The package password must pass the packager's local password audit and is requested twice. Packaging progress remains visible during compression, password-key derivation and encryption.

A verified authority fingerprint matching the loaded key is labelled **Made by this browser key**. GitHub Actions secrets are deliberately not passed to the static build. A deployed browser page cannot use a workflow secret without publishing it.

## Opening a packaged chart

Selecting an ASTRPKG1, ASTRPKG2, ASTRPKG3 or ASTRPKG4 file intercepts the ordinary JSON open path before it runs. The page asks for the password and then calls the packager's `open()` procedure locally.

That procedure authenticates and decrypts the container, decompresses its payload, decodes the typed protobuf, reconstructs canonical JSON, regenerates the private identity and verifies the public identity metadata. The temporary identity object is explicitly dropped immediately after reconstruction.

A wrong password or damaged package leaves the file unopened and keeps the password dialog available for another attempt. The reconstructed JSON exists only in page memory and is then passed to the existing validator, formatted viewer and maintenance tools.

Legacy raw JSON `.astral` files remain readable for migration and maintenance. Any new download from them is packaged.

## Test maintenance tool

Opening an `.astral` file exposes an explicit maintenance card. It always creates a new copy and never mutates the uploaded bytes in place.

The analyser checks:

- current file and calculation schema;
- CRC and authority state;
- embedded birth data needed for regeneration;
- preferred-gender metadata;
- every interpretation unit listed in the deterministic interpretation plan;
- the same strict parser used during chart assembly;
- deterministic NLP quality and completion checks;
- permitted, resolvable source references.

Interpretation regeneration is always off by default. Audit findings are advisory and never turn it on automatically.

With regeneration off, current calculations and interpretations are preserved without an API call. The tool may update selected preferred-gender metadata, recalculate integrity values, replace or add the selected Ed25519 authority signature, and then package the new copy.

Regeneration runs only when the user explicitly checks **Recalculate and complete all missing or invalid fields**. It then rebuilds deterministic data and interpretations from embedded birth information using the configured model routing before the result is packaged.

The maintenance tool refuses regeneration when the old file does not contain enough unambiguous birth and place data. It does not invent missing deterministic facts.

## Recovery and stopping

Every accepted checkpoint is written to IndexedDB. Stopping generation aborts current requests and leaves the latest accepted checkpoint available after reload. Resuming reuses accepted work and its accumulated bill.

Temporary checkpoints and saved in-browser chart objects remain internal implementation data. Final customer `.astral` downloads are always encrypted packages.

## Usage bills

Completed model responses contribute authoritative input, cached-input, output, reasoning and total-token usage. The page attributes those values by model and runtime lane, estimates cost from the versioned price catalogue, persists final bills and averages completed full-coverage bills to show historical chart cost.

## Customer file view

After a package has been opened, its reconstructed chart has two views:

- **Formatted** presents customer-readable sections;
- **Reconstructed JSON** shows the complete indented raw document in page memory, including provenance, integrity and authority metadata.

The formatted view groups readings into canonical front-end categories such as general themes, relationships, work, growth, points, houses, aspects, compatibilities, synthesis and technical chart data. Every category starts collapsed, and every reading inside it starts collapsed. A sticky left-hand index links to each category and reading through stable `#section` anchors and automatically opens the selected containers.

The front-end titles are descriptive presentation labels only. They do not rename or modify fields inside the reconstructed JSON.

## Responsive layout

The Pages build injects shared usability safeguards into every HTML page. Form controls and their flex/grid parents are allowed to shrink, capped to their container width and protected against horizontal page overflow. Mobile layouts wrap long labels and action controls instead of allowing any field to escape its card.

The formatted index becomes a single-column block on smaller screens. Signing fields and the package password dialog also collapse into contained mobile layouts.

## Build and deploy

```sh
git submodule update --init --recursive
npm run vendor:build
npm install
npm run build:pages
```

The vendor build compiles `astral-packager` before the root package installs the local file dependency. The output is written to `public/`.

The main application and browser tools are built as one split ESM graph so they share in-memory credential, file and packaging state. The guarded `node:zlib` import used only by the packager CLI is left external in the browser bundle; the browser executes its CompressionStream-based branch.

The build audits all emitted HTML, JavaScript and CSS, including shared chunks, for known local paths, private-network addresses, location defaults and literal credential assignments.

`.github/workflows/pages.yml` deploys `public/` from `main`. Select **GitHub Actions** as the Pages source in repository settings. The deployed page needs no server-side runtime configuration.
