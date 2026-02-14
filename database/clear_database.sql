-- Script to clear all data from the database and start fresh
-- Run this to reset your PostgreSQL database
-- WARNING: This deletes ALL data!

-- Delete all data from tables (in correct order due to foreign keys)
DELETE FROM coverage_gaps;
DELETE FROM test_cases;
DELETE FROM generations;
DELETE FROM user_workspace_context;
DELETE FROM integration_credentials;
DELETE FROM user_sessions;
DELETE FROM team_members;
DELETE FROM teams;
DELETE FROM users;

-- Reset sequences (auto-increment IDs)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE teams_id_seq RESTART WITH 1;
ALTER SEQUENCE team_members_id_seq RESTART WITH 1;
ALTER SEQUENCE user_sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE integration_credentials_id_seq RESTART WITH 1;
ALTER SEQUENCE user_workspace_context_id_seq RESTART WITH 1;
ALTER SEQUENCE test_cases_id_seq RESTART WITH 1;
ALTER SEQUENCE coverage_gaps_id_seq RESTART WITH 1;

-- Verify all tables are empty
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM user_sessions
UNION ALL
SELECT 'integration_credentials', COUNT(*) FROM integration_credentials
UNION ALL
SELECT 'generations', COUNT(*) FROM generations
UNION ALL
SELECT 'test_cases', COUNT(*) FROM test_cases
UNION ALL
SELECT 'coverage_gaps', COUNT(*) FROM coverage_gaps
UNION ALL
SELECT 'user_workspace_context', COUNT(*) FROM user_workspace_context;
SELECT 'integration_credentials', COUNT(*) FROM integration_credentials
UNION ALL
SELECT 'test_generation_history', COUNT(*) FROM test_generation_history
UNION ALL
SELECT 'user_workspace_context', COUNT(*) FROM user_workspace_context;
