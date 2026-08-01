# Angles and houses

Chart geometry uses apparent Greenwich sidereal time from `astronomia`, adjusted by geographic longitude, together with the true obliquity of date. The Ascendant, Descendant, Midheaven and Imum Coeli are calculated deterministically before any house system is applied.

## House systems

`houses/1.0.0` provides the four initial systems:

- Placidus divides each point's diurnal or nocturnal semi-arc into thirds. Intermediate cusps are solved numerically on their proper ecliptic quadrant.
- Whole Sign begins house one at zero degrees of the rising sign.
- Equal begins house one at the exact Ascendant and advances in thirty-degree intervals.
- Porphyry trisects the four ecliptic quadrants bounded by the Ascendant, IC, Descendant and MC.

Every system always returns twelve house records.

## Polar handling

Placidus is undefined when the required semi-arcs do not exist, including latitudes inside the polar circle for the obliquity of date. The Placidus slot then contains Porphyry cusps with:

- `system: "porphyry"`
- `status: "fallback"`
- `fallbackFrom: "placidus"`
- `reason: "polar_house_failure"`

The fallback is never labelled as calculated Placidus.

## Sidereal houses

Traditional sidereal Placidus, Equal and Porphyry cusps are the corresponding tropical geometry shifted by the selected ayanamsha. Sidereal Whole Sign is rebuilt from the sidereal Ascendant so house one begins at the exact start of the sidereal rising sign.

House records include sign-relative cusp and end positions, traditional and modern rulers, intercepted signs and occupant lists. Point placement records the house, forward distance from its cusp and whether the point occupies an intercepted sign.
