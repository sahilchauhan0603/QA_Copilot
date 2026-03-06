# Database Documentation

## Overview

TicketToTest AI uses **PostgreSQL** as a single unified database for all data:
- 🔐 **Authentication** - Users, sessions, JWT tokens
- 👥 **Teams** - Team management and memberships
- 🔑 **Integrations** - Encrypted Jira/Azure DevOps credentials (workspace-scoped)
- 📊 **Test Generations** - Test generation history (workspace-scoped)
- ✅ **Test Cases** - All generated test cases
- ⚠️ **Coverage Gaps** - Identified missing scenarios

✅ **Benefits of PostgreSQL:**
- ✅ Single database for all data
- ✅ Data persists across deployments (when using hosted PostgreSQL)
- ✅ Better performance and scalability
- ✅ ACID compliance and reliability
- ✅ Works locally AND in production

## Database Setup

### Local Development

1. **Install PostgreSQL** (if not already installed):
   - Download from [postgresql.org](https://www.postgresql.org/download/)
   - Or use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=bmw postgres`

2. **Database Already Created**:
   Your `.env` points to: `postgresql://postgres:bmw@localhost:5432/ticket_to_test`

3. **Initialize Tables**:
   Tables are auto-created on first run when you start the backend:
   ```powershell
   python -m api.server
   ```

### Production Deployment

Use a hosted PostgreSQL service:
- **Supabase** (free tier available)
- **Railway** (free tier available)  
- **Heroku Postgres**
- **AWS RDS**
- **DigitalOcean Managed Databases**

Update `DATABASE_URL` environment variable in your deployment platform.

## Schema

```sql
-- Authentication & Users
users (id, email, username, password_hash, full_name, is_active)
user_sessions (id, user_id, token_hash, expires_at)
user_workspace_context (id, user_id, active_team_id)

-- Teams
teams (id, name, description, created_by)
team_members (id, team_id, user_id, role)

-- Integrations (workspace-scoped)
integration_credentials (id, user_id, team_id, integration_type, encrypted_credentials, config)

-- Test Generation (workspace-scoped)
generations (id UUID, user_id, team_id, ticket_id, ticket_title, timestamp, total_test_cases)
  └── test_cases (id, generation_id, title, priority, category, test_steps JSONB, expected_result)
  └── coverage_gaps (id, generation_id, gap_description)
```

## Access Methods

### 1. Python API (Recommended)
```python
from database.db_manager import DatabaseManager

db = DatabaseManager()

# Get generations for personal workspace
history = db.get_all_generations(user_id=1, team_id=None, limit=10)

# Get generations for team workspace
team_history = db.get_all_generations(user_id=1, team_id=5, limit=10)

# Search
results = db.search_generations(user_id=1, ticket_id="KAN-2")

# Get full details
details = db.get_generation_by_id(generation_id)

# Statistics
stats = db.get_statistics(user_id=1, team_id=None)
```

### 2. PostgreSQL Client
```bash
psql postgresql://postgres:bmw@localhost:5432/ticket_to_test
```

### 3. GUI Tools
- **pgAdmin** - [pgadmin.org](https://www.pgadmin.org/)
- **DBeaver** - [dbeaver.io](https://dbeaver.io/)
- **TablePlus** - [tableplus.com](https://tableplus.com/)

## Quick Queries

```sql
-- Recent generations (all users)
SELECT ticket_id, ticket_title, total_test_cases, timestamp 
FROM generations 
ORDER BY timestamp DESC LIMIT 10;

-- Test cases by priority
SELECT priority, COUNT(*) FROM test_cases GROUP BY priority;

-- Workspace activity for a specific user
SELECT 
  CASE WHEN team_id IS NULL THEN 'Personal' ELSE 'Team ' || team_id END as workspace,
  COUNT(*) as generations,
  SUM(total_test_cases) as total_tests
FROM generations 
WHERE user_id = 1
GROUP BY team_id
ORDER BY COUNT(*) DESC;

-- Integration status per user
SELECT 
  u.username,
  CASE WHEN ic.team_id IS NULL THEN 'Personal' ELSE 'Team' END as workspace,
  ic.integration_type,
  ic.is_active
FROM users u
JOIN integration_credentials ic ON u.id = ic.user_id OR u.id IN (
  SELECT tm.user_id FROM team_members tm WHERE tm.team_id = ic.team_id
);
```

## Migration from SQLite

If you had the old `ticket_test.db` file:

1. **Backup old data** (optional):
   ```powershell
   copy ticket_test.db backup_sqlite.db
   ```

2. **PostgreSQL auto-initializes** on first run - no manual steps needed

3. **Old data won't transfer** - fresh start
   - Previous generations in SQLite won't appear in PostgreSQL
   - This ensures clean workspace-scoped data
   - Users must be created via signup

4. **Remove old SQLite file** (optional):
   ```powershell
   del ticket_test.db
   ```

## Maintenance

### Backup
```bash
# Full database backup
pg_dump -U postgres -d ticket_to_test > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U postgres -d ticket_to_test | gzip > backup_$(date +%Y%m%d).sql.gz

# Windows PowerShell
pg_dump -U postgres -d ticket_to_test > "backup_$(Get-Date -Format 'yyyyMMdd').sql"
```

### Restore
```bash
psql -U postgres -d ticket_to_test < backup.sql
```

### Database Size
```sql
SELECT 
  schemaname, tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Cleanup Old Data
```sql
-- Delete test generations older than 90 days
DELETE FROM generations 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Vacuum to reclaim space
VACUUM FULL;
```

## Environment Variables

Required in `.env`:

```env
# PostgreSQL connection (local or hosted)
DATABASE_URL=postgresql://postgres:bmw@localhost:5432/ticket_to_test

# For production (example with Supabase)
# DATABASE_URL=postgresql://user:password@db.xxx.supabase.co:5432/postgres

# Encryption key for credentials (generate once)
ENCRYPTION_KEY=b9-EYhOl8X_rnGsH0m_QKVP7m65Q-zD70deXnXU78-A=

# JWT secret (generate once)
JWT_SECRET_KEY=cQxyS6CUQC2dnJ6EeR9oa5cRu3Jnv0XdSpN4iBouoJc

# Flask secret (generate once)
FLASK_SECRET_KEY=EB2rP3XciTkAVVCnJljNbK9dWIKf2OENfFncdlVF8_U
```

**Security:**
- Never commit `.env` file
- Use different secrets for dev/staging/production
- Rotate encryption keys periodically (requires data re-encryption)

## Troubleshooting

### Connection Issues
```python
# Test connection
from database.connection import DatabaseConnection
db = DatabaseConnection()
print("Connected successfully!")
```

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
