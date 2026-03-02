-- Script to clear all application data while preserving schema.
-- Safe for partially-migrated databases: only truncates tables that exist.
-- WARNING: This deletes ALL DATA in application tables.

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'coverage_gaps',
        'test_cases',
        'generations',
        'test_generation_history',
        'password_reset_tokens',
        'email_verification_tokens',
        'user_workspace_context',
        'integration_credentials',
        'team_invitations',
        'user_sessions',
        'team_members',
        'teams',
        'users'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        IF to_regclass(tbl) IS NOT NULL THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', tbl);
            RAISE NOTICE 'Truncated table: %', tbl;
        ELSE
            RAISE NOTICE 'Skipped missing table: %', tbl;
        END IF;
    END LOOP;
END $$;
