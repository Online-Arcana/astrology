# Civil-time resolver

`vendor/time` is pinned to `js-joda/js-joda`. The project uses `@js-joda/core` 6.1.0 and `@js-joda/timezone` 2.25.2 behind the strict `TimeResolver` boundary in `src/time`.

## Decision

The selected API exposes the complete set of valid offsets for a local date-time. A normal time has one offset, an autumn overlap has two, and a spring gap has none. It also exposes the applicable transition. This lets astrology report ambiguity and nonexistence instead of silently shifting the supplied birth time.

The pinned timezone package contains IANA tzdb 2026a rules rather than delegating historical results to the host runtime. The submodule revision, package versions and tzdb version are recorded in calculation provenance.

The package resolves offsets and transitions exactly but its current zone-rules implementation does not expose a reliable daylight-saving label for an arbitrary instant. In that case `daylightSaving` is `null`; astrology does not infer the label from seasonal offset heuristics. UTC resolution and transition detection remain exact.

## Calendar and range

Input uses the proleptic Gregorian calendar. The initial verified application policy accepts 1900-01-01 through 2100-12-31. Dates outside that range are returned as `unsupported`; they are not approximated using a present-day offset.

Ambiguous local times are returned as a bounded pair of UTC candidates. Nonexistent local times are unavailable. Approximate times retain their nominal instant but remain marked `approximate` with `birth_time_approximate`.

Pre-standard-time dates, local mean time and broader historical ranges require dedicated fixtures before the supported range is widened.

## Update process

1. Update the submodule deliberately.
2. Record the new js-joda and timezone-data versions.
3. Run transition fixtures, historical-offset fixtures and pre-standard-time fixtures.
4. Change the supported range only when the evidence changes.
