# CASIA Admin / Staff Login and Business Ratings Update

## Implemented

1. The main login selector now has only **User Login** and **Admin / Staff Login**.
2. Admin / Staff Login contains a compact inner switch:
   - **Admin** opens the existing Business Owner sign-in and business registration form.
   - **Staff** opens the shared business access-code form.
3. Staff branch selection stays on the same login page. Staff enters the access code, clicks **Find Available Branches**, selects an active branch, and opens the Sales Workspace.
4. Student login and registration remain in the separate User Login section.
5. The login script now opens Staff mode for `?role=staff` and Admin mode for `?role=admin`.
6. Fixed the password/access-code visibility icon class toggle.
7. Styled the staff branch lookup button and branch selector so they fit the combined login view.
8. Store Ratings now has a search field for registered business name/location.
9. The Student catalog query returns every active row from `public.businesses` separately from the products query. A business therefore appears in Search Store, Store Directory, and Store Ratings even when it has not created any products yet.
10. New Business Owner registration now creates an active `Main Branch` in the same database transaction as the business and owner profile. This ensures the new owner can immediately use branch selection for staff access.
11. Updated README, changelog, and this report.

## Database requirements

No new SQL migration was added for this change. The existing CASIA migrations 001, 002, and 003 must already be applied. Migration 003 creates `public.branches` and the unique `(business_id, branch_name)` constraint used when new Owner registrations create their Main Branch.

For existing businesses, migration 003 should already have created the Main Branch. Do not rerun the schema or existing migrations just for this UI/code change.

## Important behavior / limitation

- Store Ratings uses the active business list returned by `/api/student/catalog` and is available to authenticated Student accounts.
- This update makes registered businesses visible and searchable in Store Ratings. The pre-existing student ratings/reviews/favorites implementation still stores rating/review activity in browser `localStorage`; ratings are not yet persisted to PostgreSQL or shared across devices.
- A business must have `status = 'active'` to appear in Student listings.
- Staff access still uses the business shared access code. Branch selection is validated by the backend against that business, and the resulting staff session is locked to the selected branch.

## Static verification

- 75 JavaScript files passed `node --check`.
- 26 HTML pages parsed successfully.
- No duplicate IDs or nested forms found in checked HTML pages.
- All relative local script, stylesheet, and image references resolved.
- Combined login DOM check confirmed a two-option top selector, inner Admin/Staff switch, Admin sign-up/sign-in, Staff access code, and branch selector.
- Catalog/Store Ratings static check confirmed active businesses are returned independently of product count and displayed in the searchable ratings list.
- ZIP integrity test passed.
- `node_modules` and real `.env` are excluded; `.env.example` is included.

## Not verified in this environment

A live browser walkthrough and live Supabase sign-in / database requests were not performed. After extracting, copy/configure `backend/.env`, ensure migrations 001-003 have already been applied, run `npm install` in `backend`, then `npm start`. Test Admin signup/login, Staff code + branch selection, Student login, and Store Ratings using an active business created by an Owner.
