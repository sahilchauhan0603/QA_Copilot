# Quick Start Script for Backend
# Run this after setting up .env file

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

# Set PYTHONPATH so Python can find all backend packages
$env:PYTHONPATH = "$projectRoot\backend"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "QA Copilot - Backend Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$venvDir = Join-Path $projectRoot "venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

# Check if virtual environment exists
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv $venvDir
}

# Use venv python directly (robust after folder rename)
if (-not (Test-Path $venvPython)) {
    Write-Host "ERROR: venv python not found at $venvPython" -ForegroundColor Red
    exit 1
}

Write-Host "Using virtual environment: $venvPython" -ForegroundColor Yellow

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements.txt

# Check if .env exists
if (-not (Test-Path "backend\.env")) {
    Write-Host ""
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy backend\.env.example to backend\.env and configure it:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Copy-Item backend\.env.example backend\.env" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then edit backend\.env with your credentials:" -ForegroundColor Yellow
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
$envContent = Get-Content backend\.env -Raw
if ($envContent -notmatch "ENCRYPTION_KEY=(?!your-fernet)[\w\-_]+") {
    Write-Host ""
    Write-Host "WARNING: ENCRYPTION_KEY not properly configured!" -ForegroundColor Yellow
    $key = & $venvPython -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    Write-Host "Generated encryption key. Add this to your .env file:" -ForegroundColor Green
    Write-Host ""
    Write-Host "ENCRYPTION_KEY=$key" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C to exit and update .env, or Enter to continue..." -ForegroundColor Yellow
    Read-Host
}

# Initialize database (load .env first so DATABASE_URL is available)
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
& $venvPython -c "import sys, os; sys.path.insert(0, r'$projectRoot\backend'); from dotenv import load_dotenv; load_dotenv(r'$projectRoot\backend\.env'); from database.connection import init_database; init_database()"

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Starting API server..." -ForegroundColor Yellow
Write-Host "Server will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""

# Start server (run from project root; PYTHONPATH points to backend/)
& $venvPython -m api.server
