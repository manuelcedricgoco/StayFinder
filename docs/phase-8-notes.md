# Phase 8: Owner dashboard and management

Phase 8 replaces the owner dashboard placeholder with owner-scoped management tools. The API
requires an authenticated `OWNER` session, and room, inquiry, review, profile, and verification
queries do not expose another owner's records.

## Owner pages

- `/owner`: listing, room, inquiry, and approved-review statistics with links to owner tools.
- `/owner/properties/:propertyId/rooms`: add, edit, and delete rooms and manage availability.
- `/owner/inquiries`: view incoming inquiries, reply, or close an inquiry.
- `/owner/reviews`: read reviews submitted for the owner's properties.
- `/owner/profile`: update the display name and avatar URL.
- `/owner/verification`: submit identity details and view verification status.

Room availability is synchronized to the property's `availableRooms` and `availability` fields
whenever the property has managed room records. Property-level inventory continues to be used for
properties without room records.

## API

All endpoints below are mounted under `/api/owner` and require the `OWNER` role.

| Method | Path | Behavior |
|---|---|---|
| GET | `/dashboard` | Return listing, room, inquiry, and approved-review statistics |
| GET | `/inquiries` | List inquiries addressed to this owner |
| PATCH | `/inquiries/:inquiryId` | Reply to an inquiry or update its status |
| GET | `/reviews` | List reviews on this owner's properties |
| PATCH | `/profile` | Update public name and avatar URL |
| GET / POST | `/verification` | Read or submit this owner's verification |
| GET / POST | `/properties/:propertyId/rooms` | List or create rooms on an owned property |
| PUT / DELETE | `/rooms/:roomId` | Update or remove a room on an owned property |

## Verification privacy and Phase 9 dependency

Verification submissions store an HTTPS document URL rather than uploading or fetching a document.
The URL and submitted personal details are available only through the authenticated owner's
verification endpoint. Owners are instructed to use private links. A pending request cannot be
edited or resubmitted; a rejected request may be resubmitted, and an approved request cannot be
resubmitted. At the Phase 8 release, administrator review and public verification indicators were
still pending work; Phase 9 adds that workflow.

Phase 9 adds the admin verification queue and approval/rejection actions. Only approved verification
records produce a boolean verified-owner indicator on public listing details; private verification
fields are not included in that public response.

## Database and checks

The `20261009020321_add_owner_dashboard` migration adds the `OwnerVerification` model with one
record per owner and a status/submission-time index. Apply migrations and regenerate Prisma Client
after pulling the phase:

```bat
npm run prisma:migrate
npm run prisma:generate
npm run typecheck
npm test
```

On Windows, if Prisma Client generation fails with `EPERM` renaming
`query_engine-windows.dll.node`, stop the backend development server and retry generation; the engine
DLL may be locked by a running Node process.

The property integration tests cover owner isolation, availability synchronization, dashboard
statistics, inquiry replies and status changes, review visibility, safe profile responses, and
verification submission rules.
