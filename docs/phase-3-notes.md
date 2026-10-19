# Phase 3 Notes: Authentication

## How login works
1. `POST /api/auth/login` checks the password, creates a **session** row, and sends the browser a
   random token in an **httpOnly, SameSite=Lax cookie** (`Secure` in production).
2. The database stores only a **SHA-256 hash** of that token. A leaked database cannot log anyone in.
3. Every protected request: cookie -> hash -> session row -> user. Expired sessions are deleted.
4. `POST /api/auth/logout` deletes the session row, so the old cookie stops working immediately
   (unlike a plain JWT, which stays valid until it expires).

## Decisions
| Decision | Reason |
|---|---|
| Server-side sessions, not JWT | Real logout/revocation, no token in JavaScript, no JWT library. |
| Node's built-in `scrypt` | Strong memory-hard hash, zero extra packages, no native build problems on Windows. Parameters live inside each stored hash so they can be raised later. |
| `zod` for validation | Already planned for the project; one schema validates and cleans input (trim, lowercase email). |
| Role strictly per area | `/admin` = ADMIN only, `/owner` = OWNER only, `/boarder` = BOARDER only. Simple to reason about; loosen deliberately later if needed. |
| Admins via `npm run db:seed` | A public endpoint must never be able to create an admin. |
| Same message for unknown email / wrong password | Prevents discovering which emails are registered (a dummy hash keeps timing similar). |
| `publicUserSelect` | Responses use an explicit field allowlist, so `passwordHash` is never loaded for responses. |
| `OAuthAccount` table + `/api/auth/oauth/*` routes | Google/Facebook sign-in was implemented in Phase 10 using this provider identity table. |

## Frontend route protection is only UX
`ProtectedRoute` hides pages. The **backend middleware** (`requireAuth`, `requireRole`) is the real
security boundary.

## Known limitations (not done in this phase)
- No login rate limiting / account lockout (add before public launch).
- No email verification or password reset (the Forgot Password page is a UI placeholder).
- Registering reveals whether an email is already taken (normal trade-off; needed for a clear error).
- Sessions are not listed/revocable per device yet.
- Cookie-based auth assumes the frontend and API share a site (the Vite proxy does this in development).
