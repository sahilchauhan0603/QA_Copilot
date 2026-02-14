# Quick Start Script for Backend
# Run this after setting up .env file

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "QA Copilot - Backend Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure it:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Copy-Item .env.example .env" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then edit .env with your credentials:" -ForegroundColor Yellow
    Write-Host "  - GOOGLE_API_KEY (required)" -ForegroundColor Yellow
    Write-Host "  - DATABASE_URL (required)" -ForegroundColor Yellow
    Write-Host "  - JWT_SECRET_KEY (required)" -ForegroundColor Yellow
    Write-Host "  - ENCRYPTION_KEY (required)" -ForegroundColor Yellow
    Write-Host "  - SMTP settings (optional - for password reset)" -ForegroundColor Yellow
    Write-Host "  - Integration settings (optional - for Jira/DevOps)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Generate encryption key if needed
Write-Host ""
Write-Host "Checking encryption key..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "ENCRYPTION_KEY=(?!your-fernet)[\w\-_]+") {
    Write-Host ""
    Write-Host "WARNING: ENCRYPTION_KEY not properly configured!" -ForegroundColor Yellow
    $key = python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    Write-Host "Generated encryption key. Add this to your .env file:" -ForegroundColor Green
    Write-Host ""
    Write-Host "ENCRYPTION_KEY=$key" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C to exit and update .env, or Enter to continue..." -ForegroundColor Yellow
    Read-Host
}

# Initialize database
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
python -c "from database.connection import init_database; init_database()"

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Starting API server..." -ForegroundColor Yellow
Write-Host "Server will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""

# Start server
python -m api.server
