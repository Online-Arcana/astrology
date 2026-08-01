# Deterministic astrology profiles

All rule choices are named and versioned. The initial implementation does not ask the LLM to select or calculate any of them.

## Zodiac positions

Longitudes are normalised to `[0, 360)`. Sign positions retain absolute longitude, sign, degree, minute, second, decan and degree within the sign. Sidereal conversion subtracts the separately calculated ayanamsha before normalisation.

## Lunar phase

`eight_phase/1.0.0` divides the synodic cycle into eight 45-degree sectors centred on New Moon, First Quarter, Full Moon and Last Quarter. Illumination is calculated from angular elongation. Lunar age uses a 29.530588853-day synodic month.

## Aspects

`western_aspects/1.0.0` defines all required major and minor angles and explicit base orbs. Major aspects receive a two-degree luminary allowance and a one-degree principal-angle allowance. Minor aspects use their fixed catalogue orb. Applying and separating state is determined from signed longitudinal speed when both speeds are available.

## Compatibility

`western_compatibility/1.0.0` ranks deterministic domain scores. It requires all twelve signs exactly once, clamps scores to 0 through 100, assigns ranks 1 through 12 and maps 67 through 100 to high, 34 through 66 to medium and 0 through 33 to low. Domain factor catalogues are implemented separately and remain inspectable.
