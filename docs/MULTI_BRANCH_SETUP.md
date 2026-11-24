# CASIA Multi-Branch Setup and Behavior

## Overview

CASIA now supports multiple branches for each business. Branch is the reporting and inventory unit:

- Each branch has its own stock quantity for each business product.
- Each sale, restock, and inventory-history row is assigned to one branch.
- Staff enters the business access code, chooses an active branch, and receives a short-lived session pinned to that branch.
- The Business Owner can switch branch context from the top branch selector.
- The Main Dashboard is always an all-branches business overview.
- Reports & Visualizations can show a selected branch or aggregate all active branches.
- Inventory and Restocking require one specific branch to be selected.

## Database migration

### Existing CASIA database

1. Back up your Supabase database first.
2. Confirm that migration 001 (`001_business_auth_inventory_patch.sql`) and migration 002 (`002_student_role_and_sequence_fix.sql`) have already been applied.
3. Run `database/migrations/003_multi_branch_staff_access.sql` **once** in Supabase SQL Editor.
4. Review the result. If it raises an exception about unassigned rows, the migration intentionally stops rather than guessing which branch owns those records. Inspect the named tables, determine the correct business/branch, update those records, then retry the migration.
5. Verify the new branch and migrated data using the queries below.

Do not rerun `database/schema.sql` on an existing database. Do not rerun migration 003 after a successful application.

### What migration 003 does

- Creates `public.branches`.
- Creates a `Main Branch` for every existing business that does not yet have a branch.
- Adds `branch_id` to `inventory`, `sales`, `restocks`, and `inventory_history`.
- Assigns existing inventory based on each product's business.
- Assigns existing sales using the selling user's business; if the legacy user has no business assignment, the migration attempts to infer a single business from all products on the sale. It stops if ownership is ambiguous.
- Assigns restocks and inventory-history rows using the related product's business.
- Replaces the old one-stock-row-per-product uniqueness with one stock row per branch/product pair.
- Creates zero-quantity inventory rows for existing products in any branch where that product has no row. It does not duplicate the old stock quantity into new branches.
- Creates one internal Shared Cashier profile per business and the `staff_access_sessions` table.

### Verify migration results

```sql
SELECT branch_id, business_id, branch_name, status
FROM public.branches
ORDER BY business_id, branch_id;

SELECT br.business_id, br.branch_name, COUNT(*) AS inventory_rows,
       COALESCE(SUM(i.quantity), 0) AS stock_units
FROM public.branches br
LEFT JOIN public.inventory i ON i.branch_id = br.branch_id
GROUP BY br.business_id, br.branch_id, br.branch_name
ORDER BY br.business_id, br.branch_id;

SELECT 'inventory' AS table_name, COUNT(*) AS unassigned
FROM public.inventory WHERE branch_id IS NULL
UNION ALL
SELECT 'sales', COUNT(*) FROM public.sales WHERE branch_id IS NULL
UNION ALL
SELECT 'restocks', COUNT(*) FROM public.restocks WHERE branch_id IS NULL
UNION ALL
SELECT 'inventory_history', COUNT(*) FROM public.inventory_history WHERE branch_id IS NULL;
```

Expected: the `unassigned` count is zero for all four tables.

## Branch management

Business Owners open **Branch Management** from the shared navigation and can create branches, view branch addresses/status, and deactivate/reactivate branches. A new branch receives one zero-stock row for each existing business product. The Owner must record its opening stock through Restocking after selecting that branch.

The seeded `Main Branch` is protected from deactivation in the current interface so each business retains a primary active branch.

## Owner navigation and reporting

The top navigation branch selector has two types of selection:

- **All Branches (Reports):** used by Reports & Visualizations to aggregate branch data. The Main Dashboard remains all-branches regardless of this selector.
- **A named branch:** scopes branch-aware pages (for example product stock display, Inventory, and Restocking) to that branch. Inventory and Restocking do not allow an all-branches selection because stock must be adjusted against one location.

The Main Dashboard summarizes the business across active branches and includes a branch-performance table. The former inventory graph is on **Reports & Visualizations** with the other charts and branch comparison.

## Staff access

Staff uses the business access code created when the Business Owner registered the business. The code is checked server-side against an HMAC fingerprint and bcrypt hash. Staff then selects an active branch for the shift. The session is an HTTP-only cookie, expires after eight hours, and is stored server-side as a SHA-256 token digest. The session cannot change its branch context by editing the browser's request headers.

The shared business access code gives the cashier access to every active branch in that business. Branch selection decides the branch for that particular session. Share the code only with authorized cashiers.

**Attribution limitation:** sales from all people using the shared code are recorded against one internal Shared Cashier profile per business. Individual cashiers are not distinguished. A later per-cashier PIN/account feature is needed for individual cashier performance reporting.

## Sales and product management

- Business Owner's **Sales** page is now **Product Management** only: add products and delete products. It has no cart, quantity plus/minus, checkout, or sale completion controls.
- Staff's **Sales & Checkout** workspace contains product selection, cart, plus/minus/remove quantity controls, total calculation, and Complete Sale.
- Products are shared by a business across its branches; stock is branch-specific.
- Creating a product creates a zero-stock inventory row in every active branch.
- Completing a sale decrements only the selected staff branch's inventory.

## Environment configuration

Keep existing database/Supabase values in `backend/.env`. `ACCESS_CODE_PEPPER` must be a long random secret and must remain unchanged after the business access-code fingerprints are created; changing it will invalidate those fingerprints until the codes are re-saved/re-hashed.

```env
DATABASE_URL=your_supabase_postgresql_connection
PORT=3000
APP_URL=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
ACCESS_CODE_PEPPER=your_long_random_secret
```

Do not commit `.env` or expose Supabase service-role credentials in frontend code.
