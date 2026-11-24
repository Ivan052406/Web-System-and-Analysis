-- CASIA migration 004: authentication and account-role repair.
-- Run ONCE (or safely re-run) after migrations 001-003 on an existing database.
-- This repairs databases where the legacy users_role_check still only allows
-- ('admin', 'staff'), which prevents new Student profiles from being inserted.
-- It preserves all current users and does not delete or rewrite account data.

DO $$
BEGIN
    IF to_regclass('public.users') IS NULL THEN
        RAISE EXCEPTION 'public.users does not exist. Apply the original CASIA schema first.';
    END IF;
END $$;

-- The reported production error names this legacy constraint explicitly.
ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'staff', 'student'));

-- Supabase Auth manages passwords; public.users stores only the profile link.
ALTER TABLE public.users
    ALTER COLUMN password DROP NOT NULL;

-- Keep the Student category seed/identity sequence from colliding with existing IDs.
DO $$
DECLARE
    max_id BIGINT;
    sequence_name TEXT;
BEGIN
    IF to_regclass('public.categories') IS NOT NULL THEN
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
    END IF;
END $$;

-- Verification result: the allowed roles should be visible in the constraint definition.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname = 'users_role_check';
