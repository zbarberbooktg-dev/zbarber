---
name: Countries & cities catalog
description: Country/city forms are catalog-backed (countriesTable + citiesTable). All write paths must use resolveAndPersistLocation for dedup and validation.
---

- Source of truth for forms: `lib/db/src/schema/locations.ts` (countriesTable, citiesTable with unique index on (countryId, lower(name))) + `lib/db/src/seed/countries.ts` (~190 ISO countries, French names, dial codes).
- Server seeds countries lazily on first call to `ensureCountriesSeeded()` in `artifacts/api-server/src/routes/locations.ts`. The seed promise is cleared on failure to allow retries.
- Any route that writes city/country on users or barbers must go through `resolveAndPersistLocation({ countryName, cityName })`. It:
  - validates the country exists in the catalog (throws `UnknownCountryError` → callers map to HTTP 400),
  - case-insensitively dedups cities per country (creates new on first sight),
  - returns the canonical names to store on the row.
- **Why:** keeps free-text city/country fields on rows (no FK migration) while preventing duplicates and uncataloged values from drifting in via the API.
- Mobile UI is centralized in `artifacts/mobile/components/CountryCityFields.tsx`. Always re-derive selected country from props (controlled), and clear city when country changes to prevent cross-country mismatches.
- Country always renders **before** city in the form layout.
