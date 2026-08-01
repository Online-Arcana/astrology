# Derived chart

`western_derived/1.0.0` derives chart-level structures from the completed point map, house placements, aspects and sect. These values are calculated before interpretation and cannot be selected or changed by the LLM.

## Chart rulers and dispositors

The traditional chart ruler is the traditional ruler of the Ascendant sign. The modern chart ruler uses the configured modern ruler, including the recognised outer-planet co-rulers for Scorpio, Aquarius and Pisces.

Every planet has separate traditional and modern dispositors. A final dispositor is reported only when exactly one planet disposits itself and every planetary chain terminates at that planet. Closed cycles, competing self-rulers and unresolved chains produce `null` rather than a guessed final dispositor.

Mutual receptions are detected separately under traditional and modern rulership. The same pair may therefore appear once for each system.

## Balance profile

The sign-balance weights are:

- Sun, Moon and Ascendant: 2 each
- Mercury through Pluto: 1 each
- Midheaven: 1
- other calculated points: 0

These weights feed element, modality and polarity totals.

Hemisphere and house-mode balances use planetary house placements in the configured primary house slot. The initial primary slot is `placidus`; when that slot contains the explicitly labelled Porphyry polar fallback, the fallback geometry is used without being relabelled as Placidus.

The house groups are:

- eastern: houses 10, 11, 12, 1, 2 and 3
- western: houses 4 through 9
- northern: houses 1 through 6
- southern: houses 7 through 12
- angular: houses 1, 4, 7 and 10
- succedent: houses 2, 5, 8 and 11
- cadent: houses 3, 6, 9 and 12

## Dominance

`planetary_dominance/1.0.0` measures prominence, not beneficence or ease. A difficult but strongly placed planet may therefore rank highly.

Planetary prominence combines:

- absolute essential-dignity score
- traditional and modern chart-ruler status
- angular or succedent placement
- configured aspect strength
- day or night sect-light status

Every contribution is retained as an inspectable factor string. Dominant signs combine the fixed point weights, dignity prominence and the placement of the traditional chart ruler.

## Retrograde and unaspected planets

Retrograde planets come directly from the deterministic astronomical motion state.

`unaspected_planets/1.0.0` defines an unaspected planet as one with no configured major aspect to another planet. Minor aspects and aspects only to angles, nodes, lots or Lilith do not remove this classification.

## Jones patterns

`jones_patterns/1.0.0` classifies the ten planetary longitudes using explicit circular-gap rules:

- bundle: occupied arc no greater than 120 degrees
- bucket: nine planets occupy no more than 180 degrees and one isolated handle is separated from both cluster ends
- bowl: occupied arc no greater than 180 degrees after bucket exclusion
- see-saw: two substantial separating gaps produce two groups of at least two planets
- locomotive: one empty gap of 60 to 150 degrees, no second gap of 60 degrees, and an occupied arc of 210 to 300 degrees
- splash: every empty gap is below 60 degrees
- splay: at least three distinct gaps of 40 degrees after the earlier patterns are excluded

When none of the versioned rules fits cleanly, the field remains unavailable with `insufficient_data`. The engine does not force a nearest pattern.
