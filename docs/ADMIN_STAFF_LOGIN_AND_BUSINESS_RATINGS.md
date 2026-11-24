# Admin / Staff Combined Login and Business Ratings Directory

## Login layout
- The main login selector has two choices: **User Login** and **Admin / Staff Login**.
- Admin / Staff Login has a small inner **Admin / Staff** switch.
- Admin mode keeps Business Owner sign-in and business registration. Admin sign-in uses the owner email, password, and business access code.
- Staff mode uses the shared business access code and requires the cashier to load and select an active branch before opening the Sales Workspace.
- Student login and registration remain separate under User Login.
- `?role=staff` opens Admin / Staff Login with Staff selected; `?role=admin` opens it with Admin selected.

## Student business directory and Store Ratings
- The Student catalog endpoint queries all active rows from `public.businesses`, independently of whether those businesses have products.
- Business names, addresses and contact details are normalized by the Student data layer and are used by Search Store, Store Directory, and Store Ratings.
- Store Ratings now includes a search box for business name/location and refreshes when the database catalog is loaded.
- Business Owners must have `businesses.status = 'active'` for their business to appear.
- Ratings/reviews remain browser-local in the supplied Student data layer; this change adds the registered-business list, not server-side rating persistence.

## Main Branch on new business registration
- Business Owner registration now inserts an active `Main Branch` in the same PostgreSQL transaction as the business and owner profile.
- This gives Staff an active branch to select as soon as a new Business Owner creates a business.
- The insert uses the unique `(business_id, branch_name)` constraint from migration 003.

## Database requirements
- No new SQL migration is needed for this change.
- Apply the existing migrations 001, 002, and 003 in order if they have not already been applied. Do not rerun schema creation scripts on an existing database.
- Existing business owners should already have a Main Branch after migration 003.
