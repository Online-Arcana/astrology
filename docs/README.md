# Documentation

Start with the path that matches the work.

## Use the project

- [Browser frontend](browser.md): client-only generation, local credentials, IndexedDB recovery, signing boundaries, bills and GitHub Pages.
- [CLI and JSON API](interfaces.md): calculate charts, generate `.astral` files, validate files and browse places.
- [Configuration](configuration.md): chart basis, models, bounded lanes, recovery and signing.
- [Chart files](chart-files.md): assemble, encode, decode, sign and validate complete files.
- [`.astral` format](format.md): canonical JSON, checksums, integrity scope and Ed25519 authority.
- [Temporary job recovery](recovery.md): preserve accepted wave work across interruption and migration.

## Understand the engine

- [Calculation service](service.md): deterministic pipeline and dependency boundaries.
- [Calculation path](calculation.md): place resolution, civil time, astronomy and coordinate frame.
- [Geographic data](places.md): pinned place source, stable IDs and explicit selection.
- [Civil time](time.md): exact, approximate, unknown, ambiguous and invalid local times.

## Astrology model

- [Astrology profile](astrology.md): fixed schools, conventions and supported systems.
- [Points](points.md): planets, angles, nodes, Lilith, sect and lots.
- [Houses](houses.md): Placidus, Whole Sign, Equal, Porphyry and polar fallback.
- [Dignity](dignity.md): domicile, exaltation, triplicity, bounds, faces and debility.
- [Derived chart](derived.md): rulers, dispositors, receptions, balances, dominance and Jones patterns.
- [Aspects and patterns](aspects.md): longitude, declination and structural configurations.
- [Eclipses](eclipses.md): eclipse-at-birth and prenatal eclipse calculation.
- [Compatibility](compatibility.md): deterministic twelve-domain sign ranking.

## Interpretation

- [Interpretation corpus and worldview-neutral generation](interpretation-corpus.md): source roles, atomic semantics, InterpretationMap, semantic-register versus interpretive-voice separation and hard neutrality gates.
- [Interpretation runtime](interpretation.md): one immutable chart system, serial foundation, four bounded lanes, snapshots, audits and truncation condensation.
- [NLP audit](audit.md): semantic role, human-first style, completion, duplication and source references.

## Suggested reading paths

**Using the static page:** browser → chart-files → format

**Operating the CLI or server:** interfaces → configuration → chart-files → format

**Changing deterministic astrology:** service → astrology → the relevant subsystem document

**Changing LLM interpretation:** interpretation-corpus → interpretation → audit → recovery → chart-files

**Implementing a `.astral` reader:** format → chart-files

## Boundary

Deterministic code owns all calculations, availability, rankings, source permissions and interpretation plans. `kitty-crow/openai-schema` is the structured OpenAI runtime. Ordinary CI uses mocked transport and never makes a live OpenAI request.
