"""
Run database migrations using SQLAlchemy
This script runs:
1. Main schema migration (creates all base tables)
2. Test management enum migration (ensures xray/zephyr/testrail enum values)
3. Password reset token migration (adds password reset functionality)
4. Email verification migration (adds signup verification functionality)
5. Public user ID migration (adds QC-style user IDs for sharing)
"""
import sys
import os

# Add parent directory to path so we can import from database module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_db_connection
from sqlalchemy import text


def read_sql_file(filename):
    """Read SQL file from database directory"""
    sql_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'database',
        filename
    )
    with open(sql_path, 'r', encoding='utf-8') as f:
        return f.read()


# Password reset migration SQL
PASSWORD_RESET_SQL = """
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

EMAIL_VERIFICATION_SQL = """
-- Add user verification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;
UPDATE users
SET email_verified = TRUE,
    email_verified_at = COALESCE(email_verified_at, NOW())
WHERE email_verified = FALSE;

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Add comments
COMMENT ON TABLE email_verification_tokens IS 'Email verification tokens for new user account verification';
COMMENT ON COLUMN users.email_verified IS 'Whether user has verified ownership of their email address';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when the email was verified';
COMMENT ON COLUMN email_verification_tokens.token IS 'Secure random token for email verification';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Token expiration timestamp (typically 24 hours)';
COMMENT ON COLUMN email_verification_tokens.used IS 'Whether the token has been used';
COMMENT ON COLUMN email_verification_tokens.ip_address IS 'IP address where verification was initiated';
"""

PUBLIC_USER_ID_SQL = """
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_user_id VARCHAR(20);

UPDATE users
SET public_user_id = 'QC-' || UPPER(SUBSTRING(MD5(id::text || ':' || email || ':' || NOW()::text) FROM 1 FOR 8))
WHERE public_user_id IS NULL OR public_user_id = '';

ALTER TABLE users ALTER COLUMN public_user_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_users_public_user_id'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_public_user_id UNIQUE (public_user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_public_user_id ON users(public_user_id);
COMMENT ON COLUMN users.public_user_id IS 'Public-safe user identifier shared with other users (e.g., QC-AB12CD34)';
"""

TEST_MANAGEMENT_ENUM_SQL = """
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'xray';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'zephyr';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'testrail';
"""


def run_migration():
    """Run the database migrations"""
    try:
        # Get database connection
        db = get_db_connection()
        engine = db.engine

        print("=" * 60)
        print("DATABASE MIGRATION - TicketToTest AI")
        print("=" * 60)
        db_name = db.database_url.split('@')[1] if '@' in db.database_url else 'database'
        print(f"Connected to: {db_name}")
        print()

        # Step 1: Run main schema migration
        print("Step 1/5: Running main schema migration...")
        print("  - Creating base tables (users, teams, workspaces, etc.)")

        main_schema_sql = read_sql_file('migration_schema.sql')

        with engine.connect() as conn:
            conn.execute(text(main_schema_sql))
            conn.commit()

        print("  [OK] Main schema migration completed")
        print("     - Users table")
        print("     - Teams table")
        print("     - Team members table")
        print("     - Integration credentials table")
        print("     - Generations & test cases tables")
        print("     - Workspace context table")
        print()

        # Step 2: Ensure all integration enum values exist
        print("Step 2/5: Running test management enum migration...")
        print("  - Ensuring integration_type supports xray/zephyr/testrail")

        with engine.connect() as conn:
            conn.execute(text(TEST_MANAGEMENT_ENUM_SQL))
            conn.commit()

        print("  [OK] Test management enum migration completed")
        print("     - integration_type: xray, zephyr, testrail")
        print()

        # Step 3: Run password reset migration
        print("Step 3/5: Running password reset migration...")
        print("  - Creating password_reset_tokens table")

        with engine.connect() as conn:
            conn.execute(text(PASSWORD_RESET_SQL))
            conn.commit()

        print("  [OK] Password reset migration completed")
        print("     - password_reset_tokens table")
        print("     - Indexes for performance")
        print()

        # Step 4: Run email verification migration
        print("Step 4/5: Running email verification migration...")
        print("  - Adding user verification fields and tokens table")

        with engine.connect() as conn:
            conn.execute(text(EMAIL_VERIFICATION_SQL))
            conn.commit()

        print("  [OK] Email verification migration completed")
        print("     - users.email_verified / users.email_verified_at")
        print("     - email_verification_tokens table")
        print("     - Indexes for performance")
        print()

        # Step 5: Run public user ID migration
        print("Step 5/6: Running public user ID migration...")
        print("  - Adding QC-style public user IDs")

        with engine.connect() as conn:
            conn.execute(text(PUBLIC_USER_ID_SQL))
            conn.commit()

        print("  [OK] Public user ID migration completed")
        print("     - users.public_user_id")
        print("     - Uniqueness constraint and index")
        print()

        # Step 6: Run Google OAuth migration
        print("Step 6/6: Running Google OAuth migration...")
        print("  - Making password_hash nullable for OAuth-only accounts")
        print("  - Adding oauth_provider and oauth_sub columns")

        oauth_sql = read_sql_file('oauth_migration.sql')
        with engine.connect() as conn:
            conn.execute(text(oauth_sql))
            conn.commit()

        print("  [OK] Google OAuth migration completed")
        print("     - users.password_hash: now nullable")
        print("     - users.oauth_provider / users.oauth_sub added")
        print()

        print("=" * 60)
        print("ALL MIGRATIONS COMPLETED SUCCESSFULLY")
        print("=" * 60)

    except Exception as e:
        print()
        print("=" * 60)
        print("MIGRATION FAILED")
        print("=" * 60)
        print(f"Error: {e}")
        print()
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    run_migration()
