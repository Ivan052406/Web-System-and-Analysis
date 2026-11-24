# CASIA Restructure Changelog

## Structure changes

- Moved admin pages into `frontend/admin/pages/`, styles into `frontend/admin/css/`, and scripts into `frontend/admin/js/`.
- Moved Student pages into `frontend/student/pages/`, styles into `frontend/student/css/`, scripts into `frontend/student/js/`, and retained visual assets in `frontend/student/assets/`.
- Moved the unified User/Admin login and password recovery pages into the Student pages area to match the requested tree; updated all relevant links and redirects.
- Moved shared Admin navigation markup and CSS into `frontend/shared/components/` and `frontend/shared/css/`; the page initializer is in `frontend/admin/js/admin-layout.js`. Added shared browser helpers (`api.js`, `utils.js`, `validation.js`) under `frontend/shared/js/`.
- Added `frontend/index.html` as the root entry point.
- Moved backend startup/configuration/middleware/routes into `backend/src/`; grouped routes by feature and extracted each Express request callback into a matching `*.controller.js` file.
- Added per-feature `*.service.js` data-access modules that expose the PostgreSQL pool, query helper, and transaction helper; feature-specific SQL is still present in some controllers and can be moved into these services in a later focused refactor.
- Shared Admin navigation initialization is `frontend/admin/js/admin-layout.js`; shared browser API, utility, and validation helpers are in `frontend/shared/js/`.
- Added `app.js`, a central module router, environment loader, error middleware, reusable validation middleware, and response/logger helpers.
- Moved the initial SQL schema to `database/schema.sql` and renumbered the two migrations after it.
- Kept the root `.gitignore` configured to exclude nested `node_modules`, secrets, log files, and caches.

## Functional/path updates

- Updated Express static serving and startup to use `backend/src/server.js` and `backend/src/app.js`.
- Updated Admin route references, shared navigation asset paths, and Student entry/return links to the new folder layout.
- Updated student logout and login redirects to the new unified login page.
- Created compatibility shortcuts: Products opens the existing Sales/Product Management page; Users opens the existing Analytics/Customer Management page. These are redirects, not new independent features.
- Removed references to missing login/student background SVG assets and retained solid/gradient backgrounds from the existing design palette.

## Preserved behavior and known limitations

- Existing HTML/CSS and vanilla JavaScript interface retained; no framework migration.
- Existing feature-specific SQL statements remain in several controller functions; service modules currently establish a database access boundary and transaction helper rather than containing every business query.
- Student favorites/ratings/reviews/helpful votes/availability watchlists remain in browser localStorage; they are not database-synchronized.
- No source-backed independent Admin Products or Users page existed; no fake CRUD screens were created.
- No database sample seeder was included because no safe demo rows/credentials were supplied.


## Multi-Branch, Staff Shared-Code Access, and Report Layout

See `MULTI_BRANCH_SETUP.md`, `STAFF_SALES_ONLY_CHANGELOG.md`, and `STAFF_SETUP.md` for the branch migration, branch-bound staff sessions, owner top navigation selector, all-branch Main Dashboard, branch-filtered reports, and the separation between owner product management and staff checkout.

## Structure correction — requested frontend layout

- Kept only `frontend/admin/`, `frontend/student/`, and `frontend/shared/` as top-level frontend areas.
- Moved the Staff cashier page and stylesheet into `frontend/admin/pages/staff-dashboard.html` and `frontend/admin/css/staff-sales.css`; Staff remains a separate backend role with server-checked permissions.
- Updated Student login and Staff API redirects to the new cashier page location.
- Moved `.env.example` to the project root to match the requested structure; the backend runtime configuration remains `backend/.env`.
- Changed `frontend/index.html` to use a relative Student login redirect so it works from both Express and VS Code Live Server.
- See `docs/STRUCTURE_CORRECTION.md` for the full path map and verification results.


## Admin / Staff combined login and Store Ratings directory
- Combined the former separate Admin and Staff login views into one Admin / Staff Login page with an inner Admin/Staff switch.
- Preserved Admin business sign-in and sign-up; Staff access still validates the shared business code and requires branch selection.
- Kept User Login separate.
- Added a business search field to Student Store Ratings and clarified the active-business catalog empty state.
- Confirmed the catalog query lists active businesses independently of their product count.
- New Business Owner registrations now create a default Main Branch in the same transaction, so Staff has a branch to choose.
- Added `ADMIN_STAFF_LOGIN_AND_BUSINESS_RATINGS.md` documentation.


## Combined Admin / Staff Login and Business Directory Search
- Replaced separate Admin and Staff top-level login tabs with two main choices: User Login and Admin / Staff Login.
- Added a compact Admin / Staff switch inside the shared management login view.
- Preserved Admin sign-in and business registration; the Staff mode continues to use the shared business access code and branch selection.
- Kept Student login and sign-up as a separate User Login flow.
- Added business search to Store Ratings; active businesses from the database catalog are listed even before they add products.
- Updated the empty-state copy to explain that active Business Owner registrations appear in the Student business directory.
- New Business Owner sign-ups now create a default Main Branch in the same database transaction.
- Fixed the password visibility icon toggle in the login script.
- Added documentation at `docs/ADMIN_STAFF_LOGIN_AND_BUSINESS_RATINGS.md`.

## Admin / Staff login consolidation and business search visibility
- Consolidated Admin and Staff into the Admin / Staff Login view with an internal mode switch.
- Added Staff branch selection to that same page, after business access-code lookup.
- Kept Student login/registration as a separate User Login view.
- Added searchable registered businesses to Store Ratings using the existing authenticated Student catalog endpoint.
- Automatically creates a Main Branch when a Business Owner registers a new business.
- Added `docs/ADMIN_STAFF_LOGIN_AND_BUSINESS_RATINGS_AUDIT.md`.


## Authentication stability repair

- Replaced the generic cookie parser/serializer in the Supabase SSR Express adapter with `parseCookieHeader` and `serializeCookieHeader` from `@supabase/ssr` to support chunked auth cookies consistently.
- Admin navigation redirects to the combined Admin/Staff login with the Admin option selected only on authentication/authorization failures; server errors are no longer misreported as an expired login.
- Added `database/migrations/004_auth_login_repairs.sql` to fix legacy `users_role_check` restrictions that block Student profile creation and to make the legacy `password` field nullable.
- Improved safe diagnostic logging for Admin/Student auth and recovery email failures without logging credentials or tokens.
- Corrected password-recovery callback destinations and preserved the Admin login selection through the recovery flow.
- Documented the required Supabase Custom SMTP and Auth redirect URL configuration.
