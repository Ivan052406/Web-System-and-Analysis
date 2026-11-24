# CASIA Web System

CASIA is a single Express application with separate Admin/Business Owner and Student frontends, a Staff cashier workspace, and a Supabase PostgreSQL database. It uses the existing HTML, CSS, vanilla JavaScript, Express, and Supabase stack.

## Project structure

The source is organized according to the requested frontend/backend/database/docs structure. **The Staff cashier page is intentionally kept inside `frontend/admin/pages/`** so the project has only the three top-level frontend areas (`admin`, `student`, and `shared`). Staff access remains a separate role and is still enforced by the backend; the folder location does not grant Admin permissions.

```text
CASIA-WEB-SYSTEM/
├── frontend/
│   ├── admin/
│   │   ├── pages/
│   │   │   ├── dashboard.html
│   │   │   ├── inventory.html
│   │   │   ├── sales.html
│   │   │   ├── products.html
│   │   │   ├── users.html
│   │   │   ├── branches.html
│   │   │   ├── restocking.html
│   │   │   ├── analytics.html
│   │   │   ├── insights.html
│   │   │   └── staff-dashboard.html
│   │   ├── css/
│   │   ├── js/
│   │   └── assets/
│   ├── student/
│   │   ├── pages/
│   │   ├── css/
│   │   ├── js/
│   │   └── assets/
│   ├── shared/
│   │   ├── components/
│   │   ├── css/
│   │   └── js/
│   └── index.html
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── branches/
│   │   │   ├── categories/
│   │   │   ├── dashboard/
│   │   │   ├── inventory/
│   │   │   ├── products/
│   │   │   ├── sales/
│   │   │   ├── staff/
│   │   │   ├── student/
│   │   │   ├── restocking/
│   │   │   ├── analytics/
│   │   │   └── insights/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── package-lock.json
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── schema.sql
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

The owner/admin pages and staff cashier page are grouped under `frontend/admin/pages/` by frontend area. `staff-dashboard.html` is a cashier-only interface: backend staff-session middleware still determines permissions, not the directory name.

## Requirements

- Node.js 20 or newer (Node 24 is suitable)
- npm
- Supabase project with PostgreSQL and Supabase Authentication enabled

## Setup and run

1. Follow `docs/DATABASE_SETUP.md` and `docs/MULTI_BRANCH_SETUP.md` before launching the application.
2. Copy the root `.env.example` file to `backend/.env` and configure your Supabase/PostgreSQL values. Never upload the real `.env` file.
3. Open a terminal in `backend/` and run:

   ```bash
   npm install
   npm start
   ```

4. Open `http://localhost:3000`. The server serves `frontend/index.html`, which opens the unified login page.

Do not open page files with `file://` or use Live Server for full-system testing. Use the Express server so same-origin API calls and authentication cookies work.

## Roles and access

- **Business Owner/Admin:** Supabase Auth login; manages business, branches, products, inventory, staff access code, and reports.
- **Staff/Cashier:** selects Staff Login, enters the business shared access code, selects an active branch, and receives an eight-hour branch-locked cashier session. The cashier workspace is `frontend/admin/pages/staff-dashboard.html`, but staff API permissions remain restricted server-side to sales/checkout operations.
- **Student:** Supabase Auth login and student-facing catalogue features.

## Multi-branch operations

Each branch has its own stock and sales/restocking history. The Owner's top navigation branch selector controls branch-specific pages and Reports & Visualizations. The Main Dashboard is an all-branches summary. The Owner's Sales page is product management only (add/delete); cart, quantity controls, calculations, and checkout are available in the Staff cashier workspace.

## Data and feature notes

- Admin and Student authentication use Supabase Auth; profile records must match the Auth user ID.
- Student catalogue data comes from `/api/student/catalog`.
- Favorites, ratings, reviews, helpful votes, viewed products, recent searches, and availability watch lists remain browser-local in this version; they are not synchronized across devices or users. The `backend/src/modules/favorites/` and `reviews/` folders document this limitation; no nonfunctional persistence APIs are presented as complete.
- Products and Users shortcuts redirect to the existing combined management pages because the original source did not contain independent CRUD screens for them.
- Do not commit `node_modules/`, `.env`, database passwords, or Supabase secrets.

See `docs/CHANGELOG.md`, `docs/AUDIT_REPORT.md`, `docs/DATABASE_SETUP.md`, `docs/MULTI_BRANCH_SETUP.md`, and `docs/STAFF_SETUP.md`.


## Admin / Staff Login

The login page has two main choices: **User Login** and **Admin / Staff Login**.
Inside Admin / Staff Login, use the small switch to choose:

- **Admin**: Business Owner email, password, and business access code; includes business sign-up.
- **Staff**: shared business staff access code, then choose an active branch before opening the Sales Workspace.

Student registration and login remain under User Login.

## Student business listings and ratings

Active businesses created by Business Owners are loaded from `public.businesses` through `/api/student/catalog`. The list is independent of whether a business already has products. Search Store, Store Directory, and Store Ratings use the same catalog. Store Ratings includes a business name/location search field. In this project version, individual ratings are still stored in the student's browser; they are not yet persisted across devices or accounts.

New businesses automatically receive an active `Main Branch` during Business Owner registration. This requires the multi-branch migration `003_multi_branch_staff_access.sql` to have been applied first.


## Login repair and password recovery setup

See [docs/LOGIN_STABILITY_AND_RECOVERY_SETUP.md](docs/LOGIN_STABILITY_AND_RECOVERY_SETUP.md) for the cookie/session fix, required SQL role-constraint migration, and Supabase SMTP/redirect configuration.
