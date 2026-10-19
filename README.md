# Occidental Mindoro StayFinder

A boarding house and apartment finder for Occidental Mindoro, Philippines.

**Current status: Phase 9 (admin dashboard and moderation).** Phase 1 = foundation, Phase 2 = landing page,
Phase 3 = accounts and roles, Phase 4 = owner property listings, Phase 5 = public search and filtering,
Phase 6 = public listing details and maps, Phase 7 = boarder favorites, inquiries, reviews, and reports,
Phase 8 = owner dashboard, room management, inquiry responses, profile, and verification submission,
Phase 9 = admin metrics and moderation for properties, reviews, reports, and owner verification,
Phase 10 = optional Google and Facebook OAuth sign-in.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, React Router, React Leaflet, OpenStreetMap |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite via Prisma ORM |

## Prerequisites

- Node.js 20 or newer (check with `node -v`)
- npm (comes with Node.js)

## Project structure

```
occidental-mindoro-stayfinder/
├── backend/    Express API + Prisma (port 4000)
├── frontend/   React app (port 5173)
├── docs/       Project notes
├── .gitignore
└── README.md
```

## First-time setup

Open **two terminals**, one for each part.

### 1. Backend

```bash
cd backend
npm install                      # downloads the backend dependencies
cp .env.example .env             # Windows CMD: copy .env.example .env
npx prisma migrate dev --name init   # creates backend/prisma/dev.db and the first table
npm run dev                      # starts the API at http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install                      # downloads the frontend dependencies
npm run dev                      # starts the app at http://localhost:5173
```

## Verify everything works

1. **API:** open http://localhost:4000/api/health. You should see `"status": "ok"`.
2. **Database:** open http://localhost:4000/api/health/db. You should see
   `"connected": true` and `"migrationsApplied": true`.
3. **Frontend:** open http://localhost:5173/health. All three cards should show **OK**.
4. **Prisma Studio (optional):** in `backend/`, run `npm run prisma:studio` and open
   http://localhost:5555. You should see the `SystemCheck` table.
5. **Database file:** `backend/prisma/dev.db` should exist.

If the Database card shows a **Warning**, the migration has not been run yet. Run
`npx prisma migrate dev --name init` in `backend/`.

## Authentication (Phase 3)

Roles: `ADMIN`, `OWNER`, `BOARDER`. Visitors can register as Owner or Boarder only. Admins are
created from the command line (see below), never from the website.

**Update steps after pulling Phase 3** (Windows CMD):

```bat
cd backend
npm install                              REM adds the "zod" validation library
npx prisma migrate dev --name add_auth   REM adds users, sessions, oauth_accounts tables
npm run typecheck                        REM TypeScript check
npm test                                 REM integration tests (uses its own prisma\test.db)
```

**Create the first admin:** put `ADMIN_EMAIL`, `ADMIN_PASSWORD` (and optionally `ADMIN_NAME`) in
`backend/.env` (see `.env.example`), then run `npm run db:seed`.

The seed command also adds repeatable demo records for the owner and boarder dashboards, property
search, and admin moderation. Demo users use the password `StayFinderDemo123`:

| Role | Email |
|---|---|
| Owner | `maria.owner@stayfinder.test` |
| Owner | `jose.owner@stayfinder.test` |
| Owner | `ana.owner@stayfinder.test` |
| Boarder | `lia.boarder@stayfinder.test` |
| Boarder | `miguel.boarder@stayfinder.test` |
| Boarder | `nina.boarder@stayfinder.test` |

Demo records are identified and upserted by stable IDs, so rerunning the seed command does not
duplicate them. Do not use the demo accounts in a production environment.

**API summary**

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/register` | anyone (OWNER / BOARDER only) |
| POST | `/api/auth/login` | anyone |
| POST | `/api/auth/logout` | anyone |
| GET | `/api/auth/me` | logged-in users |
| GET | `/api/properties` | anyone (approved listings with search filters) |
| GET | `/api/locations`, `/api/amenities` | anyone (search/form options) |
| GET | `/api/admin` | admin dashboard summary |
| GET | `/api/admin/users?q=...&role=OWNER&page=1` | admin searchable, paginated user list |
| GET / PUT | `/api/admin/settings` | admin platform settings |
| GET | `/api/settings` | public settings used by the site and registration page |
| GET | `/api/auth/oauth/providers`, `/api/auth/oauth/:provider` | anyone (Phase 10; configured providers only) |

Admin platform settings control the displayed site name, whether new email/social accounts may be
created, and whether owner-submitted listings require moderation. To apply pending migrations to an
existing local database, run `npx prisma migrate dev` in `backend/`.

Administrators can upload a JPEG, PNG, or WebP profile picture (up to 2 MB) in Settings. Uploaded
profile pictures are stored under `backend/uploads/avatars`; keep this directory on persistent
storage when deploying the backend.

Frontend pages: `/login`, `/register`, `/forgot-password` (UI only), `/profile`, and the role-protected
`/admin`, `/owner`, and `/boarder` dashboards.

More detail: `docs/phase-3-notes.md`.

## Property listings (Phase 4)

Owners manage their own listings at `/owner/properties`. Every new or edited listing becomes
`PENDING` and is not public until an administrator approves it (see Phase 9 for the admin review
dashboard).

**Update steps after pulling Phase 4** (Windows CMD, in the `backend` folder). No new packages are needed.

```bat
npx prisma migrate dev --name add_properties   REM adds the property tables
npm run db:seed                                REM fills municipalities + amenities (safe to repeat)
npm run typecheck
npm test
```

Then **restart `npm run dev`** in the backend so it picks up the new Prisma client.
If you have not applied the Phase 3 migration yet, the same single command covers both phases.

> If the "Add Property" form says no municipalities were found, you skipped `npm run db:seed`.

**New API routes**

| Method | Path | Who |
|---|---|---|
| GET | `/api/locations`, `/api/amenities` | anyone (form options) |
| GET / POST | `/api/owner/properties` | owner (own listings only) |
| GET / PUT / DELETE | `/api/owner/properties/:id` | the owner of that listing |
| GET | `/api/admin/properties?status=PENDING` | admin (review queue) |
| PATCH | `/api/admin/properties/:id/status` | admin (approve / reject / deactivate) |

More detail: `docs/phase-4-notes.md`.

## Public property search (Phase 5)

Anyone can browse approved property listings at `/properties`. Filters include property name,
municipality, property type, minimum and maximum monthly price, availability, and amenities. Multiple
selected amenities must all match. Results can be sorted by newest or price and are paginated 12 per
page. The API applies these filters in Prisma/SQLite and never returns owner IDs or moderation fields.

The homepage search form links into the same public search and carries its location, type, and budget
selections into the URL. Search parameters are shareable/bookmarkable.

More detail: `docs/phase-5-notes.md`.

## Property details and map (Phase 6)

Each public search result links to `/properties/:id`. The public detail API only returns approved
listings and includes the listing description, images, amenities, room details, owner display name,
and coordinates when provided. It does not expose owner email, IDs, or moderation fields.

When both coordinates are available, the detail page shows a responsive Leaflet map using
OpenStreetMap tiles and a marker. If coordinates are missing, it displays the address and an
availability message instead. A property with invalid, missing, or non-approved ID returns a not-found
state.

Boarder inquiries are available on the detail page after login (Phase 7). Approved reviews and a
verified-owner badge for administrator-approved owner verification appear on the detail page. Private
owner contact and verification details are not exposed.

More detail: `docs/phase-6-notes.md`.

## Boarder features (Phase 7)

Boarders can save and remove approved listings, send inquiries to an owner, view inquiry statuses and
responses, submit one 1–5 star review per property for moderation, and report listings using the
supported report reasons. Boarder data is scoped to the authenticated boarder. Reviews and reports
start `PENDING`; they are not published or resolved automatically.

New boarder pages: `/boarder`, `/boarder/favorites`, `/boarder/inquiries`, `/boarder/reviews`,
`/boarder/reports`, and `/boarder/profile`. Property details include the boarder actions for favorites,
inquiries, reviews, and reports.

**Update steps after pulling Phase 7** (in `backend`):

```bat
npx prisma migrate dev --name add_boarder_features
npm run prisma:generate
npm run typecheck
npm test
```

The migration adds favorites, inquiries, reviews, and reports with uniqueness constraints and indexes.
The corresponding endpoints are protected by backend `BOARDER` role checks:

| Method | Path | Purpose |
|---|---|---|
| GET / POST / DELETE | `/api/boarder/favorites`, `/api/boarder/favorites/:propertyId` | List, save, and remove saved approved listings |
| GET / POST | `/api/boarder/inquiries` | View own inquiries and send an inquiry |
| GET | `/api/boarder/reviews` | View own submitted reviews and moderation statuses |
| POST | `/api/boarder/properties/:propertyId/reviews` | Submit a pending 1–5 star review |
| GET | `/api/boarder/reports` | View own reports and statuses |
| POST | `/api/boarder/properties/:propertyId/reports` | Submit a pending listing report |

More detail: `docs/phase-7-notes.md`.

## Owner dashboard and management (Phase 8)

Owners can view listing, inquiry, room, and approved-review statistics; manage individual room
names, capacities, prices, and availability; reply to or close inquiries; view reviews for their
properties; update their public display name and avatar URL; and submit identity verification for
review. Every endpoint is owner-role protected and scopes records to the authenticated owner.

Owner pages: `/owner`, `/owner/inquiries`, `/owner/reviews`, `/owner/profile`,
`/owner/verification`, and `/owner/properties/:propertyId/rooms`. Room inventory updates also
synchronize the property-level available-room count and availability.

**Update steps after pulling Phase 8** (in `backend`):

```bat
npm run prisma:migrate
npm run prisma:generate
npm run typecheck
npm test
```

The migration adds owner verification records. Verification documents are stored as HTTPS URLs;
the app does not upload or fetch them. Keep document links private. Submissions remain pending until
administrator review is added in Phase 9.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/owner/dashboard` | Owner-scoped dashboard statistics |
| GET / PATCH | `/api/owner/inquiries`, `/api/owner/inquiries/:inquiryId` | List, respond to, or close own inquiries |
| GET | `/api/owner/reviews` | List reviews on own properties |
| PATCH | `/api/owner/profile` | Update public name and avatar URL |
| GET / POST | `/api/owner/verification` | View or submit own verification details |
| GET / POST | `/api/owner/properties/:propertyId/rooms` | List or add rooms to an owned property |
| PUT / DELETE | `/api/owner/rooms/:roomId` | Update or delete a room on an owned property |

More detail: `docs/phase-8-notes.md`.

## Admin dashboard and moderation (Phase 9)

The admin dashboard summarizes users, listings, and pending moderation queues. Admins can approve,
reject, or deactivate properties; approve or reject boarder reviews; resolve or reject property
reports; and approve or reject owner identity verification. Rejections that need explanation require
a reason. These APIs enforce the `ADMIN` role on the backend.

Admin pages: `/admin`, `/admin/properties`, `/admin/reviews`, `/admin/reports`, and
`/admin/verifications`. Approved reviews appear on public listing details. Only an administrator-
approved owner verification displays a public verified-owner badge; identity details and document
links remain private to the owner and admins.

Phase 9 requires no schema migration or new package. After pulling, run the standard backend typecheck
and tests and build the frontend.

More detail: `docs/phase-9-notes.md`.

## Social sign-in (Phase 10)

Google and Facebook sign-in use authorization-code redirects and the existing server-side session
cookie. Provider buttons appear on login and registration only when that provider has valid
credentials configured. OAuth-created users receive the selected public account type (OWNER or
BOARDER); ADMIN accounts cannot be created through social sign-in. Existing users with a matching
provider-verified email can use that identity to sign in, and the OAuth identity is linked to their
existing account.

Set provider credentials in `backend/.env` and register the exact callback URLs with each provider:

```text
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/oauth/google/callback
FACEBOOK_CALLBACK_URL=http://localhost:4000/api/auth/oauth/facebook/callback
```

Use HTTPS callback URLs in production. Google must return a verified email; Facebook sign-in
requires the `email` permission and a profile email. If either provider does not return an email,
sign-in is rejected. OAuth state is kept in a short-lived, HTTP-only cookie and checked on callback.
Provider secrets remain server-side. See `backend/.env.example` and
`docs/phase-10-notes.md` for provider setup and route details.

No database migration or new package is required. OAuth identities use the existing
`OAuthAccount` model.

## Useful commands

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | Start API with auto-restart |
| backend | `npm run typecheck` | Check TypeScript without building |
| backend | `npm test` | Run authentication and property integration tests |
| backend | `npm run db:seed` | Seed municipalities and amenities, and create the first admin if set in `.env` |
| backend | `npm run build` | Compile to `backend/dist` |
| backend | `npm run prisma:migrate` | Apply schema changes to the database |
| backend | `npm run prisma:studio` | Browse the database in your browser |
| frontend | `npm run dev` | Start the dev server |
| frontend | `npm run build` | Type-check and build for production |

## Environment files

- `backend/.env.example` and `frontend/.env.example` are templates and are committed to Git.
- Your real `.env` files are listed in `.gitignore` and must never be committed.
- Anything in the frontend `.env` is visible in the browser. Never put secrets there.

## Troubleshooting

- **"Missing required environment variable DATABASE_URL":** you forgot `cp .env.example .env`.
- **Frontend says it cannot reach the backend:** make sure `npm run dev` is running in `backend/`.
- **Port already in use:** change `PORT` in `backend/.env` (and the proxy target in
  `frontend/vite.config.ts`).

## Roadmap

Later phases (not started): image uploads (Cloudinary) and other planned platform features.
