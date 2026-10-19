# Phase 6 Notes: Public Property Details and Map

## Public detail API

`GET /api/properties/:id` returns a public listing only when its status is `APPROVED`. Pending,
rejected, inactive, deleted, and unknown listings all return `404`, without exposing whether a private
listing exists.

The response includes listing information, images, amenities, rooms, coordinates, and the owner's
display name. It excludes owner IDs, owner email, and moderation fields.

## Detail page

- `/properties/:id` shows the approved listing's gallery, price, availability, description, address,
  amenities, room details, and owner display name.
- Search cards link to the public detail route.
- Unknown and non-public IDs show a not-found message; other API failures are surfaced separately.
- Listings without room records show the listing's available-room count instead.

## Map

When both latitude and longitude are present, the page renders a responsive React Leaflet map with
OpenStreetMap tiles, a property marker, and a link to OpenStreetMap. If coordinates are absent or
incomplete, the page shows the address and a clear map-unavailable message instead.

Map coordinates are the values supplied with the listing; no geocoding is performed. OpenStreetMap
tiles require an internet connection and are attributed on the map.

## Not included

Owner verification submissions were added in Phase 8. Phase 9 added administrator review and a
public verified-owner badge for approved submissions, without exposing private owner contact or
verification details. Boarder inquiries were added in Phase 7 and are sent through the protected
inquiry form on the detail page.
