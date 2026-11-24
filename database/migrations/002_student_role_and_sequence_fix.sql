-- CASIA migration 002
-- Run after database/schema.sql and 001_business_auth_inventory_patch.sql.
-- Allows Supabase-authenticated student profiles, makes the local password
-- column optional (passwords are managed by Supabase Auth), and repairs the
-- category identity sequence after seeded IDs.

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'staff', 'student'));

-- CASIA now authenticates passwords through Supabase Auth. Both admin and
-- student profile rows therefore omit the legacy local password column.
ALTER TABLE public.users
    ALTER COLUMN password DROP NOT NULL;

DO $$
DECLARE
    max_id BIGINT;
    sequence_name TEXT;
BEGIN
    SELECT COALESCE(MAX(category_id), 0)
      INTO max_id
      FROM public.categories;

    sequence_name := pg_get_serial_sequence('public.categories', 'category_id');

    IF sequence_name IS NOT NULL THEN
        IF max_id = 0 THEN
            PERFORM setval(sequence_name, 1, false);
        ELSE
            PERFORM setval(sequence_name, max_id, true);
        END IF;
    END IF;
END $$;
