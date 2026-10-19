# Role Panels (Admin / Owner / Boarder)

Each role now has its own dashboard shell (sidebar + top bar) instead of sharing the public website
layout. The public pages (home, search, login, register) keep the normal Navbar/Footer layout.

## How it works
- `components/layout/PanelLayout.tsx` is the shell. It reads the logged-in user's role and builds the
  sidebar from `lib/panelNav.ts`.
- `router.tsx` has three panel groups. Each is `ProtectedRoute(role)` -> `PanelLayout` -> pages.
- Existing pages were not edited: they already bring their own width/padding.
- Unknown URLs inside a panel (e.g. `/admin/xyz`) show the 404 page without leaving the panel.

## Sidebar menus
| Panel | Items |
|---|---|
| Admin (dark slate) | Dashboard, Listings, Users*, Reviews, Reports, Verifications, Export Database*, Settings* |
| Owner (deep green) | Dashboard, My Properties, Inquiries, Reviews, Verification, Payments*, Profile, Settings* |
| Boarder (light) | Dashboard, Find a Place, Favorites, Inquiries, My Reviews, My Reports, Profile |

`*` = placeholder page ("Coming soon"); the feature itself is not built yet.

## Adding a page to a panel
1. Add the route in `router.tsx` inside that role's `PanelLayout` group.
2. Add an item in `lib/panelNav.ts`.

## Notes
- Route guards only control what the UI shows. The backend still enforces roles on every API call.
- Boarder "Find a Place" reuses the public search page at `/boarder/find-place`. Filtering stays in
  the panel; opening a listing goes to the public detail page (`/properties/:id`).
- **Export Database** deserves its own design before it is built: a raw dump would include emails and
  password hashes, so it should export selected, non-sensitive data only, be admin-only, and be logged.
- **Payments** was explicitly out of scope in earlier phases and needs a decision on how money
  moves (e.g. GCash/bank transfer records vs. an online payment provider).
