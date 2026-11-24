# CASIA Structure and Fix Audit

## Confirmed changes in this delivery

- Reorganized the frontend into the requested Admin, Student, Shared, and root entry-point folders.
- Reorganized backend startup, config, middleware, and API route files under `backend/src/`.
- Grouped API routes by feature (auth, products, inventory, sales, categories, dashboard, restocking, analytics, insights, student). Each route module now wires controller handlers extracted into corresponding `*.controller.js` files.
- Added a `*.service.js` per database-backed feature. These provide the shared PostgreSQL pool, parameterized query helper, and transaction wrapper. Existing SQL statements remain in some controller handlers; the services are a service/data-access boundary rather than a complete business-query extraction.
- Updated server-side static serving, frontend page paths, admin navigation, login/logout redirects, password recovery links, and Student breadcrumbs to match the new structure.
- Added central Express app and error middleware; added shared validation and response/logger utilities for future consistent use.
- Moved the initial database schema to `database/schema.sql` and put remaining migrations under `database/migrations/`.
- Added `products.html` and `users.html` redirect shortcuts because the source had combined Sales/Product Management and Analytics/Customer Management rather than separate pages.
- Removed student/login stylesheet references to non-existent `casia-bg.svg` assets and retained the existing color palette.
- `.gitignore` excludes `node_modules/` at any nesting level and `.env` secrets while retaining `.env.example`.

## Source-backed findings / not implemented as database features

- Favorites, ratings, reviews, helpful votes, and watch lists are localStorage-backed; no database tables/API implementation was present for these actions.
- No separate Admin Products or Admin Users CRUD pages were present in the source. The new links are redirects to existing pages.
- Some feature-specific SQL remains inside controller handlers; a future deeper service-layer pass could move each query and business operation fully into the matching feature service. The current extraction separates Express route wiring from request handlers and provides per-feature database service boundaries.
- Student `home` catalogue reads use `/api/student/catalog`; DB table/column availability must be checked on the actual Supabase project.

## Validation completed

- `node --check` passed for all 70 frontend/backend JavaScript files.
- All 24 HTML pages parsed and all local `href`/`src` references resolved.
- All local CSS `url()` assets and stylesheet imports resolved.
- Local CommonJS `require()` paths resolved in static checks.
- All 11 route files point to existing controller functions; 10 feature services are present (the two auth route groups share one auth service).
- `package.json` and `package-lock.json` dependency declarations match.
- ZIP manifest checked to exclude `node_modules/`, `.env`, and real credentials.

## Installation/runtime verification limitation

An `npm ci --ignore-scripts --no-audit --no-fund` attempt in this environment timed out while fetching dependencies, so a live Express startup could not be completed here. Run `npm install` locally from `backend/` before launching the system. No Supabase credentials or live database were available for connection/migration tests.

## Not verified in this environment

- Live PostgreSQL/Supabase connection and migration execution.
- Supabase Auth email confirmation, password reset emails, cookies, and redirect behavior in a real browser.
- Complete browser clicking of every button/form, due the absence of a live browser session with your configured Supabase project.
- End-to-end sale recording and inventory updates against your live data.

## Database action required

Follow `docs/DATABASE_SETUP.md`. On an existing database, do not rerun `database/schema.sql`; inspect which migrations have already been applied and run only missing migration(s).


## Multi-branch / staff access extension (latest update)

- Added branch-scoped inventory, sales, restocking, and inventory-history migration in `database/migrations/003_multi_branch_staff_access.sql`. Existing records are assigned to a single Main Branch per business; unassignable records cause the migration to stop instead of being guessed.
- Added Business Owner Branch Management, an owner top-navigation selector, branch-aware inventory/restocking, branch-filtered reports, and an all-branches Main Dashboard with a branch performance summary.
- Moved the inventory-by-product visualization to Reports & Visualizations. The Main Dashboard remains a business-wide summary and does not become branch-filtered.
- Owner Sales page is product management only (add/delete products); Staff Sales Workspace contains cart, quantity adjustment, total computation, and checkout.
- Staff uses the business registration access code and chooses an active branch. The backend creates an eight-hour HTTP-only session pinned to that branch.
- Staff sales use one internal Shared Cashier profile per business. Sales are tagged to the selected branch but not an individual human cashier; this is a known attribution limitation.
- Strengthened staff-session joins to ensure the cashier profile and selected branch belong to the same business. The Main Branch is protected against deactivation at both UI and API layers.

### Latest static verification

- `node --check` passed for all 75 JavaScript files under `frontend/` and `backend/src/`.
- Backend startup syntax check passed.
- 26 HTML pages parsed successfully.
- All local HTML `href` and `src` references resolved (0 missing).
- No `node_modules/` directory and no real `.env` file are included in the delivery archive.

### Live verification not performed

The migration has not been executed against the user's live Supabase database in this environment. End-to-end tests for staff code entry, branch separation, sales stock deductions, report totals, and existing Admin/Student sign-in must be completed locally after applying migration 003.
