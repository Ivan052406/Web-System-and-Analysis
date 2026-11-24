# Admin/Staff Session Collision Fix

## Confirmed cause

The API response from `GET /api/admin/me` was `403` with:

`You do not have permission to perform this action.`

The authentication middleware previously checked the shared-code Staff cookie (`casia_staff_session`) before checking the Supabase Auth session. If a valid Staff cookie remained in the browser from an earlier cashier session, `requireAuth` populated `req.staffUser` with `role: "staff"`. The Admin `/me` route then ran `requireRole("admin")` and rejected the request. This could happen even when the Supabase Admin login had succeeded and the Admin Supabase session was present.

## Changes made

1. Added `requireSupabaseAuth`, which verifies only the Supabase Auth session and loads the linked `public.users` profile. It deliberately ignores the shared Staff cookie.
2. Updated `GET /api/admin/me` to use `requireSupabaseAuth` followed by the existing `requireRole("admin")` check.
3. After a successful Admin sign-in (including valid business access code), the Admin login response clears the old `casia_staff_session` cookie. This prevents the old cashier session from taking precedence on subsequent API requests.
4. Kept Staff's shared-code, branch-locked session flow intact for Staff routes.
5. No SQL migration is required for this correction. No user, business, branch, product, inventory, or sales records are modified.

## Apply

1. Stop the running server with `Ctrl+C`.
2. Extract this project ZIP to a separate folder, or copy the changed files into the matching paths in your working project.
3. Preserve the existing `backend/.env` file.
4. Run `npm install` in `backend` if dependencies are not installed.
5. Start with `npm start`.
6. Clear only the local `localhost` site cookies in the browser once, to remove an old `casia_staff_session` cookie left by the previous version.
7. Sign in using Admin Login.

## Expected checks

- `POST /api/admin/login` should return 200 for valid Admin credentials and business access code.
- `GET /api/admin/me` should evaluate the Supabase Admin user, not a stale Staff cookie, and return 200 for an active Admin profile.
- Staff routes continue to recognize the branch-bound `casia_staff_session` cookie and enforce `role: "staff"`.

## Verification limits

JavaScript syntax, route wiring, and archive integrity were checked locally. Live Supabase authentication, cookies in the user's browser, and actual branch/sales operations still require testing against the user's own Supabase project.
