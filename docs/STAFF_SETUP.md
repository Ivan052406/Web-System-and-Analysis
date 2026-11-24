# CASIA Staff / Cashier Access (Shared Code + Branch Selection)

## How staff access works

Staff do **not** sign in with an individual email and password. On the unified CASIA login page, choose **Staff Login**, enter the shared business access code that the Business Owner created during business registration, select an active branch, and open the Sales Workspace.

The same business access code is verified by the backend using the business's HMAC fingerprint and bcrypt hash. It is never compared or stored in browser JavaScript. After a valid code and branch are confirmed, CASIA creates an opaque, random, eight-hour session token. Only the SHA-256 token digest is stored in `public.staff_access_sessions`; the raw token is sent in an HTTP-only, SameSite=Lax cookie.

The session is locked to exactly one active branch. Changing the branch after sign-in requires staff to log out and enter the code/select another branch. Deactivating a branch revokes its active staff sessions.

## Staff permissions

Staff can:
- View active products and categories for the business.
- View stock for the selected branch.
- Build and edit an unsaved checkout cart (add/remove items, plus/minus quantity, clear cart).
- Complete a sale. The backend validates business ownership, product status, selected-branch stock, and saves sale, sale items, stock deduction, and inventory history in one transaction.
- View the staff session's current business and branch.
- Log out.

Staff cannot:
- Open Business Owner pages or APIs.
- Add, edit, deactivate, or delete products/categories.
- Access inventory adjustment, stock management, suppliers, restocking, or inventory history APIs.
- Access the owner Dashboard, Reports & Visualizations, or Demand & Restock Insights.
- Select another branch by changing a request header or URL. The session is pinned to the branch selected at entry.
- Access the Student catalog or student-only APIs.

These restrictions are enforced by server-side route guards and the branch-bound session, not just by hiding buttons.

## Business Owner responsibilities

- Keep the business access code private and share it only with authorized cashiers.
- If the code is disclosed to an unauthorized person, update the business access code through the supported owner registration/access-code management flow when available. Until a dedicated rotation UI is available, do not distribute the code broadly.
- Create and deactivate branches in **Branch Management**.
- Record each branch's opening stock separately through Restocking after creating a new branch.
- Choose a specific branch for Inventory and Restocking. Choose a specific branch or **All Branches (Reports)** for Reports & Visualizations.

## Important limitation: shared cashier identity

This implementation uses one internal `Shared Cashier` profile per business to associate cashier-created sales with that business. It does **not** identify the individual human cashier who made each sale. Every person using the shared code is effectively using the same cashier identity. If individual cashier accountability is required, use a separate per-cashier PIN or named staff account design in a later phase.

## Required database objects

Apply `database/migrations/003_multi_branch_staff_access.sql` after migrations 001 and 002. It creates:
- `public.branches`
- `branch_id` columns and constraints on `inventory`, `sales`, `restocks`, and `inventory_history`
- a unique `(branch_id, product_id)` inventory index
- one internal Shared Cashier profile per business
- `public.staff_access_sessions`

See `docs/MULTI_BRANCH_SETUP.md` and `docs/DATABASE_SETUP.md` before applying the migration.

## Staff login steps

1. Open `http://localhost:3000/student/pages/login.html`.
2. Select **Staff Login**.
3. Enter the shared business access code supplied by the Business Owner.
4. Click **Find Available Branches**.
5. Choose the branch where you are working.
6. Click **Open Sales Workspace**.
7. Process sales in the staff workspace. Log out at the end of the shift.

## Testing checklist

- [ ] Staff code lookup only returns branches of the matching active business.
- [ ] Staff must choose an active branch before the session is created.
- [ ] Staff workspace shows the selected branch.
- [ ] Staff can complete a sale and only the selected branch's stock decreases.
- [ ] Staff receives HTTP 403 for owner product/category mutations, inventory, restocking, owner dashboard, analytics, and insights APIs.
- [ ] Deactivating the selected branch revokes active sessions for that branch.
- [ ] Staff cannot change branches through a request header; a new session is required.
- [ ] Business Owner login still uses email, password, and the business access code.
- [ ] Student login remains a Supabase Auth email/password flow.

Live access-code verification and branch sales must be tested against the user's Supabase database after migration 003 is applied.
