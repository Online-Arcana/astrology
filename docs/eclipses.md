# Eclipses

`western_eclipses/1.0.0` calculates global geocentric eclipse events from the pinned `astronomia` implementation of Meeus chapter 54. The LLM does not search for, classify or alter eclipse events.

## Event search

The provider is sampled once per nominal month from twenty-four months before the birth instant through two months after it. Results are deduplicated by eclipse kind and maximum Julian ephemeris date. This deliberately over-samples the lunation resolver so the nearest prenatal solar and lunar eclipses cannot be skipped.

The latest solar maximum before birth becomes `prenatalSolar`. The latest lunar maximum before birth becomes `prenatalLunar`. Solar and lunar events are selected independently.

## Event types

Solar provider types map as follows:

- partial to `partial`
- annular to `annular`
- annular-total to `hybrid`
- total to `total`

Lunar penumbral events remain `penumbral`. Lunar umbral partial events map to `partial`; total umbral events map to `total`.

Magnitude is retained when the provider defines it. A central solar eclipse may legitimately have `null` magnitude because the pinned algorithm exposes magnitude only for partial solar eclipses.

## Eclipse at birth

`atBirth` means the birth instant falls inside the globally active eclipse interval. It does not claim that the eclipse was visible from the birthplace.

For lunar eclipses, the active interval is the provider's calculated penumbral semiduration around maximum. For solar eclipses, the pinned provider does not expose contact times, so the versioned rule uses a fixed three-hour interval on either side of maximum.

`birthOffsetSeconds` is positive when birth follows eclipse maximum and negative when birth precedes it.

## Positions and nodes

Solar eclipse position uses the apparent geocentric Sun longitude at maximum. Lunar eclipse position uses the apparent geocentric Moon longitude at maximum.

Node attribution compares that longitude with the instantaneous osculating true north and south lunar nodes. The nearer node is reported together with angular distance for an eclipse at birth.

Prenatal events retain both:

- apparent tropical position of date
- selected sidereal position using the configured ayanamsha at the eclipse maximum

## Time accuracy

Exact birth time produces exact timing fields. Approximate birth time propagates approximate or bounded status. Unknown, ambiguous or nonexistent birth time never receives an invented Julian instant, so all eclipse timing fields remain explicitly unavailable.
