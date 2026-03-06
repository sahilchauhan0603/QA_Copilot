# QA Copilot - Deployment Guide

Simple deployment guide using **100% free services**:
- **Database**: Supabase (500MB free)
- **Backend**: Render (Free tier)
- **Frontend**: Render (Free tier)

---

## Quick Setup (15 minutes)

### Prerequisites
- GitHub account (code must be in a repo)
- [Supabase](https://supabase.com) account
- [Render](https://render.com) account
- [Google Gemini API Key](https://makersuite.google.com/app/apikey)

---

## Step 1: Database (Supabase) - 3 minutes

1. **Create Supabase Account**
   - Go to [supabase.com](https://supabase.com) → Sign in with GitHub

2. **Create New Project**
   - Click **"New Project"**
   - **Name**: `qa-copilot`
   - **Database Password**: Create strong password (save it!)
   - **Region**: Choose closest to you
   - **Plan**: Free
   - Click **"Create new project"** (wait ~2 mins)

3. **Get Database URL**
   - Settings → Database → **Connection string** section
   - Under "Type", select **URI**
   - Under "Method", select **Connection pooling** (NOT Direct connection)
   - You'll see a URL like:
     ```
     postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with your actual password
   - **Important**: Must use port **6543** (pooler) not 5432 for Render!
   - **Save this URL** - you'll need it!

✅ Database ready!

---

## Step 2: Run Migration (Locally) - 2 minutes

Run this from **your computer** to initialize the database:

```powershell
# In your project folder
cd c:\THIS_DEVICE\VSCode\PROJECTS\QA_Copilot

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Set DATABASE_URL (use your Supabase URL from Step 1)
$env:DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-...supabase.com:6543/postgres"

# Run migration
python scripts/run_migration.py
```

You should see: **"🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!"**

✅ Database initialized!

---

## Step 3: Backend (Render) - 8 minutes

1. **Create Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository

2. **Configure Service**
   - **Name**: `qa-copilot-backend`
   - **Region**: Same as Supabase (e.g., Oregon)
   - **Branch**: `main`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --workers 4 --bind 0.0.0.0:$PORT --timeout 120 api.server:app`
   - **Instance Type**: Free

3. **Add Environment Variables**
   Click **"Advanced"** → Add these variables:

   | Variable | Value | How to Get |
   |----------|-------|------------|
   | `DATABASE_URL` | Your Supabase URL | From Step 1 |
   | `GOOGLE_API_KEY` | Your Gemini API key | [Get here](https://makersuite.google.com/app/apikey) |
   | `FLASK_SECRET_KEY` | Random string | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
   | `JWT_SECRET_KEY` | Random string | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
   | `ENCRYPTION_KEY` | Fernet key | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
   | `LLM_MODEL` | `gemini-2.0-flash-exp` | |
   | `LLM_TEMPERATURE` | `0.3` | |
   | `FLASK_DEBUG` | `false` | |
   | `SQL_ECHO` | `false` | |

   **Optional (for email password reset):**
   | Variable | Value |
   |----------|-------|
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Your Gmail |
   | `SMTP_PASSWORD` | Gmail app password |
   | `FROM_EMAIL` | Your email |
   | `FROM_NAME` | `QA Copilot` |

4. **Deploy**
   - Click **"Create Web Service"**
   - Wait 5-10 minutes for first build
   - Once live, your backend URL: `https://qa-copilot-backend.onrender.com`

5. **Test Backend**
   - Visit: `https://qa-copilot-backend.onrender.com/api/health`
   - Should return: `{"status":"healthy"}`

✅ Backend deployed!

---

## Step 4: Frontend (Render) - 5 minutes

1. **Create Static Site**
   - Render Dashboard → **"New +"** → **"Static Site"**
   - Connect same GitHub repository

2. **Configure Static Site**
   - **Name**: `qa-copilot-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

3. **Add Environment Variable**
   - Click **"Advanced"**
   - Add variable:
     - **Key**: `VITE_API_URL`
     - **Value**: `https://qa-copilot-backend.onrender.com/api` (your backend URL)

4. **Deploy**
   - Click **"Create Static Site"**
   - Wait 3-5 minutes
   - Your frontend URL: `https://qa-copilot-frontend.onrender.com`

5. **Fix React Router** (Important!)
   - Create file: `frontend/public/_redirects`
   - Add this line:
     ```
     /*    /index.html   200
     ```
   - Commit and push to trigger redeploy

✅ Frontend deployed!

---

## Final Setup - Update Backend Email URL

1. **Go to Render Backend Settings**
   - Find your backend service
   - Environment → Add/Update:
     - **Key**: `APP_URL`
     - **Value**: `https://qa-copilot-frontend.onrender.com` (your frontend URL)

2. **Save** - Render will auto-redeploy

---

## 🎉 Deployment Complete!

### Important Notes
- **Free tier limitations**: Services sleep after 15 min inactivity (30s cold start)
- **Auto-deploy**: Push to GitHub → Automatic deployment
- **Logs**: View in Render dashboard
- **Custom domain**: Can add in Render settings

---