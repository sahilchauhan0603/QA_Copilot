-- Script to clear all application data while preserving schema.
-- Safe for partially-migrated databases: only truncates tables that exist.
-- WARNING: This deletes ALL DATA in application tables, including:
--   - All users (profile data, avatars, names, usernames)
--   - All teams and team members (roles, descriptions, stats)
--   - All team invitations (pending and accepted)
--   - All generated test cases and generation history
--   - All integration credentials and workspace context
--   - All auth tokens (password reset, email verification, sessions)
-- Tables are listed dependency-first; CASCADE handles any remaining FK chains.

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        -- Test generation data
        'coverage_gaps',
        'test_cases',
        'generations',
        'test_generation_history',
        -- Auth tokens
        'password_reset_tokens',
        'email_verification_tokens',
        'user_sessions',
        -- User context, integrations & webhooks
        'user_workspace_context',
        'integration_credentials',
        'webhook_subscriptions',
        -- Teams
        'team_invitations',
        'team_members',
        'teams',
        -- Users (clears profile photos, names, usernames, avatars)
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
