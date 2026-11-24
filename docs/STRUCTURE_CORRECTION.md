# CASIA folder-structure correction

The multi-branch release originally placed the cashier UI in a separate top-level `frontend/staff/` folder. That did not follow the folder layout requested for CASIA.

## Correction applied

- Moved `frontend/staff/pages/dashboard.html` to `frontend/admin/pages/staff-dashboard.html`.
- Moved `frontend/staff/css/staff-sales.css` to `frontend/admin/css/staff-sales.css`.
- Updated the Staff login redirect in `frontend/student/js/auth.js`.
- Updated the successful Staff access redirect in `backend/src/modules/staff/staff.controller.js`.
- Updated the moved page's CSS, logo, and JavaScript relative paths.
- Updated Staff documentation to use `/admin/pages/staff-dashboard.html`.
- Removed the now-empty `frontend/staff/` folder and empty placeholder subfolders under `frontend/admin/`.
- Moved the environment template to the project root as `.env.example`, matching the requested layout. Copy it to `backend/.env`; the backend continues to load `backend/.env`.

## Permission note

The cashier dashboard is physically stored under `frontend/admin/pages/` only to preserve the requested three-area frontend layout. Its location does not confer Admin permissions. The staff access cookie, branch-locked session, and backend authorization middleware continue to identify and restrict Staff requests.

## Verification

- 26 HTML files parsed.
- 0 missing local script, stylesheet, image, or local link references.
- 75 JavaScript files passed `node --check`.
- `package.json` and `package-lock.json` package metadata match.
- No `frontend/staff/` folder remains.
- The real `.env` and `node_modules` are not included in the ZIP.

A live Supabase login and transaction test still needs to be performed in the user's environment.
