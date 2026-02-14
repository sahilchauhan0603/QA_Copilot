"""
Run password reset migration using SQLAlchemy
"""
from database.connection import get_engine
from sqlalchemy import text

# Migration SQL
MIGRATION_SQL = """
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
"""

def run_migration():
    """Run the password reset migration"""
    try:
        # Get database engine
        engine = get_engine()
        
        print("Running password reset migration...")
        
        # Execute migration
        with engine.connect() as conn:
            conn.execute(text(MIGRATION_SQL))
            conn.commit()
        
        print("✅ Migration completed successfully!")
        print("   - Created password_reset_tokens table")
        print("   - Created indexes for performance")
        print("   - Added table/column comments")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_migration()
