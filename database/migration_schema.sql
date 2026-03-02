-- ============================================
-- PostgreSQL Migration Schema
-- Ticket-to-Test AI - Authentication & Team Management
-- ============================================

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_role') THEN
        CREATE TYPE team_role AS ENUM ('admin', 'qa_lead', 'qa_member');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_type') THEN
        CREATE TYPE integration_type AS ENUM ('jira', 'azure_devops', 'xray', 'zephyr', 'testrail');
    END IF;
END $$;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    public_user_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS public_user_id VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_public_user_id ON users(public_user_id);

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
-- EMAIL VERIFICATION TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

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
-- TEST GENERATION TABLES (User or Team-Specific)
-- ============================================

-- Generations table - stores test generation sessions
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(100) NOT NULL,
    ticket_title TEXT NOT NULL,
    ticket_type VARCHAR(50),
    ticket_description TEXT,
    ticket_acceptance_criteria JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    excel_file_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'completed',
    total_test_cases INTEGER DEFAULT 0,
    generation_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_generations_ticket_id ON generations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_generations_timestamp ON generations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_team_id ON generations(team_id);
CREATE INDEX IF NOT EXISTS idx_generations_workspace ON generations(user_id, team_id);

-- Test cases table - stores individual test cases
CREATE TABLE IF NOT EXISTS test_cases (
    id SERIAL PRIMARY KEY,
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    priority VARCHAR(10),
    category VARCHAR(100),
    preconditions TEXT,
    test_steps JSONB,
    expected_result TEXT,
    test_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_cases_generation_id ON test_cases(generation_id);

-- Coverage gaps table - stores identified coverage gaps
CREATE TABLE IF NOT EXISTS coverage_gaps (
    id SERIAL PRIMARY KEY,
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    gap_description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coverage_gaps_generation_id ON coverage_gaps(generation_id);

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
-- TEAM INVITATIONS
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
        CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS team_invitations (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'qa_member',
    status invitation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(team_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_invited_user ON team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON team_invitations(status);

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
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credentials_updated_at ON integration_credentials;
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON integration_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workspace_context_updated_at ON user_workspace_context;
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
