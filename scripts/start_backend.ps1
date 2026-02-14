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
    Write-Host "Please copy .env.example to .env and configure it:" -ForegroundColor Red
    Write-Host "  cp .env.example .env" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Generate encryption key if needed
Write-Host ""
Write-Host "Checking encryption key..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "ENCRYPTION_KEY=(?!your-fernet)") {
    Write-Host "Generating encryption key..." -ForegroundColor Yellow
    $key = python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    Write-Host "Add this to your .env file:" -ForegroundColor Green
    Write-Host "ENCRYPTION_KEY=$key" -ForegroundColor Cyan
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
