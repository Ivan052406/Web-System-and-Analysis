# CASIA structure audit and correction report

## Result

The previous multi-branch release did not fully follow the requested folder layout because it introduced a separate top-level `frontend/staff/` directory. This corrected release removes that separate frontend area and groups the staff cashier page with the Admin frontend files, while keeping Staff as a separate role enforced by backend authorization.

## Required layout now present

```text
CASIA-WEB-SYSTEM/
├── frontend/
│   ├── admin/
│   │   ├── pages/
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

The Staff cashier page is `frontend/admin/pages/staff-dashboard.html`; its extra stylesheet is `frontend/admin/css/staff-sales.css`. Its login redirect is updated in `frontend/student/js/auth.js`, and the backend success redirect is updated in `backend/src/modules/staff/staff.controller.js` to `/admin/pages/staff-dashboard.html`.

The Staff page's placement under `frontend/admin/` is solely a directory-organization choice to match the requested three-area frontend structure. The page has `data-access-role="staff"`, uses a branch-locked Staff session, and remains protected by the Staff backend access checks. It does not grant Admin permissions.

## Other path and structure fixes

- Removed the old `frontend/staff/` directory.
- Removed empty placeholder subdirectories that did not contain source files.
- Moved `.env.example` to the project root, matching the requested tree. Copy this template to `backend/.env`; `backend/src/config/env.js` intentionally loads that runtime path.
- Updated `frontend/index.html` to use a relative `./student/pages/login.html` redirect. It works when the frontend is served by Express and when `frontend/index.html` is opened from the project through Live Server.
- Updated the README tree and setup commands.
- Added `docs/STRUCTURE_CORRECTION.md` and this report.

## Verification performed

| Check | Result |
|---|---:|
| HTML pages parsed | 26 |
| Missing local HTML/CSS/JS/image/link references | 0 |
| JavaScript files passing `node --check` | 75 |
| Express static frontend path | Passed |
| `package.json` / `package-lock.json` metadata | Matched |
| Old top-level `frontend/staff/` directory | Absent |
| Staff dashboard and CSS under `frontend/admin/` | Present |
| Root `.env.example` | Present |
| `node_modules` included | No |
| Real `.env` included | No |

## Not verified in this environment

The archive was checked statically. A live Supabase login, staff code verification, branch selection, checkout transaction, inventory deduction, and Owner/Student flows still need to be tested against the user's own Supabase project and environment. The real `.env` file was intentionally not included.
