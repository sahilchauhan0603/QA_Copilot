# TicketToTest AI - Deployment Guide

This guide provides comprehensive instructions for deploying the TicketToTest AI application to production, covering both frontend and backend components.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Deployment](#database-deployment)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Deployment Platforms](#deployment-platforms)
- [Post-Deployment](#post-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Python 3.9+** (for backend)
- **Node.js 18+** and npm (for frontend)
- **PostgreSQL 13+** (database)
- **Git** (version control)
- **Domain name** (for production)
- **SSL Certificate** (recommended for HTTPS)

### Required Accounts/API Keys
- Google Gemini API Key (GOOGLE_API_KEY)
- SMTP server credentials (for email functionality)
- Integration API keys (Jira, Azure DevOps, etc.) - if using integrations

---

## Environment Variables

### Backend Environment Variables
Create a `.env` file in the project root with the following variables:

```env
# Google Gemini AI
GOOGLE_API_KEY=your-google-gemini-api-key
LLM_MODEL=gemini-2.0-flash-exp
LLM_TEMPERATURE=0.3

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://username:password@host:port/database_name

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
FROM_NAME=Your App Name
APP_URL=https://yourdomain.com

# Credential Encryption (AES-256 Fernet) (for storing sensitive integration credentials)
ENCRYPTION_KEY=your-fernet-encryption-key-44-characters

# SQL Echo (for debugging)
SQL_ECHO=false
```

**Note:** Integration credentials (Jira, Azure DevOps, TestRail, etc.) are configured through the UI in Settings → Integrations and stored encrypted in the database. They are not required in the `.env` file.

### Frontend Environment Variables
Create a `.env` file in the `frontend/` directory:

```env
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api
```
---

## Database Deployment

### Option 1: Self-Hosted PostgreSQL

#### 1. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 2. Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell
CREATE DATABASE ticket_to_test;
CREATE USER your_username WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ticket_to_test TO your_username;
\q
```

#### 3. Configure PostgreSQL for Remote Access (if needed)
Edit `/etc/postgresql/13/main/postgresql.conf`:
```
listen_addresses = '*'
```

Edit `/etc/postgresql/13/main/pg_hba.conf`:
```
host    all             all             0.0.0.0/0               md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

#### 4. Run Database Migrations
```bash
cd /path/to/TicketToTest_AI_2
python scripts/run_migration.py
```

### Option 2: Managed Database Services

#### AWS RDS (PostgreSQL)
1. Create RDS PostgreSQL instance via AWS Console
2. Configure security groups to allow connections
3. Note the endpoint URL
4. Use connection string: `postgresql://username:password@endpoint:5432/database_name`

#### Azure Database for PostgreSQL
1. Create Azure Database for PostgreSQL via Azure Portal
2. Configure firewall rules
3. Use connection string from Azure Portal

#### Google Cloud SQL (PostgreSQL)
1. Create Cloud SQL PostgreSQL instance
2. Configure authorized networks
3. Use connection string from Google Cloud Console

#### Heroku Postgres
1. Add Heroku Postgres add-on: `heroku addons:create heroku-postgresql:standard-0`
2. Connection string automatically set in DATABASE_URL

#### Supabase
1. Create project at supabase.com
2. Get connection string from project settings
3. Use the pooler connection string for production

### Database Backup Strategy
```bash
# Backup database
pg_dump -h localhost -U your_username -d ticket_to_test > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql -h localhost -U your_username -d ticket_to_test < backup_file.sql

# Automated backup (cron job - runs daily at 2 AM)
0 2 * * * pg_dump -h localhost -U your_username -d ticket_to_test > /backups/backup_$(date +\%Y\%m\%d).sql
```

---

## Backend Deployment

### Preparation

#### 1. Install Dependencies
```bash
cd /path/to/TicketToTest_AI_2
pip install -r requirements.txt
```

#### 2. Set Environment Variables
- Copy the backend `.env` file to the server
- Update all values for production
- Ensure secure keys are generated

#### 3. Test Backend Locally
```bash
# Test the server runs without errors
python api/server.py
```

### Deployment Options

### Option 1: Traditional Linux Server (Ubuntu/Debian)

#### 1. Set Up the Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and dependencies
sudo apt install python3 python3-pip python3-venv nginx -y

# Create application user
sudo useradd -m -s /bin/bash tickettotest
sudo su - tickettotest
```

#### 2. Deploy Application
```bash
# Clone repository (or upload files)
git clone <your-repo-url> /home/tickettotest/app
cd /home/tickettotest/app

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
nano .env  # Add your environment variables
```

#### 3. Set Up Gunicorn with Systemd
Create `/etc/systemd/system/tickettotest.service`:
```ini
[Unit]
Description=TicketToTest AI Backend
After=network.target

[Service]
User=tickettotest
Group=tickettotest
WorkingDirectory=/home/tickettotest/app
Environment="PATH=/home/tickettotest/app/venv/bin"
ExecStart=/home/tickettotest/app/venv/bin/gunicorn \
    --workers 4 \
    --worker-class sync \
    --bind 0.0.0.0:5000 \
    --timeout 120 \
    --access-logfile /home/tickettotest/app/logs/access.log \
    --error-logfile /home/tickettotest/app/logs/error.log \
    api.server:app

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Create log directory:
```bash
mkdir -p /home/tickettotest/app/logs
```

Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tickettotest
sudo systemctl start tickettotest
sudo systemctl status tickettotest
```

#### 4. Configure Nginx as Reverse Proxy
Create `/etc/nginx/sites-available/tickettotest`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logging
    access_log /var/log/nginx/tickettotest-access.log;
    error_log /var/log/nginx/tickettotest-error.log;

    # Proxy settings
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # For SSE (Server-Sent Events)
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        
        # Timeout settings
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Max body size for file uploads
    client_max_body_size 10M;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/tickettotest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. Set Up SSL with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is automatic with systemd timer
sudo systemctl status certbot.timer
```

### Option 2: Docker Deployment

#### Create `Dockerfile` in project root:
```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 5000

# Run with Gunicorn
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5000", "--timeout", "120", "api.server:app"]
```

#### Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: tickettotest-db
    environment:
      POSTGRES_DB: ticket_to_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  backend:
    build: .
    container_name: tickettotest-backend
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/ticket_to_test
      - FLASK_SECRET_KEY=${FLASK_SECRET_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    ports:
      - "5000:5000"
    depends_on:
      - db
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

volumes:
  postgres_data:
```

#### Deploy with Docker:
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Option 3: Cloud Platform Deployments

#### Heroku
```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Set environment variables
heroku config:set GOOGLE_API_KEY=your-key
heroku config:set FLASK_SECRET_KEY=your-secret
heroku config:set JWT_SECRET_KEY=your-jwt-secret
heroku config:set ENCRYPTION_KEY=your-encryption-key

# Create Procfile in project root
echo "web: gunicorn --workers 4 --bind 0.0.0.0:\$PORT --timeout 120 api.server:app" > Procfile

# Deploy
git push heroku main

# Run migrations
heroku run python scripts/run_migration.py
```

#### AWS Elastic Beanstalk
1. Install EB CLI: `pip install awsebcli`
2. Initialize: `eb init -p python-3.11 tickettotest-backend`
3. Create environment: `eb create tickettotest-prod`
4. Set environment variables in AWS Console
5. Deploy: `eb deploy`

#### Google Cloud Run
```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/tickettotest-backend

# Deploy
gcloud run deploy tickettotest-backend \
  --image gcr.io/PROJECT_ID/tickettotest-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=...,GOOGLE_API_KEY=...
```

#### Azure App Service
```bash
# Create resource group
az group create --name tickettotest-rg --location eastus

# Create App Service plan
az appservice plan create --name tickettotest-plan --resource-group tickettotest-rg --sku B1 --is-linux

# Create web app
az webapp create --resource-group tickettotest-rg --plan tickettotest-plan --name tickettotest-backend --runtime "PYTHON:3.11"

# Configure environment variables
az webapp config appsettings set --resource-group tickettotest-rg --name tickettotest-backend --settings \
  DATABASE_URL="..." \
  GOOGLE_API_KEY="..." \
  FLASK_SECRET_KEY="..."

# Deploy code
az webapp up --name tickettotest-backend --resource-group tickettotest-rg
```

---

## Frontend Deployment

### Preparation

#### 1. Install Dependencies
```bash
cd frontend
npm install
```

#### 2. Configure Environment
Create `.env.production` in `frontend/`:
```env
VITE_API_URL=https://api.yourdomain.com/api
```

#### 3. Build for Production
```bash
npm run build
```
This creates optimized files in `frontend/dist/`.

### Deployment Options

### Option 1: Static Hosting with Nginx (Same Server)

#### Configure Nginx
Add to `/etc/nginx/sites-available/tickettotest`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Root directory
    root /var/www/tickettotest/frontend;
    index index.html;

    # Logging
    access_log /var/log/nginx/tickettotest-frontend-access.log;
    error_log /var/log/nginx/tickettotest-frontend-error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # React Router support - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Deploy Build Files
```bash
# Create directory
sudo mkdir -p /var/www/tickettotest/frontend

# Copy build files
sudo cp -r frontend/dist/* /var/www/tickettotest/frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/tickettotest/frontend
sudo chmod -R 755 /var/www/tickettotest/frontend

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Vercel (Recommended for Frontend)

#### Deploy to Vercel:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from frontend directory
cd frontend
vercel

# Set environment variable in Vercel dashboard
# VITE_API_URL = https://api.yourdomain.com/api

# Production deployment
vercel --prod
```

#### Configure `vercel.json` in `frontend/`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Option 3: Netlify

#### Deploy to Netlify:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy from frontend directory
cd frontend
npm run build
netlify deploy --prod --dir=dist

# Configure environment variables in Netlify dashboard
```

#### Create `netlify.toml` in `frontend/`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Option 4: AWS S3 + CloudFront

```bash
# Build the app
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Option 5: Google Cloud Storage + Cloud CDN

```bash
# Build the app
npm run build

# Upload to GCS
gsutil -m cp -r dist/* gs://your-bucket-name/

# Set public access
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

---

## Post-Deployment

### 1. Verify Deployment

#### Backend Health Check
```bash
curl https://api.yourdomain.com/api/health
# Should return: {"status": "healthy"}
```

#### Frontend Check
1. Visit `https://yourdomain.com`
2. Verify login page loads
3. Test user registration/login
4. Test test generation feature

### 2. Database Initialization

After first deployment, ensure:
- Database tables are created (migration ran successfully)
- Can create users and teams
- Authentication works properly

### 3. Create Admin User (if needed)

```python
# Run Python script on server
from auth.auth_service import AuthService

auth = AuthService()
user = auth.register(
    email="admin@yourdomain.com",
    password="secure-password",
    name="Admin User"
)
print(f"Admin user created: {user['user']['email']}")
```

### 4. Set Up Monitoring

#### Application Logs
```bash
# Backend logs (systemd)
sudo journalctl -u tickettotest -f

# Backend logs (file)
tail -f /home/tickettotest/app/logs/error.log

# Nginx logs
tail -f /var/log/nginx/tickettotest-error.log
```

#### Log Rotation
Create `/etc/logrotate.d/tickettotest`:
```
/home/tickettotest/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 tickettotest tickettotest
    sharedscripts
    postrotate
        systemctl reload tickettotest
    endscript
}
```

---

## Monitoring & Maintenance

### Health Monitoring

#### Add Health Check Endpoint
Already exists in `api/server.py` - verify it works:
```bash
curl https://api.yourdomain.com/api/health
```

#### Set Up Uptime Monitoring
Use services like:
- **UptimeRobot** (free tier available)
- **Pingdom**
- **StatusCake**
- **Better Uptime**

Configure to check both:
- Frontend: `https://yourdomain.com`
- Backend API: `https://api.yourdomain.com/api/health`

### Performance Monitoring

#### Application Performance Monitoring (APM)
Consider integrating:
- **Sentry** (error tracking)
- **New Relic** (full APM)
- **DataDog** (infrastructure + APM)

#### Add Sentry (Example)
```bash
pip install sentry-sdk[flask]
```

Add to `api/server.py`:
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FlaskIntegration()],
    traces_sample_rate=0.1
)
```

### Database Maintenance

#### Regular Backups
```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/tickettotest"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U your_user -d ticket_to_test | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

#### Database Optimization
```sql
-- Run weekly
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE ticket_to_test;
```

### Security Updates

#### Regular Maintenance Tasks
```bash
# Update system packages (monthly)
sudo apt update && sudo apt upgrade -y

# Update Python packages (quarterly)
pip list --outdated
pip install --upgrade <package-name>

# Update Node packages (quarterly)
cd frontend
npm outdated
npm update
```

#### SSL Certificate Renewal
Certbot auto-renews, but verify:
```bash
sudo certbot renew --dry-run
```

### Scaling Considerations

#### Horizontal Scaling (Multiple Backend Instances)
1. Use a load balancer (Nginx, HAProxy, or cloud ALB)
2. Ensure session storage is external (Redis)
3. Use shared file storage if needed

#### Database Scaling
- Enable connection pooling (already configured)
- Consider read replicas for heavy read loads
- Monitor query performance and add indexes

#### Caching Layer
Consider adding Redis for:
- API response caching
- Rate limiting
- Session storage

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection from backend
python -c "from database.connection import init_database; init_database()"

# Verify credentials in .env
echo $DATABASE_URL
```

#### 2. Backend Not Starting
```bash
# Check logs
sudo journalctl -u tickettotest -n 50

# Test manually
source venv/bin/activate
python api/server.py

# Check port availability
sudo netstat -tlnp | grep 5000
```

#### 3. Frontend Build Errors
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 4. CORS Errors
- Verify ALLOWED_ORIGINS in backend .env
- Check frontend VITE_API_URL points to correct backend
- Ensure Nginx proxy headers are set correctly

#### 5. SSL Certificate Issues
```bash
# Test certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check Nginx SSL config
sudo nginx -t
```

### Database Recovery

#### Restore from Backup
```bash
# Stop backend
sudo systemctl stop tickettotest

# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE ticket_to_test;"
sudo -u postgres psql -c "CREATE DATABASE ticket_to_test;"

# Restore
gunzip -c /backups/backup_file.sql.gz | psql -h localhost -U your_user -d ticket_to_test

# Restart backend
sudo systemctl start tickettotest
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All code committed and pushed to repository
- [ ] Environment variables configured for production
- [ ] Secure keys generated (Flask, JWT, Encryption)
- [ ] Database created and accessible
- [ ] SSL certificates ready
- [ ] Domain DNS configured

### Backend Deployment
- [ ] Dependencies installed
- [ ] Database migrations run successfully
- [ ] Environment variables set correctly
- [ ] Gunicorn service running
- [ ] Nginx proxy configured
- [ ] SSL certificate installed
- [ ] Health endpoint accessible
- [ ] Logs being written correctly

### Frontend Deployment
- [ ] Environment variables configured
- [ ] Production build successful
- [ ] Static files deployed
- [ ] Routing works (React Router)
- [ ] API connection working
- [ ] SSL certificate installed

### Post-Deployment
- [ ] Can register new user
- [ ] Login/logout works
- [ ] Test generation works
- [ ] File exports work
- [ ] Integrations connect (if configured)
- [ ] Email notifications work
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Documentation updated

---

## Quick Reference Commands

### Backend Management
```bash
# Start backend
sudo systemctl start tickettotest

# Stop backend
sudo systemctl stop tickettotest

# Restart backend
sudo systemctl restart tickettotest

# View logs
sudo journalctl -u tickettotest -f

# Update code and restart
cd /home/tickettotest/app
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart tickettotest
```

### Frontend Updates
```bash
# Build new version
cd frontend
git pull
npm install
npm run build

# Deploy to server
sudo cp -r dist/* /var/www/tickettotest/frontend/
sudo systemctl reload nginx
```

### Database Commands
```bash
# Backup
pg_dump -h localhost -U user -d ticket_to_test > backup.sql

# Restore
psql -h localhost -U user -d ticket_to_test < backup.sql

# Connect to database
psql -h localhost -U user -d ticket_to_test
```

---

## Support & Resources

- **Application Logs**: `/home/tickettotest/app/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **Database Logs**: `/var/log/postgresql/`
- **Documentation**: `DOCUMENTATION/` folder in project

For additional help, refer to:
- [Installation Guide](DOCUMENTATION/INSTALLATION_GUIDE.md)
- [Test Management Integration](DOCUMENTATION/TEST_MANAGEMENT_INTEGRATION.md)

---

**Last Updated**: February 2026  
**Version**: 1.0.0
