# CASIA Staff Access and Sales-Only Changelog

## Current behavior: shared code + branch selection

The earlier individual email/password Staff Login design has been replaced. Staff now:
1. Selects **Staff Login** on the unified login page.
2. Enters the business access code created during business registration.
3. Loads the available active branches for that business.
4. Selects the branch for the current shift.
5. Receives an eight-hour branch-locked cashier session and enters `/admin/pages/staff-dashboard.html`.

The access code is checked by the backend against the business HMAC fingerprint and bcrypt hash. The raw session token is stored only as a SHA-256 digest in `public.staff_access_sessions`; the token itself is sent as an HTTP-only cookie. Failed code attempts are rate-limited in the application process.

## Staff sales-only permissions

Staff can view products and categories for their business, see stock for the selected branch, build a cart, adjust order quantities, and complete sales. The backend validates product ownership, active status, stock availability at the session branch, and records the sale, line items, inventory deduction, and inventory history transactionally.

Staff is not permitted to access owner-only product/category changes, inventory maintenance, supplier/restocking, owner dashboard, Reports & Visualizations, Demand & Restock Insights, branch management, or student APIs. Branch context comes from the validated server session, not a caller-supplied header.

## Business Owner and Student behavior

- Business Owner retains Supabase email/password plus the registered business access code.
- Student retains Supabase email/password and the student dashboard flow.
- Staff uses the business shared code and branch selector; staff does not need an individual Supabase Auth email/password account.

## Sales and product management separation

- Owner `frontend/admin/pages/sales.html` is product management only: add and delete products. It has no cart or checkout controls.
- Staff `frontend/admin/pages/staff-dashboard.html` is the checkout workspace with cart, plus/minus quantity, order computation, and Complete Sale.

## Files/features added or changed

- Added `database/migrations/003_multi_branch_staff_access.sql`.
- Added branch API module under `backend/src/modules/branches/`.
- Added shared-code staff session logic under `backend/src/modules/staff/`.
- Updated auth middleware to validate staff sessions and pin each session to an active branch.
- Updated products, sales, inventory, restocking, dashboard, analytics, and insights queries to be branch-aware.
- Added `frontend/admin/pages/branches.html`, `frontend/admin/css/branches.css`, and `frontend/admin/js/branches.js`.
- Added the Owner branch selector to shared navigation.
- Changed the Main Dashboard to an all-branches business summary with branch performance.
- Moved the inventory visualization from Dashboard to Reports & Visualizations.
- Updated Student catalogue stock display to aggregate active-branch inventory without duplicating products.
- Updated staff login UI to use business access code + branch picker.

## Important limitation

The business access code is shared. All cashiers using it are attributed to one internal Shared Cashier profile per business. The system records the branch but cannot identify the individual cashier. Implement individual PINs or named staff profiles in a future phase if employee-level accountability is required.

## Verification limitations

Static JavaScript/HTML/asset/route checks can be run locally, but Supabase database migration, staff code authentication, cross-branch sales isolation, and actual stock movements must be tested against the user's Supabase project. Do not claim these live tests passed solely from static checks.
