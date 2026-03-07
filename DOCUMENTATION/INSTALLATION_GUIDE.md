# Installation & Setup Guide

## Prerequisites

- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 16+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **Google Gemini API Key** - [Get here](https://makersuite.google.com/app/apikey)

**Verify installations:**
```powershell
python --version    # Should be 3.11+
node --version      # Should be 16+
psql --version      # Should be 14+
```

---

## Installation Steps

### 1. Clone & Navigate
```powershell
cd c:\THIS_DEVICE\VSCode\PROJECTS\QA_Copilot
```

### 2. Setup Python Environment

> **Note:** You can skip this step entirely — `.\scripts\start_backend.ps1` automatically creates the virtual environment and installs all dependencies on first run.

If you prefer to set it up manually:
```powershell
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 3. Setup PostgreSQL Database

**Create database:**

> **Troubleshooting:** If you see `psql : The term 'psql' is not recognized as the name of a cmdlet, function, script file, or operable program`, PostgreSQL's `bin` folder isn't in your PATH. Fix it one of two ways:
>
> **Option A — Add to PATH temporarily (for this session):**
> ```powershell
> $env:PATH += ";C:\Program Files\PostgreSQL\18\bin"
> ```
> **Option B — Use the full path directly:**
> ```powershell
> & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
> ```
> Not sure which version? Run: `Get-ChildItem "C:\Program Files\PostgreSQL"`

```powershell
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE qa_copilot;

# Exit
\q
```

**Update connection string in `backend/.env`:**
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/qa_copilot
```

**Run migration:**
```powershell
python scripts/run_migration.py
```

### 4. Configure Environment Variables

**Copy template:**
```powershell
Copy-Item backend\.env.example backend\.env
```

**Edit `backend/.env` with your credentials:**
```env
# Google Gemini API
GOOGLE_API_KEY=your-gemini-api-key-here
LLM_MODEL=gemini-2.0-flash-exp
LLM_TEMPERATURE=0.3

# Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/qa_copilot

# JWT Authentication
JWT_SECRET_KEY=change-this-to-a-secure-random-string
JWT_EXPIRATION_HOURS=24

# SMTP (Optional - for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
APP_URL=http://localhost:3000
```

**Generate secure JWT secret:**
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 5. Setup Frontend

```powershell
cd frontend
npm install
cd ..
```

### 6. Start the Application

**Terminal 1 - Backend:**
```powershell
.\scripts\start_backend.ps1
```

**Terminal 2 - Frontend:**
```powershell
.\scripts\start_frontend.ps1
```

**Access:** http://localhost:3000

---

## First-Time Setup

### Create Your Account
1. Navigate to http://localhost:3000
2. Click **Sign Up**
3. Enter username, email, password
4. Create your first team (optional)
5. Start generating test cases!

### Manage Your Profile
Access your profile by clicking the avatar circle in the top-right navigation bar:

- **Upload a profile photo** — Hover over the avatar circle in the dropdown → click the camera icon → select an image (JPG, PNG, GIF, or WebP, max 2 MB)
- **Edit your display name** — Hover over your name in the dropdown → click the pencil icon → type your new name → press **Enter** or click **Save**
- **Edit your username** — Hover over your @username → click the pencil icon → type a new username → availability is checked in real-time (must be 3+ chars, alphanumeric/underscore only) → click **Save**

> Profile photos are stored as base64 in the database. Username changes are validated for uniqueness before saving.

### Configure Integrations (Optional)

#### Jira Setup:
1. Go to Settings → Integrations → Jira
2. Enter Jira URL, Email, API Token (all fields required)
3. Click **Save & Test Connection**
4. Use Integration tab to fetch tickets

#### Azure DevOps Setup:
1. Go to Settings → Integrations → Azure DevOps
2. Enter Organization URL, PAT, Project Name (all fields required)
3. Click **Save & Test Connection**
4. Use Integration tab to fetch work items

#### Xray Setup:
1. Go to Settings → Integrations → Xray
2. Enter Project Key (required)
3. Click **Save**

#### Zephyr Scale Setup:
1. Go to Settings → Integrations → Zephyr
2. Enter Zephyr Token and Project Key (both required)
3. Click **Save**

#### TestRail Setup:
1. Go to Settings → Integrations → TestRail
2. Enter TestRail URL, Email, API Key, Project ID (all fields required)
3. Click **Save & Test Connection**

---

## Usage Guide

### Generate Test Cases

**Option 1: From Integration (Recommended)**
1. Go to **Integration** tab
2. Select Jira or Azure DevOps
3. Enter ticket ID (e.g., `PROJ-123` or `12345`)
4. Click **Fetch Ticket**
5. *(Optional)* Upload screenshots or code/config files for deeper AI analysis
6. Click **Generate Tests**
7. Wait 4-5 minutes for AI agents to complete
8. View results and download Excel

**Option 2: Manual Input**
1. Go to **Create** tab
2. Enter ticket details manually
3. *(Optional)* Upload screenshots or code/config files for deeper AI analysis
4. Click **Generate Tests**
5. View results and download Excel

### Attach Files for Code-Aware Generation

Both the **Custom** and **Integration** tabs support uploading source code or config files alongside your ticket. The AI agents read the files and derive test cases from the actual implementation.

**Supported file types:** `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.java`, `.cs`, `.go`, `.rb`, `.php`, `.html`, `.css`, `.json`, `.yaml`, `.yml`, `.sql`, `.md`, `.txt`, `.vue`, `.kt`, `.swift`, `.cpp`, `.c`

**Limits:** up to **3 files**, max **500 KB each** (~1,500–2,000 lines is the recommended sweet spot)

1. In the test generation form, scroll to the **Code / Config Files** section below the screenshot uploader
2. Click the upload zone or drag and drop one or more files
3. Files appear as a list with name and size — click ✕ to remove any
4. Proceed to click **Generate Test Cases** as normal

> The AI will analyze the uploaded code, identify functions, validation logic, error handling paths, and boundary conditions, and produce test cases that reference the actual implementation rather than just the ticket description.

### Sync Back to Tickets
1. After generation, open detail view
2. Click **Sync** dropdown
3. Choose:
   - **Full Sync** - Excel + Comment
   - **Attach Excel Only**
   - **Add Comment Only**
4. Confirm sync

### Export to Test Management Tools
1. After generation, open detail view
2. Click **Export to Test Tool** button
3. Choose target tool:
   - **Xray for Jira** - Creates Test Set and Test issues
   - **Zephyr Scale** - Creates Test Cycle and Test Cases
   - **TestRail** - Creates Test Suite and Cases
4. Enter suite/cycle name (required for TestRail, optional for others)
5. Click **Export**
6. Test cases are created in your test management tool with:
   - All test steps and expected results
   - Priority mapping
   - Links to source tickets (if available)

### Refine Generated Results
1. After generation, open detail view
2. Click **Refine Results** button (indigo)
3. Choose refinement type:
   - **Regenerate Entire** - Run all AI agents again (4-5 min)
   - **Minimize Test Cases** - Remove redundant tests, reduce by 20-40%
   - **Focus on Area** - Generate 5-10 additional tests for a specific area (e.g., "authentication", "error handling")
   - **Add Edge Cases** - Add boundary conditions, race conditions, special scenarios
   - **Increase Coverage** - Generate tests to address identified coverage gaps
   - **Simplify Tests** - Make test cases more concise and easier to read
4. Wait for refinement to complete
5. New refined generation appears in history
6. Compare original vs refined versions

**Note:** All refinements create new generations, so you can always compare before/after results.

### View History
- Go to **History** tab
- View all previous generations
- Click any row to view details
- Download Excel from history
- Compare original and refined versions

---

## Scripts Reference

All utility scripts are in the `/scripts` folder:

- **`start_backend.ps1`** - Start backend API server (port 5000)
- **`start_frontend.ps1`** - Start frontend React dev server (port 3000)
- **`run_migration.py`** - Run database migrations
- **`clear_database.ps1`** - Reset database (⚠️ destructive)

**Usage:**
```powershell
.\scripts\start_backend.ps1
python scripts/run_migration.py
```

---

## Performance Tips

- Use `gemini-2.0-flash-exp` for faster generation (set in `backend/.env`)
- Close unnecessary browser tabs during generation
- Ensure stable internet connection (agents make multiple API calls)

---

**Built for QA teams to accelerate test case creation with AI** 🚀
