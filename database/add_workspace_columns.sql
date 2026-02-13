-- Migration: Add workspace isolation to generations table
-- This allows filtering test generations by user and team

-- Add user_id column (required - every generation belongs to a user)
ALTER TABLE generations ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;

-- Add team_id column (optional - NULL for personal workspace)
ALTER TABLE generations ADD COLUMN team_id INTEGER DEFAULT NULL;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_team_id ON generations(team_id);
CREATE INDEX IF NOT EXISTS idx_generations_workspace ON generations(user_id, team_id);

-- Add foreign key constraints (will work in SQLite 3.6.19+)
-- These are informational - SQLite doesn't enforce them by default
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
