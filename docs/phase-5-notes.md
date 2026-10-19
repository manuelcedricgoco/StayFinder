# Phase 5 Notes: Public Search and Filtering

## Public API

`GET /api/properties` is unauthenticated and returns only listings whose status is `APPROVED`.
Filtering, ordering, counting, and pagination are performed in Prisma/SQLite rather than in the
browser.

Supported query parameters:

| Parameter | Meaning |
|---|---|
| `q` | Partial property-name match (up to 100 characters) |
| `municipality` | Exact municipality name |
| `propertyType` | `BOARDING_HOUSE`, `APARTMENT`, `ROOM`, or `BEDSPACE` |
| `minPrice`, `maxPrice` | Inclusive whole-peso bounds |
| `availability` | `AVAILABLE`, `FULLY_OCCUPIED`, or `COMING_SOON` |
| `amenities` | Comma-separated amenity slugs; every selected amenity must match |
| `sort` | `NEWEST` (default), `PRICE_ASC`, or `PRICE_DESC` |
| `page` | One-based page number; defaults to 1 |

The API returns a result count and pagination metadata with each page of 12 listings. Public result
objects omit owner IDs, property moderation status, and rejection information.

## Frontend

- `/properties` provides property-name, municipality, type, price, availability, amenity, and sorting
  controls.
- Filters and page selection are represented in the URL, so searches can be shared or bookmarked.
- The results view handles loading, request errors/retry, no matches, and pagination.
- The landing-page search form carries municipality, type, and budget selections into `/properties`.
- Only approved listings are shown. A separate property-details page and map are planned for Phase 6.

## Verification

Backend integration coverage verifies approved-only visibility, privacy of public result fields,
combined filters, invalid query rejection, price sorting, and pagination. The backend TypeScript
check and frontend production build also pass.
