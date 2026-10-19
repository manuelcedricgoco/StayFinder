# Phase 4 Notes: Property Listings

## Data model
```
User 1 ──< Property >── 1 Location          (municipality)
              │
              ├──< PropertyImage              (image URLs; publicId reserved for Cloudinary)
              ├──< Room                       (prepared, not used by any API/screen yet)
              └──>< Amenity                   (many-to-many)
```
- `Location` and `Amenity` are **reference tables** filled by `npm run db:seed`.
- The API exposes `municipality` as the location's name. The column itself is `locationId` so a
  municipality is stored once and can later carry map coordinates.
- `monthlyPrice` is a whole-peso `Int` (avoids decimal/rounding issues).
- Deleting a user deletes their properties, images and rooms (cascade). A municipality that still has
  properties cannot be deleted (restrict).

## Status flow
```
owner creates ──► PENDING ──admin──► APPROVED ──admin──► INACTIVE
                     ▲  └──admin──► REJECTED (reason required)
                     └── any owner edit sends the listing back to PENDING
```
Owners can never choose a status. `status` and `ownerId` sent in a request body are ignored.
Admins can set APPROVED, REJECTED or INACTIVE; only an owner edit returns a listing to PENDING.

## Security decisions
| Decision | Reason |
|---|---|
| Owner queries always include `ownerId` | One owner can never read or change another's listing. |
| Other owners' listings return **404**, not 403 | Does not reveal that the listing exists. |
| Delete = `deleteMany({ id, ownerId })` | Ownership check and delete happen in one query. |
| Edits reset status to PENDING | An approved listing cannot be quietly changed after review. |
| Image URLs must be `https://` | `z.string().url()` alone accepts `javascript:` links. |
| Unknown request fields are stripped by Zod | Prevents mass-assignment of `status`, `ownerId`, `id`. |

## Mock image handling
The form accepts up to 5 `https://` image links. The first is the primary image. If none are given,
or a link fails to load, a colored placeholder is shown. Real uploads (Cloudinary) will fill
`PropertyImage.publicId` in a later phase.

## Admin approval (completed in Phase 9)
`GET /api/admin/properties?status=PENDING` and `PATCH /api/admin/properties/:id/status` provide the
moderation API. The admin listing review screen was added in Phase 9.

## Not done in this phase
- Pagination (owner list is capped at 100, admin list at 200).
- Per-room management (the `Room` table is ready; the form uses a single "available rooms" number).
- Public browsing/search of APPROVED listings.
- Map picker for latitude/longitude (the API accepts them; the form does not show them).
- Image upload.
