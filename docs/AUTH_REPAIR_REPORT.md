# CASIA Authentication Repair Report

## Source baseline

This repair is based on the latest delivered `CASIA_ADMIN_STAFF_COMBINED_LOGIN.zip` project and preserves the agreed directory layout:

- `frontend/admin/{pages,css,js,assets}`
- `frontend/student/{pages,css,js,assets}`
- `frontend/shared/{components,css,js}`
- `backend/src/{config,middleware,modules,utils}`
- `database/{migrations,seeders}`
- `docs`

## Confirmed problems addressed in source

1. **Supabase SSR chunked-cookie handling:** the old Express adapter used generic `cookie.parse` and `cookie.serialize`. It now uses `parseCookieHeader` and `serializeCookieHeader` from the installed `@supabase/ssr` dependency, and preserves multiple `Set-Cookie` headers. This is intended to correct malformed chunked session cookies and the resulting repeated Admin login redirect.
2. **Admin dashboard guard:** the Admin layout now sends only 401/403 responses back to the combined Admin/Staff login with `role=admin`. A 5xx response is shown as a server verification issue rather than falsely treated as a signed-out user.
3. **Student role constraint:** a new idempotent SQL migration `database/migrations/004_auth_login_repairs.sql` recreates `users_role_check` to allow `admin`, `staff`, and `student`, and makes the legacy local `password` column nullable. This addresses the terminal error where Student profile creation was rejected by the old database constraint.
4. **Password recovery redirect paths:** recovery callback links now point to the actual `frontend/student/pages/forgot-password.html` and `reset-password.html` pages. Admin recovery preserves the Admin selection through the recovery flow.
5. **Safe diagnostics:** Admin/Student sign-in and recovery email errors now log provider status/code metadata, without logging passwords, tokens, or access codes.

## Required manual steps

- Apply `database/migrations/004_auth_login_repairs.sql` in Supabase SQL Editor. The ZIP cannot run migrations against the user's live Supabase project.
- Configure Custom SMTP in Supabase Authentication settings if recovery/confirmation emails must be delivered to addresses outside the Supabase organization's team. Add the local Auth callback to allowed Redirect URLs.
- Copy the real existing `backend/.env` into the extracted project. The ZIP deliberately excludes secrets.
- Clear old browser cookies/site data for `localhost` once after replacing the project, then test login again.

## Static verification performed

- 75 JavaScript files passed `node --check`.
- 26 HTML pages parsed.
- 0 unresolved local HTML script, stylesheet, image, or link references.
- Confirmed expected folders are present.
- Confirmed archive source contains no `node_modules` and no real `.env`.

## Not claimed as verified

No live Supabase credentials were available to this build process. Therefore actual Admin/Student sign-in, session refresh, Student registration after migration, and password-reset email delivery have not been live-tested against the user's Supabase project. Custom SMTP must be configured by the project owner; a code ZIP alone cannot make Supabase send email.
