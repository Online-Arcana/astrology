# Browser frontend

The `public/` application runs chart calculation, interpretation, recovery, billing, file viewing and optional local authority signing in the visitor's browser. It is suitable for static GitHub Pages hosting and does not require the Node HTTP server.

## Local state

The page keeps visitor-provided credentials in this origin's `localStorage`. Recoverable generation checkpoints, completed charts and usage bills are stored in IndexedDB under `astral-browser`.

No credential is compiled into the Pages assets. Clearing site data removes browser-held credentials and chart data. The frontend intentionally has no analytics, tag manager, remote font, advertising or third-party script dependency.

## Generation-only signing

The optional Ed25519 authority is available only to the active generation path. After calculation and interpretation complete, that path may sign the newly assembled file before saving it.

The file-opening path has no signing action. An imported unsigned file remains unsigned. An imported signed file is verified and displayed without replacing its authority. A verified authority fingerprint matching the locally saved key is labelled **Made by this browser key**.

GitHub Actions secrets are deliberately not passed to the static build. A deployed browser page cannot use a workflow secret without publishing it.

## Recovery and stopping

Every accepted checkpoint is written to IndexedDB. Stopping generation aborts current requests and leaves the latest accepted checkpoint available after reload. Resuming reuses accepted work and its accumulated bill.

Temporary checkpoints may be compact. Final customer `.astral` downloads are always indented JSON.

## Usage bills

Completed model responses contribute authoritative input, cached-input, output, reasoning and total-token usage. The page attributes those values by model and runtime lane, estimates cost from the versioned price catalogue, persists final bills and averages completed full-coverage bills to show historical chart cost.

## Customer file view

Current `.astral` files have two views:

- **Formatted** shows placements, houses, aspects, patterns, eclipses, interpretations, compatibility and synthesis;
- **Raw** shows the complete indented document, including provenance, integrity and authority metadata.

The formatted view omits schemas, source references, orchestration, checksums and internal status objects.

## Build and deploy

```sh
npm run vendor:build
npm install
npm run build:pages
```

The output is written to `public/`. The build audits public assets for known local paths, private-network addresses, location defaults and literal credential assignments.

`.github/workflows/pages.yml` deploys `public/` from `main`. Select **GitHub Actions** as the Pages source in repository settings. The deployed page needs no server-side runtime configuration.
