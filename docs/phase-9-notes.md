# Phase 9: Admin dashboard and moderation

Phase 9 replaces the admin dashboard placeholder with metrics and moderation tools for listing
submissions, boarder reviews, property reports, and owner verification. All admin endpoints require
an authenticated `ADMIN` account on the backend.

## Admin pages

- `/admin`: counts for users, owners, boarders, properties, and pending moderation queues.
- `/admin/properties`: filter by status; approve, reject (with reason), or deactivate listings.
- `/admin/reviews`: approve or reject pending boarder reviews.
- `/admin/reports`: resolve or reject pending property reports.
- `/admin/verifications`: review owner-submitted identity details and private document links, then
  approve or reject with a reason.

## API

All routes below are mounted under `/api/admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` and `/dashboard` | Return administrator dashboard statistics |
| GET | `/properties?status=...` | Existing property moderation queue |
| PATCH | `/properties/:id/status` | Approve, reject, or deactivate a property |
| GET | `/reviews?status=...` | List reviews, defaulting to all statuses |
| PATCH | `/reviews/:reviewId/status` | Approve or reject a review |
| GET | `/reports?status=...` | List reports, defaulting to all statuses |
| PATCH | `/reports/:reportId/status` | Resolve or reject a report |
| GET | `/verifications?status=...` | List owner verification submissions |
| PATCH | `/verifications/:verificationId/status` | Approve or reject owner verification |

Verification rejection requires a reason. Review rejections and report decisions are recorded as a
status only. Each moderation queue is capped at 200 items and ordered from oldest to newest so older
pending submissions are visible first.

## Public moderation outcomes and privacy

Approved reviews appear on the matching public listing detail page. Pending and rejected reviews
are not returned publicly. An owner is marked verified publicly only when an administrator approves
their verification. The public property response exposes only this boolean and the owner's display
name; it does not include identity documents, legal name, phone number, or email.

Verification details and document links are available to the authenticated owner and administrators.
The document URL is not fetched by the server. Admins should open it only as needed and keep it
confidential.

## Database and checks

Phase 9 uses the existing review, report, property, and owner-verification tables. No migration or
new package is required. Verification:

```bat
npm run typecheck
npm test
npm run build
```

The backend integration tests cover role protection, dashboard metrics, review/report decisions,
verification rejection and resubmission, approval behavior, and public review and verification data.
