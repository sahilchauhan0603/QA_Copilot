-- Ticket-to-Test AI Database Schema

-- Table for storing test generation sessions
CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    ticket_title TEXT NOT NULL,
    ticket_type TEXT,
    ticket_description TEXT,
    ticket_acceptance_criteria TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    excel_file_path TEXT,
    status TEXT DEFAULT 'completed',
    total_test_cases INTEGER DEFAULT 0,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    team_id INTEGER DEFAULT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generations_ticket_id ON generations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_generations_timestamp ON generations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_team_id ON generations(team_id);
CREATE INDEX IF NOT EXISTS idx_generations_workspace ON generations(user_id, team_id);

-- Table for storing individual test cases
CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT,
    category TEXT,
    preconditions TEXT,
    test_steps TEXT,
    expected_result TEXT,
    test_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
);

-- Index for faster generation_id lookups
CREATE INDEX IF NOT EXISTS idx_test_cases_generation_id ON test_cases(generation_id);

-- Table for storing coverage gaps
CREATE TABLE IF NOT EXISTS coverage_gaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id TEXT NOT NULL,
    gap_description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
);

-- Index for faster generation_id lookups
CREATE INDEX IF NOT EXISTS idx_coverage_gaps_generation_id ON coverage_gaps(generation_id);
