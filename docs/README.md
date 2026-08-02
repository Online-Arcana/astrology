# Documentation

Start with the path that matches what you are doing.

## Use the project

- [CLI and JSON API](interfaces.md) — calculate charts, generate `.astral` files, validate files and browse places.
- [Chart files](chart-files.md) — assemble, encode, decode, sign and validate complete files.
- [`.astral` format](format.md) — canonical JSON, checksums, integrity scope and Ed25519 authority.
- [Temporary job recovery](recovery.md) — resume interrupted generation with a short-lived ID and the same OpenAI conversation.

## Understand the engine

- [Calculation service](service.md) — end-to-end deterministic pipeline and dependency boundaries.
- [Calculation path](calculation.md) — place resolution, civil time, astronomy and coordinate frame.
- [Geographic data](places.md) — pinned place source, stable IDs and explicit selection.
- [Civil time](time.md) — exact, approximate, unknown, ambiguous and invalid local times.

## Astrology model

- [Astrology profile](astrology.md) — fixed schools, conventions and supported systems.
- [Points](points.md) — planets, angles, nodes, Lilith, sect and lots.
- [Houses](houses.md) — Placidus, Whole Sign, Equal, Porphyry and polar fallback.
- [Dignity](dignity.md) — domicile, exaltation, triplicity, bounds, faces and debility.
- [Derived chart](derived.md) — rulers, dispositors, receptions, balances, dominance and Jones patterns.
- [Aspects and patterns](aspects.md) — longitude, declination and structural configurations.
- [Eclipses](eclipses.md) — eclipse-at-birth and prenatal eclipse calculation.
- [Compatibility](compatibility.md) — deterministic twelve-domain sign ranking.

## Interpretation

- [Interpretation runtime](interpretation.md) — fixed field calls, one conversation per chart and model routing.
- [NLP audit](audit.md) — relevance, boilerplate removal, source references and narrow retries.

## Suggested reading paths

**Operating the CLI or server:** interfaces → chart-files → format

**Changing deterministic astrology:** service → astrology → the relevant subsystem document

**Changing LLM interpretation:** interpretation → audit → recovery → chart-files

**Implementing a `.astral` reader:** format → chart-files

## Boundary

Deterministic code owns all calculations, availability, rankings and interpretation plans. `kitty-crow/openai-schema` is the sole OpenAI runtime and only interprets predefined fields. Ordinary CI uses mocked transport and never makes a live OpenAI request.
