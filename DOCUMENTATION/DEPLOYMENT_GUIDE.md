<div align="center">

# 🚀 QA Copilot — Deployment Guide

**Deploy the full stack in ~15 minutes using 100% free-tier services.**

| Layer | Service | Free Tier |
|---|---|---|
| 🗄️ Database | [Supabase](https://supabase.com) | 500 MB |
| ⚙️ Backend | [Render](https://render.com) | Free Web Service |
| 🖥️ Frontend | [Render](https://render.com) | Free Static Site |

</div>

---

## ✅ Prerequisites

- GitHub account (code must be in a repo)
- [Supabase](https://supabase.com) account
- [Render](https://render.com) account
- [Google Gemini API key](https://makersuite.google.com/app/apikey)

---

## Step 1 — Database Setup (Supabase) · ~3 min

1. Go to [supabase.com](https://supabase.com) → **Sign in with GitHub**
2. **New Project** →
   - **Name**: `qa-copilot`
   - **Database Password**: create a strong one and **save it**
   - **Region**: closest to you
   - **Plan**: Free
   - Click **Create new project** (~2 min provisioning)
3. Get your connection string:
   - **Settings → Database → Connection string**
   - **Type**: `URI` · **Method**: `Connection pooling` (⚠️ not Direct connection)
   - You'll get something like:
     ```
     postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with your real password
   - ⚠️ **Must use port `6543`** (pooler), not `5432` — required for Render compatibility
   - **Save this full URL** — you'll reuse it in Steps 2 and 3

> ✅ **Checkpoint:** Database created and connection string saved.

---

## Step 2 — Run Migration Locally · ~2 min

From your local machine, initialize the schema against your new Supabase database:

```powershell
# Navigate to your project folder
cd c:\THIS_DEVICE\VSCode\PROJECTS\QA_Copilot

# Activate your virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies (skip if already installed)
pip install -r requirements.txt

# Set the DATABASE_URL from Step 1
$env:DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-...supabase.com:6543/postgres"

# Run the migration
python scripts/run_migration.py
```

Look for: **`🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!`**

> ✅ **Checkpoint:** Database schema initialized.

---

## Step 3 — Backend Deployment (Render) · ~8 min

### 3.1 Create the Web Service
- [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**
- Connect your GitHub repository

### 3.2 Configure
| Setting | Value |
|---|---|
| **Name** | `qa-copilot-backend` |
| **Region** | Same as Supabase (e.g., Oregon) |
| **Branch** | `main` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `PYTHONPATH=backend gunicorn --workers 4 --bind 0.0.0.0:$PORT --timeout 120 api.server:app` |
| **Instance Type** | Free |

### 3.3 Environment Variables

**Required:**

| Variable | Value / How to Get |
|---|---|
| `DATABASE_URL` | Supabase URL from Step 1 |
| `GOOGLE_API_KEY` | [Get here](https://makersuite.google.com/app/apikey) |
| `FLASK_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `JWT_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `PYTHONPATH` | `backend` |
| `LLM_MODEL` | `gemini-2.0-flash-exp` |
| `LLM_TEMPERATURE` | `0.3` |
| `FLASK_DEBUG` | `false` |
| `SQL_ECHO` | `false` |

**Optional — only if using email-based password reset:**

| Variable | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASSWORD` | Gmail app password |
| `FROM_EMAIL` | Your email |
| `FROM_NAME` | `QA Copilot` |

### 3.4 Deploy & Verify
- Click **Create Web Service** → first build takes 5–10 min
- Backend URL: `https://qa-copilot-backend.onrender.com`
- Test it: visit `https://qa-copilot-backend.onrender.com/api/health` → expect `{"status":"healthy"}`

> ✅ **Checkpoint:** Backend live and responding to health checks.

---

## Step 4 — Frontend Deployment (Render) · ~5 min

### 4.1 Create the Static Site
- Render Dashboard → **New +** → **Static Site**
- Connect the same GitHub repository

### 4.2 Configure
| Setting | Value |
|---|---|
| **Name** | `qa-copilot-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `frontend/dist` |

### 4.3 Environment Variable
| Key | Value |
|---|---|
| `VITE_API_URL` | `https://qa-copilot-backend.onrender.com/api` (your backend URL) |

### 4.4 Deploy
- Click **Create Static Site** → live in 3–5 min
- Frontend URL: `https://qa-copilot-frontend.onrender.com`

### 4.5 Fix Client-Side Routing (Required)
React Router needs a rewrite rule so page refreshes don't 404.

Create `frontend/public/_redirects`:
```
/*    /index.html   200
```
Commit and push — this triggers a redeploy.

> ✅ **Checkpoint:** Frontend live with working client-side routes.

---

## Step 5 — Connect Backend to Frontend

Update the backend so password-reset emails and links point to your live frontend:

- Backend service → **Environment** → add:

| Key | Value |
|---|---|
| `APP_URL` | `https://qa-copilot-frontend.onrender.com` (your frontend URL) |

Render will auto-redeploy after saving.

---

## 🎉 Deployment Complete!

<div align="center">

| Component | URL |
|---|---|
| 🖥️ Frontend | `https://qa-copilot-frontend.onrender.com` |
| ⚙️ Backend | `https://qa-copilot-backend.onrender.com` |
| 🗄️ Database | Supabase project dashboard |

</div>

### 📌 Good to Know

- **Cold starts**: Free-tier services sleep after 15 min of inactivity (~30s to wake on next request)
- **Auto-deploy**: Every push to `main` triggers a redeploy automatically
- **Logs**: Available live in each service's Render dashboard
- **Custom domains**: Can be added under each service's Render settings