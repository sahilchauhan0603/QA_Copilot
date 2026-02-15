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
cd c:\THIS_DEVICE\VSCode\PROJECTS\TicketToTest_AI_2
```

### 2. Setup Python Environment
```powershell
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

**⚠️ Important:** Ensure you see `(venv)` in your terminal before installing packages.

### 3. Setup PostgreSQL Database

**Create database:**
```powershell
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ticket_to_test;

# Exit
\q
```

**Update connection string in `.env`:**
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ticket_to_test
```

**Run migration:**
```powershell
python scripts/run_migration.py
```

### 4. Configure Environment Variables

**Copy template:**
```powershell
Copy-Item .env.example .env
```

**Edit `.env` with your credentials:**
```env
# Google Gemini API
GOOGLE_API_KEY=your-gemini-api-key-here
LLM_MODEL=gemini-2.0-flash-exp
LLM_TEMPERATURE=0.3

# Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ticket_to_test

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

# Jira Integration (Optional)
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_token

# Azure DevOps Integration (Optional)
AZURE_DEVOPS_ORG=https://dev.azure.com/your-org
AZURE_DEVOPS_PAT=your_devops_token
AZURE_DEVOPS_PROJECT=YourProject
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
4. Create your first team
5. Start generating test cases!

### Configure Integrations (Optional)

#### Jira Setup:
1. Go to Settings → Integrations → Jira
2. Enter Jira URL, Email, API Token
3. Click **Save & Test Connection**
4. Use Integration tab to fetch tickets

#### Azure DevOps Setup:
1. Go to Settings → Integrations → Azure DevOps
2. Enter Organization URL, PAT, Project Name
3. Click **Save & Test Connection**
4. Use Integration tab to fetch work items

#### Test Management Tools Setup (Optional):

**Xray for Jira:**
1. Uses your existing Jira credentials
2. Add to `.env`:
   ```
   XRAY_PROJECT_KEY=PROJ
   ```
3. Export test cases directly to Xray Test Sets

**Zephyr Scale:**
1. Generate API token from Zephyr Scale settings
2. Add to `.env`:
   ```
   ZEPHYR_API_TOKEN=your_zephyr_token
   ZEPHYR_PROJECT_KEY=PROJ
   ```
3. Export test cases to Zephyr Test Cycles

**TestRail:**
1. Generate API key from TestRail account settings
2. Add to `.env`:
   ```
   TESTRAIL_URL=https://yourcompany.testrail.io
   TESTRAIL_EMAIL=your@email.com
   TESTRAIL_API_KEY=your_api_key
   TESTRAIL_PROJECT_ID=1
   ```
3. Export test cases to TestRail Test Suites

---

## Usage Guide

### Generate Test Cases

**Option 1: From Integration (Recommended)**
1. Go to **Integration** tab
2. Select Jira or Azure DevOps
3. Enter ticket ID (e.g., `PROJ-123` or `12345`)
4. Click **Fetch Ticket**
5. Click **Generate Tests**
6. Wait 4-5 minutes for AI agents to complete
7. View results and download Excel

**Option 2: Manual Input**
1. Go to **Create** tab
2. Enter ticket details manually
3. Click **Generate Tests**
4. View results and download Excel

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
4. (Optional) Enter suite/cycle name
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

## Troubleshooting

### Database Connection Failed
```powershell
# Check PostgreSQL is running
Get-Service postgresql*

# Test connection
psql -U postgres -d ticket_to_test
```

### Backend Won't Start
```powershell
# Kill existing Python processes
Stop-Process -Name python -Force

# Check port 5000 is free
netstat -ano | findstr :5000

# Restart backend
.\scripts\start_backend.ps1
```

### Frontend Won't Start
```powershell
# Clear node_modules and reinstall
cd frontend
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

### Module Not Found Error
```powershell
# Ensure venv is activated
.\venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Password Reset Emails Not Sending
- Get Gmail App Password: https://myaccount.google.com/apppasswords
- Update SMTP credentials in `.env`
- Restart backend

### Integration Connection Failed
- **Jira:** Verify URL includes `https://`, check API token hasn't expired
- **Azure DevOps:** Ensure PAT has Work Items Read/Write permissions
- Test credentials in Settings → Integrations

---

## Scripts Reference

All utility scripts are in the `/scripts` folder:

- **`start_backend.ps1`** - Start Flask API server (port 5000)
- **`start_frontend.ps1`** - Start React dev server (port 3000)
- **`run_migration.py`** - Run database migrations
- **`check_database.py`** - Check database connection and data
- **`reset_database.ps1`** - Reset database (⚠️ destructive)

**Usage:**
```powershell
.\scripts\start_backend.ps1
python scripts/run_migration.py
```

---

## Performance Tips

- Use `gemini-2.0-flash-exp` for faster generation (set in `.env`)
- Close unnecessary browser tabs during generation
- Ensure stable internet connection (agents make multiple API calls)

---

**Built for QA teams to accelerate test case creation with AI** 🚀
