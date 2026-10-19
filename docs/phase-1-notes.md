# Phase 1 Notes: Project Foundation

## Goal
Working skeleton: React frontend, Express backend, Prisma + SQLite, and health checks.
No product features yet.

## Decisions
| Decision | Reason |
|---|---|
| Prisma 6 (not 7) | Prisma 7 changes configuration (`prisma.config.ts`, required driver adapters). v6 keeps the standard `schema.prisma` setup, which is simpler for beginners. |
| Express 4 | Most tutorials and `@types/express` match it. Stable and well documented. |
| CommonJS output in backend | Avoids ESM import-extension issues. `tsx` runs TypeScript directly in development. |
| Tailwind CSS v4 via `@tailwindcss/vite` | No `tailwind.config.js` or PostCSS needed. One line in `index.css`. |
| Vite dev proxy for `/api` | The frontend calls `/api/...` and Vite forwards to the backend, so no CORS trouble in development. |
| `SystemCheck` placeholder model | Prisma needs at least one model to create the first migration and the database file. Real models (User, Property, ...) arrive in later phases. |

## Backend layout (ready to grow)
- `src/config/` environment loading
- `src/lib/` shared helpers (Prisma client)
- `src/middleware/` error handling, 404
- `src/routes/` one file per feature, mounted in `routes/index.ts`

Later phases add `controllers/`, `services/`, and `validators/` (Zod) beside these.

## Frontend layout
- `src/pages/` route-level screens
- `src/components/` reusable UI (`layout/` holds the shell)
- `src/hooks/` reusable logic
- `src/lib/` API helper
- `src/types/` shared TypeScript types
