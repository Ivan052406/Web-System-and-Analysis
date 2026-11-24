# CASIA Login Stability and Recovery Setup

This update addresses three authentication issues found in the current CASIA project:

1. Supabase SSR chunked-cookie parsing and Admin session loss.
2. Student registration failing because the existing database still has a legacy `users_role_check` constraint.
3. Password recovery email delivery and recovery redirect configuration.

## 1. Replace the project files

Use the complete ZIP delivered with this document. Keep your real `backend/.env` file private and copy it into the extracted project's `backend/` folder. Do not overwrite your actual environment values with `.env.example` placeholders.

## 2. Apply the database repair

The terminal error `new row for relation "users" violates check constraint "users_role_check"` means the database still rejects `role = 'student'`.

In Supabase SQL Editor, create a new query and run:

`database/migrations/004_auth_login_repairs.sql`

This migration removes existing CHECK constraints that mention the `role` column, then recreates the role check to allow `admin`, `staff`, and `student`. It also allows the legacy `password` column to be NULL, as Supabase Auth manages passwords. It does not delete users or reset passwords.

Back up the database before running migrations. Do not rerun `database/schema.sql` on an existing CASIA database.

## 3. Admin session / cookie handling

`backend/src/config/supabaseAuth.js` now uses `parseCookieHeader` and `serializeCookieHeader` from `@supabase/ssr` for the `getAll` / `setAll` cookie adapter. This avoids using a generic cookie parser/serializer for Supabase's chunked auth cookies.

After extracting the ZIP:

```bash
cd backend
npm install
npm start
```

Then clear old site data/cookies for `localhost` once (browser DevTools > Application/Storage > Clear site data, or browser site settings) and sign in again. Test `POST /api/admin/login` and `GET /api/admin/me` in DevTools Network. Both should succeed for an active Admin with the correct account password and business access code.

The Admin layout now redirects to the combined login with `role=admin` only for 401/403. A 5xx verification error is shown on the page instead of being misreported as an expired login.

## 4. Password recovery email: Supabase dashboard setup required

The application cannot make Supabase send mail if the project's email provider is unavailable. For reliable recovery emails, configure a custom SMTP provider in the Supabase dashboard:

1. Open Authentication settings and find SMTP Settings.
2. Enable Custom SMTP.
3. Enter the SMTP host, port, username, password, sender email, and sender name provided by your email provider.
4. Save and test email delivery.
5. Under Authentication URL Configuration, set Site URL to `http://localhost:3000` for local development.
6. Add `http://localhost:3000/**` to the allowed Redirect URLs (or add both `http://localhost:3000/api/auth/confirm` and `http://localhost:3000/api/auth/confirm?role=admin` if you prefer exact entries).

For production, add your real HTTPS site URL and production confirmation URL as well. Do not use localhost URLs in a deployed production setup.

The server now logs the safe Supabase error metadata (message/status/code/name) without logging passwords, tokens, or access codes. If Supabase reports `Error sending recovery email`, fix SMTP/provider configuration in the Supabase dashboard; no SQL migration can fix email delivery.

## 5. Recovery redirect behavior

The Admin forgot-password link now includes `role=admin`. That value is carried through the recovery callback so the reset page returns to the combined Admin/Staff login with Admin selected. Student password recovery returns to User Login. The confirmation route now points to the actual `frontend/student/pages/forgot-password.html` and `reset-password.html` files.

## 6. Expected account roles

The public.users role constraint must allow:

- `admin` — Business Owner
- `staff` — shared-code staff sessions (not password login)
- `student` — Student login

Do not manually change a user's role to solve an email or password error. Supabase Auth holds the password; `public.users` holds the CASIA profile and matching `auth_user_id`.

## 7. What still requires live verification

- Supabase Custom SMTP must be configured and tested in the user's own Supabase project.
- The migration must be applied in the user's own database.
- The Admin session must be tested in a browser after clearing stale localhost cookies.
- Admin, Student, Staff, and recovery flows must be tested against the user's actual Supabase credentials.
