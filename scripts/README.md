# Scripts Directory

Utility scripts for managing and running the QA Copilot AI application.

## Available Scripts

### Database Management

#### `run_migration.py`
Run database migrations to update the schema.

```bash
python scripts/run_migration.py
```

This script applies all schema migrations in 5 steps:
1. Main schema — all tables including OAuth columns and `webhook_subscriptions`
2. Test management enum — adds `xray`, `zephyr`, `testrail` enum values
3. Password reset tokens
4. Email verification tokens and user columns
5. Public user IDs (`QC-XXXXXXXX` style)

#### `check_database.py`
Check database connection and view current database state.

```bash
python scripts/check_database.py
```

Useful for debugging database issues and verifying data.

#### `clear_database.ps1`
Reset the database to a clean state (⚠️ Destructive operation).

```powershell
.\scripts\reset_database.ps1
```

**Warning:** This will delete all application data in existing tables.

---

### Application Startup

#### `start_backend.ps1`
Start the Flask backend server on port 5000.

```powershell
.\scripts\start_backend.ps1
```

This script:
- Activates the virtual environment
- Sets environment variables
- Starts the Flask API server

#### `start_frontend.ps1`
Start the React frontend development server on port 3000.

```powershell
.\scripts\start_frontend.ps1
```

This script:
- Navigates to the frontend directory
- Installs dependencies if needed
- Starts the Vite development server

---

## Quick Start

To start the full application:

1. **Terminal 1** - Start Backend:
   ```powershell
   .\scripts\start_backend.ps1
   ```

2. **Terminal 2** - Start Frontend:
   ```powershell
   .\scripts\start_frontend.ps1
   ```

3. Open http://localhost:3000 in your browser
