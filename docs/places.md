# Geographic data

`vendor/places` pins `dr5hn/countrystatecity-npm` and uses the server-side `@countrystatecity/countries` package. Its country, region and city data originates from `dr5hn/countries-states-cities-database`.

The source dataset is provided under the Open Database Licence 1.0. The project preserves the upstream repository as a submodule, records its exact revision in calculation provenance and does not copy the complete geographic dataset into `src`.

astrology normalises upstream records into its own `PlaceData` contract. Free-text search returns candidates only. Selection remains explicit, and stable IDs retain the source city identifier together with country and region codes.
