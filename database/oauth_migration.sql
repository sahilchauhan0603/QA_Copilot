-- ============================================
-- OAuth / Google Sign-In Migration
-- Adds oauth_provider, oauth_sub columns and
-- makes password_hash nullable for OAuth users
-- ============================================

-- Make password_hash nullable (OAuth users have no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add OAuth provider name (e.g. 'google')
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50) DEFAULT NULL;

-- Add OAuth subject (Supabase user UUID — unique per provider account)
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_sub VARCHAR(255) DEFAULT NULL;

-- Unique index so the same Google account cannot be linked to two different users
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_oauth_sub ON users(oauth_sub) WHERE oauth_sub IS NOT NULL;
