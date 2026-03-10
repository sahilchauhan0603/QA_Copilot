-- Google OAuth Migration
-- Makes password_hash nullable for OAuth-only accounts
-- Adds oauth_provider and oauth_sub columns to users table

-- Allow password_hash to be NULL (OAuth users have no password)
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

-- Add oauth_provider column (e.g. 'google')
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50) DEFAULT NULL;

-- Add oauth_sub column (the external OAuth subject / Supabase UUID)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS oauth_sub VARCHAR(255) DEFAULT NULL;

-- Unique index so two accounts can't share the same OAuth subject
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_sub
    ON users (oauth_sub)
    WHERE oauth_sub IS NOT NULL;
