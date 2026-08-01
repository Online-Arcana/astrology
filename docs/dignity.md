# Ayanamsha and essential dignity

The rules in this module are explicit, inspectable and versioned. The LLM does not select or alter them.

## Ayanamsha

`western_ayanamsha/1.0.0` supports:

- Lahiri
- Fagan-Bradley
- Krishnamurti
- Raman

Each method has a pinned mean J2000 reference value. The value at the chart's Julian ephemeris date is advanced with the IAU 1976 general precession-in-longitude polynomial. Sidereal longitude is the apparent tropical longitude minus the selected mean ayanamsha. This retains the apparent nutation already present in the tropical position while keeping the ayanamsha definition itself mean.

The selected method and calculated degrees belong in calculation settings and provenance. No averaging or synthetic zodiac is permitted.

## Traditional dignity

`traditional_dignity/1.0.0` uses classical essential dignity for each zodiac system independently:

- whole-sign traditional domicile
- classical exaltation
- detriment opposite traditional domicile
- fall opposite exaltation
- Dorothean triplicity with day, night and participating rulers
- Egyptian bounds
- Chaldean faces
- peregrine status when no positive essential dignity applies

Modern co-rulers are recorded only for Scorpio, Aquarius and Pisces. They do not create traditional domicile dignity for Pluto, Uranus or Neptune.

## Triplicity

`dorothean_triplicity/1.0.0` uses:

| Element | Day | Night | Participating |
|---|---|---|---|
| Fire | Sun | Jupiter | Saturn |
| Earth | Venus | Moon | Mars |
| Air | Saturn | Mercury | Jupiter |
| Water | Venus | Mars | Moon |

The sect ruler contributes three points. The participating ruler contributes one point. When sect is unavailable, the result is marked `bounded`; only dignity that is certain without choosing day or night contributes to the conservative score.

## Bounds and faces

`egyptian_bounds/1.0.0` uses the standard Egyptian terms table, with five contiguous half-open intervals in each sign. Every sign is validated to cover exactly `[0, 30)` without gaps or overlap.

`chaldean_faces/1.0.0` divides every sign into three ten-degree faces. The sequence begins with Mars at the first face of Aries and proceeds continuously through Sun, Venus, Mercury, Moon, Saturn and Jupiter, repeating through all thirty-six faces.

## Score

The inspectable score is:

- domicile: +5
- exaltation: +4
- sect-primary triplicity: +3
- participating triplicity: +1
- own bound: +2
- own face: +1
- detriment: -5
- fall: -4

The score is a rules-engine summary, not a universal claim about how every school weighs dignity. Every active contribution is listed in `ruleRefs`.
