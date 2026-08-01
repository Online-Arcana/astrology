# Deterministic calculation path

The initial calculation path is:

1. Resolve a selected `csc:<country>:<region>:<city-id>` place record.
2. Normalise it into stable `PlaceData` with latitude, longitude and an IANA zone.
3. Resolve local civil time through pinned tzdb 2026a rules.
4. Convert the resulting UTC instant into Julian day, delta T and Julian ephemeris day.
5. Calculate apparent geocentric positions through the pinned `astronomia` submodule.
6. Derive longitudinal speed from centred half-day samples and classify direct, retrograde or stationary motion.

## Place rules

Free text is only a candidate search. It never silently selects a city. Duplicate names remain distinct because IDs include country, region and the source city ID. A city timezone is preferred, followed by its region timezone and then a sole country timezone. A record without a usable IANA identifier is rejected.

## Astronomy frame

The astronomy output uses:

- centre: geocentric
- coordinates: apparent
- epoch: date

Mercury through Neptune use VSOP87 heliocentric positions, light-time iteration, ecliptic aberration, FK5 correction and nutation. The Sun uses the VSOP87 apparent solar routines. The Moon uses the lunar position series with nutation and true obliquity. Pluto uses its dedicated heliocentric series, precessed to the ecliptic of date before the same geocentric apparent pipeline.

Every body retains right ascension, declination, ecliptic longitude, ecliptic latitude, distance, longitudinal speed and motion. Unknown or unresolved birth time produces explicit unavailable wrappers rather than invented positions.
