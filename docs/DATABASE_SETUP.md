# CASIA Database Setup

This guide is for the reorganized CASIA project. All SQL files are under `database/`. The backend uses `pg` to connect to Supabase PostgreSQL and Supabase Auth for identity/session handling.

## Before running SQL

1. Open your Supabase project and select **SQL Editor**.
2. Back up the database before applying changes to an existing project.
3. Determine whether this is a fresh database or an existing CASIA database. Do not run a fresh schema on top of existing production data.

## Fresh database

Run in this order:

1. `database/schema.sql`
2. `database/migrations/001_business_auth_inventory_patch.sql`
3. `database/migrations/002_student_role_and_sequence_fix.sql`
4. `database/migrations/003_multi_branch_staff_access.sql`

Review the migration SQL before execution. If the patch reports that an object already exists or does not match the current schema, stop and compare the live table definitions rather than forcing it.

## Existing CASIA database

Do not rerun `schema.sql`. Inspect whether migrations 001 and 002 have already been applied. Apply only the missing migration(s), in order. For an existing CASIA database where 001 and 002 are already applied, back up first and then apply `003_multi_branch_staff_access.sql` once. This migration creates Main Branch records and assigns existing stock/sales/restocks/history to branches; it does not duplicate existing stock into new branches. If you previously ran the old filenames `002_business_auth_inventory_patch.sql` or `003_student_role_and_sequence_fix.sql`, those are the same migration contents under the reorganized names; do not execute them twice.

## Important schema requirements

- `public.users` must include `auth_user_id` referencing the Supabase Auth user identity, a `role` that accepts `admin`, `staff`, and `student`, an active/inactive `status`, and `business_id` for store-owner/staff scoping.
- Student profiles use `role = 'student'` and may have `business_id = NULL`.
- Supabase Auth stores passwords. The CASIA profile table must not require a separate plaintext password for Supabase-managed accounts. The student migration adjusts the legacy profile password column to nullable where the source schema required it.
- Store/product/inventory catalogue queries require the `businesses`, `products`, `categories`, and `inventory` tables and the columns referenced by `backend/src/modules/student/student.routes.js`.
- Sales and inventory features require their related history/transaction tables, foreign keys, and business ownership values. Existing products and stock records must have valid business IDs before using those features.
- Multi-branch operations require `public.branches` and `branch_id` on `inventory`, `sales`, `restocks`, and `inventory_history`; migration 003 creates these.
- Shared staff-code access requires `public.staff_access_sessions` and one internal Shared Cashier profile per business; migration 003 creates them.

## Verify current data before use

Run read-only checks in Supabase SQL Editor:

```sql
SELECT role, status, COUNT(*)
FROM public.users
GROUP BY role, status
ORDER BY role, status;

SELECT COUNT(*) AS products_without_business
FROM public.products
WHERE business_id IS NULL;

SELECT COUNT(*) AS businesses_without_owner
FROM public.businesses
WHERE owner_user_id IS NULL;
```

The final query assumes the `owner_user_id` column exists in your schema; if it does not, inspect `public.businesses` columns first and skip that query. Do not assign business ownership automatically without confirming which store each record belongs to.

## Configure the backend

Copy `.env.example` to `backend/.env` and fill in:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
PORT=3000
APP_URL=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
ACCESS_CODE_PEPPER=GENERATE_A_LONG_RANDOM_SECRET
```

Use the Supabase PostgreSQL connection string from the project dashboard. Prefer the session pooler connection string if your local network cannot connect directly to the database. Keep credentials private. `ACCESS_CODE_PEPPER` is used for business access-code fingerprinting for both Business Owner and shared Staff access; use a long random value and keep it stable because changing it invalidates existing code fingerprints.

## Install and start

```bash
cd backend
npm install
npm start
```

The server tests the PostgreSQL connection before listening on the configured port. If it fails, check the `DATABASE_URL`, password URL encoding, SSL/network access, and whether Supabase permits the connecting IP.

## Features not persisted in PostgreSQL

Student favorites, ratings, reviews, review edits, helpful votes, and availability watch lists are still stored in localStorage. Database tables and authenticated API endpoints for these features are not included in the supplied schema.


For branch migration, staff code access, new branch stock initialization, branch reporting, and verification SQL, see `docs/MULTI_BRANCH_SETUP.md`.


## Authentication repair migration (existing CASIA databases)

If Student registration reports `violates check constraint \"users_role_check\"`, run `database/migrations/004_auth_login_repairs.sql` once in Supabase SQL Editor. It updates the allowed roles to `admin`, `staff`, and `student` and makes the legacy local password field nullable. Do not rerun the base schema on an existing database.
