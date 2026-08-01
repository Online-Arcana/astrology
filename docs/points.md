# Calculated points

`calculated-points/1.0.0` adds the non-planetary points required by the fixed chart structure.

## Lunar nodes

The mean node uses the standard mean-ecliptic polynomial at the Julian ephemeris date. The true node is the ascending node of the Moon's instantaneous osculating orbital plane, derived from the geocentric lunar position and a centred numerical velocity. Nutation in longitude is added so the node longitudes use the same apparent ecliptic-of-date frame as the planetary positions.

North and south nodes remain separate records. The south node is exactly opposite the corresponding north node. Mean and true nodes are never collapsed into one value.

## Lilith

Mean Lilith is the mean lunar apogee, calculated as the mean perigee plus 180 degrees. True Lilith is the apogee direction of the Moon's instantaneous geocentric osculating ellipse. It is derived from the eccentricity vector using the Earth-Moon gravitational parameter and the same lunar state used for the true node.

The two values may differ substantially. Both retain independently calculated longitudinal speed and motion.

## Additional angles

- Vertex and Antivertex are the western and eastern intersections of the ecliptic with the prime vertical.
- East Point is the equatorial Ascendant, calculated by evaluating the Ascendant geometry at zero geographic latitude.

These remain unavailable when birth time is unavailable.

## Sect and lots

Sect is determined from the Sun's geocentric altitude at the birth place and instant. A Sun on or above the astronomical horizon produces day sect; a Sun below it produces night sect.

The lots use the sect-correct traditional formulae:

- day Fortune: Ascendant + Moon - Sun
- night Fortune: Ascendant + Sun - Moon
- day Spirit: Ascendant + Sun - Moon
- night Spirit: Ascendant + Moon - Sun

All values are normalised to the zodiac and then shifted independently for the selected sidereal ayanamsha.
