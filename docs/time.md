# Civil-time resolver

`vendor/time` is pinned to `js-joda/js-joda`. The project uses `@js-joda/core` and `@js-joda/timezone` behind the strict `TimeResolver` boundary in `src/time`.

## Decision

The selected API exposes the complete set of valid offsets for a local date-time. A normal time has one offset, an autumn overlap has two, and a spring gap has none. It also exposes the transition and daylight-saving state. This lets astral-charts report ambiguity and nonexistence instead of silently shifting the supplied birth time.

The timezone package ships rule data rather than delegating historical results to the host runtime. The exact submodule revision and data version are recorded in calculation provenance.

## Calendar and range

The application uses the proleptic Gregorian calendar for input. Time-zone history is limited by the pinned IANA data and its source history. Pre-standard-time values, local mean time and dates outside the resolver's verified fixtures are returned as unsupported rather than approximated.

The supported range is versioned after fixture validation. It is never inferred from the current machine's `Intl` database.

## Update process

1. Update the submodule deliberately.
2. Record the new js-joda and timezone-data versions.
3. Run transition fixtures, historical-offset fixtures and pre-standard-time fixtures.
4. Change the documented supported range only when the evidence changes.
