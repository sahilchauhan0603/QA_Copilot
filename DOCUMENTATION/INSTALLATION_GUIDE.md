<div align="center">

# ⚙️ QA Copilot — Installation & Setup Guide

**Get up and running locally in under 15 minutes.**

</div>

---

## ✅ Prerequisites

| Requirement | Version | Link |
|---|---|---|
| Python | 3.11+ | [Download](https://www.python.org/downloads/) |
| Node.js | 16+ | [Download](https://nodejs.org/) |
| PostgreSQL | 14+ | [Download](https://www.postgresql.org/download/) |
| Google Gemini API Key | — | [Get here](https://makersuite.google.com/app/apikey) |

**Verify:**
```powershell
python --version    # 3.11+
node --version      # 16+
psql --version      # 14+
```

---

## 🛠️ Installation

### 1. Navigate to Project
```powershell
cd c:\THIS_DEVICE\VSCode\PROJECTS\QA_Copilot
```

### 2. Python Environment
> 💡 **Skip this step** — `.\scripts\start_backend.ps1` auto-creates the venv and installs dependencies on first run.

<details>
<summary>Manual setup (optional)</summary>

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
</details>

### 3. Database Setup

```powershell
psql -U postgres
CREATE DATABASE qa_copilot;
\q
```

<details>
<summary>⚠️ "psql not recognized"? Fix your PATH</summary>

```powershell
# Option A — temporary, for this session
$env:PATH += ";C:\Program Files\PostgreSQL\18\bin"

# Option B — use the full path directly
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
```
Not sure of your version? `Get-ChildItem "C:\Program Files\PostgreSQL"`
</details>

Then run the migration:
```powershell
python scripts/run_migration.py
```

### 4. Environment Variables

Backend:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env`:
```env
# Google Gemini AI
GOOGLE_API_KEY=your-google-gemini-api-key
LLM_MODEL=gemini-2.0-flash-exp
LLM_TEMPERATURE=0.3

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/qa_copilot

# Flask Configuration
FLASK_SECRET_KEY=your-super-secret-key-min-32-characters
FLASK_DEBUG=false
API_PORT=5000

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key-min-32-characters
JWT_EXPIRATION_HOURS=24

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=QA Copilot
APP_URL=http://localhost:3000

# Credential Encryption (AES-256 Fernet)
ENCRYPTION_KEY=your-fernet-encryption-key-44-characters

# SQL Echo (for debugging)
SQL_ECHO=false

# Supabase project URL + anon key (used for Google OAuth token verification)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Webhook Monitoring (auto-regeneration on ticket updates)
JIRA_WEBHOOK_SECRET=
ADO_WEBHOOK_SECRET=
```

Generate a secure JWT secret:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Frontend:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Edit `frontend/.env` if needed:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 5. Frontend
```powershell
cd frontend
npm install
cd ..
```

### 6. Run

| Terminal | Command |
|---|---|
| 1 — Backend | `.\scripts\start_backend.ps1` |
| 2 — Frontend | `.\scripts\start_frontend.ps1` |

**Open:** [http://localhost:3000](http://localhost:3000)

---

## 🎬 First-Time Setup

**Create your account:** Sign Up → username, email, password → optionally create a team → start generating tests.

**Manage your profile** (click your avatar, top-right nav):

| Action | How |
|---|---|
| 📷 Upload photo | Hover avatar → camera icon → choose image (JPG/PNG/GIF/WebP, max 2 MB) |
| ✏️ Edit display name | Hover name → pencil icon → type → **Enter**/**Save** |
| ✏️ Edit username | Hover @username → pencil icon → type (3+ chars, alphanumeric/underscore) → real-time availability check → **Save** |

> Photos are stored as base64 in the database; usernames are validated for uniqueness before saving.

### 🔌 Configure Integrations (Optional)

All under **Settings → Integrations**:

| Tool | Required Fields | Action |
|---|---|---|
| **Jira** | URL, Email, API Token | Save & Test Connection |
| **Azure DevOps** | Org URL, PAT, Project Name | Save & Test Connection |
| **Xray** | Project Key | Save |
| **Zephyr Scale** | Token, Project Key | Save |
| **TestRail** | URL, Email, API Key, Project ID | Save & Test Connection |

---

## 📖 Usage Guide

### Generate Test Cases

| | **From Integration** (recommended) | **Manual Input** |
|---|---|---|
| 1 | Go to **Integration** tab | Go to **Create** tab |
| 2 | Select Jira / Azure DevOps | Enter ticket details manually |
| 3 | Enter ticket ID (`PROJ-123` or `12345`) → **Fetch Ticket** | — |
| 4 | *(Optional)* Upload screenshots or code/config files | *(Optional)* Upload screenshots or code/config files |
| 5 | **Generate Tests** → wait 4–5 min | **Generate Tests** |
| 6 | View results → download Excel | View results → download Excel |

### 💻 Code-Aware Generation

Both **Custom** and **Integration** tabs accept source/config file uploads — the AI derives test cases from real implementation logic, not just the ticket text.

- **Supported types:** `.py` `.js` `.jsx` `.ts` `.tsx` `.java` `.cs` `.go` `.rb` `.php` `.html` `.css` `.json` `.yaml` `.yml` `.sql` `.md` `.txt` `.vue` `.kt` `.swift` `.cpp` `.c`
- **Limits:** up to 3 files, 500 KB each (~1,500–2,000 lines is the sweet spot)
- **How:** scroll to **Code / Config Files** below the screenshot uploader → drag & drop or click to upload → remove with ✕ → **Generate Test Cases**

> Agents identify functions, validation logic, error handling, and boundary conditions to ground tests in the actual code.

### 🔄 Sync Back to Tickets
Detail view → **Sync** dropdown → **Full Sync** (Excel + comment) / **Attach Excel Only** / **Add Comment Only** → confirm.

### 📤 Export to Test Management Tools
Detail view → **Export to Test Tool** → pick **Xray** / **Zephyr Scale** / **TestRail** → name the suite/cycle (required for TestRail) → **Export**.
Creates test steps, expected results, priority mapping, and links back to the source ticket.

### 🛠️ Refine Generated Results
Detail view → **Refine Results** (indigo) → choose:

| Option | Effect |
|---|---|
| Regenerate Entire | Re-runs all agents (4–5 min) |
| Minimize Test Cases | Removes redundant tests (−20–40%) |
| Focus on Area | +5–10 tests for a specific area (e.g. "authentication") |
| Add Edge Cases | Boundary/race conditions, special scenarios |
| Increase Coverage | Targets identified coverage gaps |
| Simplify Tests | Shorter, more readable test cases |

> Every refinement creates a new generation — originals are preserved for comparison.

### 🕘 History
**History** tab → click any row for details → download Excel → compare original vs. refined versions.

---

## 📜 Scripts Reference

| Script | Purpose |
|---|---|
| `start_backend.ps1` | Start backend API (port 5000) |
| `start_frontend.ps1` | Start frontend dev server (port 3000) |
| `run_migration.py` | Run database migrations |
| `clear_database.ps1` | ⚠️ Reset database (destructive) |

```powershell
.\scripts\start_backend.ps1
python scripts/run_migration.py
```

---

## ⚡ Performance Tips

- Use `gemini-2.0-flash-exp` for faster generation (`backend/.env`)
- Close unnecessary browser tabs during generation
- Ensure a stable connection — agents make multiple sequential API calls

---

<div align="center">

**Built for QA teams to accelerate test case creation with AI** 🚀

</div>