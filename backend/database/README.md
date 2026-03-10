# Database

PostgreSQL — single unified database for all application data.

## Schema

```sql
-- Users & Auth
users            (id, public_user_id, email, username, password_hash [nullable],
                  full_name, avatar_url, is_active, email_verified, oauth_provider, oauth_sub)
user_sessions    (id, user_id, token_hash, expires_at, ip_address)

-- Auth Tokens
password_reset_tokens     (id, user_id, token, expires_at, used, ip_address)
email_verification_tokens (id, user_id, token, expires_at, used, ip_address)

-- Teams
teams            (id, name, description, created_by)
team_members     (id, team_id, user_id, role)            -- roles: admin | qa_lead | qa_member
team_invitations (id, team_id, invited_user_id, invited_by_user_id, role, status)

-- Active Workspace
user_workspace_context (id, user_id, active_team_id)    -- NULL team_id = personal workspace

-- Integrations (workspace-scoped, credentials Fernet-encrypted)
integration_credentials (id, user_id, team_id, integration_type, encrypted_credentials, config)
-- integration_type enum: jira | azure_devops | xray | zephyr | testrail

-- Test Generation (workspace-scoped)
generations  (id UUID, user_id, team_id, ticket_id, ticket_title, timestamp, total_test_cases)
  └── test_cases    (id, generation_id, title, priority, category, test_steps JSONB, expected_result)
  └── coverage_gaps (id, generation_id, gap_description)

-- Webhook Monitoring (auto-regeneration on ticket updates)
webhook_subscriptions (id, user_id, team_id, integration_type, ticket_id,
                       ticket_title, generation_id, content_hash, is_active, last_triggered_at)
```

## Files

| File | Purpose |
|---|---|
| `connection.py` | SQLAlchemy engine + session factory (`get_db_connection()`) |
| `models.py` | ORM models for generations, test cases, coverage gaps |
| `auth_models.py` | ORM models for users, teams, auth tokens, webhook subscriptions |
| `db_manager.py` | High-level `DatabaseManager` API (save/query generations) |
| `migration_schema.sql` | Full DDL — run via `python scripts/run_migration.py` |
| `oauth_migration.sql` | Standalone OAuth ALTER statements (merged into main schema) |
| `clear_database.sql` | Truncates all tables — ⚠️ destructive, dev use only |

## Migration

```powershell
python scripts/run_migration.py
```

Runs 5 idempotent steps: base schema → enum values → password reset → email verification → public user IDs.
All DDL uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — safe to re-run on an existing database.

## Connection

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Set in `backend/.env`. For Supabase, use port **6543** (connection pooler, not direct).

### Table Creation Failed
```bash
# Manually run migrations
psql postgresql://postgres:bmw@localhost:5432/ticket_to_test < database/migration_schema.sql
```

### Reset Database (DANGER - deletes all data)
```sql
DROP DATABASE ticket_to_test;
CREATE DATABASE ticket_to_test;
```

Then restart your backend to recreate tables.
