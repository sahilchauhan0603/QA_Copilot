-- ============================================
-- PostgreSQL Migration Schema
-- Ticket-to-Test AI - Authentication & Team Management
-- ============================================

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES
-- ============================================
CREATE TYPE team_role AS ENUM ('admin', 'qa_lead', 'qa_member');
CREATE TYPE integration_type AS ENUM ('jira', 'azure_devops');

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- ============================================
-- TEAM MEMBERS (Many-to-Many with Roles)
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'qa_member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)  -- User can only be in a team once
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================
-- USER SESSIONS (JWT Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,  -- Store hashed JWT for revocation
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),  -- IPv6 compatible
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);

-- ============================================
-- INTEGRATION CREDENTIALS (User or Team-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS integration_credentials (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- Personal integration
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,  -- Team integration
    integration_type integration_type NOT NULL,
    encrypted_credentials TEXT NOT NULL,  -- Fernet encrypted JSON
    config JSONB,  -- Additional settings (server URL, project key, etc.)
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR  -- Personal
        (user_id IS NULL AND team_id IS NOT NULL)     -- Team
    )
);

CREATE INDEX IF NOT EXISTS idx_credentials_user ON integration_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_team ON integration_credentials(team_id);

-- ============================================
-- TEST GENERATION HISTORY (User or Team-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS test_generation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,  -- Optional team context
    ticket_id VARCHAR(100) NOT NULL,
    ticket_source integration_type,
    roadmap JSONB,  -- QA Execution Roadmap
    test_cases JSONB,  -- Generated test cases
    coverage_report JSONB,  -- Coverage auditor output
    excel_file_path VARCHAR(500),  -- Path to generated Excel
    generation_time FLOAT,  -- Time taken in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_user ON test_generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_team ON test_generation_history(team_id);
CREATE INDEX IF NOT EXISTS idx_history_ticket ON test_generation_history(ticket_id);

-- ============================================
-- WORKSPACE CONTEXT (Track active workspace)
-- ============================================
CREATE TABLE IF NOT EXISTS user_workspace_context (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,  -- NULL = personal workspace
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspace_user ON user_workspace_context(user_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON integration_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_context_updated_at BEFORE UPDATE ON user_workspace_context
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ADMIN USER (Optional - for development)
-- ============================================
-- Password: 'admin123' (hashed with bcrypt)
-- INSERT INTO users (email, username, password_hash, full_name, is_active)
-- VALUES (
--     'admin@tickettotest.ai',
--     'admin',
--     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eDzs6pLKqFRW',
--     'System Administrator',
--     TRUE
-- );
