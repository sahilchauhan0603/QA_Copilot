-- Migration: Add password reset tokens table
-- Run this migration to add password reset functionality

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add comments
COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens for user password recovery';
COMMENT ON COLUMN password_reset_tokens.token IS 'Secure random token for password reset';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp (typically 1 hour)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Whether the token has been used';
COMMENT ON COLUMN password_reset_tokens.ip_address IS 'IP address where reset was requested';
