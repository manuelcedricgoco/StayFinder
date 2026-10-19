# Phase 7 Notes: Boarder Features

## Data model

The Phase 7 migration adds:

- `Favorite`: unique per boarder/property pair.
- `Inquiry`: boarder sender, property owner, property, message, optional response, and
  `PENDING` / `RESPONDED` / `CLOSED` status.
- `Review`: unique per boarder/property, 1–5 rating, review text, and moderation status.
- `Report`: reason, optional details, and moderation status.

Foreign-key cascades remove dependent records when a user or property is deleted. Indexed user,
property, status, and date fields support the user activity pages and future moderation queues.

## Boarder API

All routes below require a valid session and the `BOARDER` role. The backend checks this even if a
request bypasses the frontend.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/boarder/favorites` | List this boarder's saved listings that remain approved |
| POST / DELETE | `/api/boarder/favorites/:propertyId` | Save an approved listing idempotently / remove it |
| GET / POST | `/api/boarder/inquiries` | List own inquiries / send a message to an approved listing's owner |
| GET | `/api/boarder/reviews` | List own reviews and moderation status |
| POST | `/api/boarder/properties/:propertyId/reviews` | Submit one 1–5 star review per approved listing |
| GET | `/api/boarder/reports` | List own reports and review status |
| POST | `/api/boarder/properties/:propertyId/reports` | Report an approved listing |

Reviews and reports begin as `PENDING`. A review is unique for a boarder/property pair. Inquiry
responses are stored for later owner workflow, but owners cannot yet view or respond to inquiries;
that functionality is part of the owner dashboard phase.

Boarders cannot access pending, rejected, inactive, or missing listings through these creation
endpoints. The APIs return 404 for those cases. Favorite/inquiry/review/report list endpoints return
only the signed-in user's own records. Public review display, admin moderation, and report resolution
are not included in this phase.

## Frontend

- `/boarder` has links to the boarder tools.
- `/boarder/favorites` lists saved approved listings and supports removal.
- `/boarder/inquiries` shows messages, status, and any owner response.
- `/boarder/reviews` and `/boarder/reports` show the boarder's submissions and statuses.
- `/boarder/profile` reuses the existing account profile page.
- Approved property detail pages let boarders save a listing, send an inquiry, submit a review, or
  submit a report. Visitors are prompted to log in; other roles do not get boarder actions.

## Verification

Integration tests cover boarder-only authorization, unique/idempotent favorites, inquiry creation and
ownership, review moderation and duplicate prevention, report creation, and rejection of actions
against listings that are no longer approved.
