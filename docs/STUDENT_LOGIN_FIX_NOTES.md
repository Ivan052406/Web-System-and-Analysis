# CASIA student login and database notes

The current User Login registration endpoint creates a `student` profile in `public.users`. The database must have the `student` role in its role constraint; apply `database/migrations/002_student_role_and_sequence_fix.sql` after the base schema and business/inventory patch. Existing `staff` accounts are not automatically converted because some may be real cashier/staff accounts. Review and convert individual accounts only when verified.

Student pages now retrieve the active store/product catalog from `GET /api/student/catalog`. Student activity such as favorites, ratings, reviews, helpful votes, and watch lists is still stored in browser localStorage and will not synchronize across devices.

See `docs/DATABASE_SETUP.md` for Supabase connection, SQL order, existing-data mapping, and environment setup.
