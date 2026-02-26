# Reset Database Script
# Clears application data using DATABASE_URL from .env and database/clear_database.sql.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Reset Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will DELETE ALL DATA from your database!" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Type 'yes' to continue"

if ($confirm -ne "yes") {
    Write-Host "Database reset cancelled." -ForegroundColor Green
    exit 0
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$resetSql = Join-Path $projectRoot "database\clear_database.sql"

if (-not (Test-Path $venvPython)) {
    Write-Host "[ERROR] venv python not found at: $venvPython" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $resetSql)) {
    Write-Host "[ERROR] SQL file not found at: $resetSql" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Resetting database using DATABASE_URL from .env..." -ForegroundColor Cyan

$pythonScript = @"
from pathlib import Path
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

project_root = Path(r"$projectRoot")
load_dotenv(dotenv_path=project_root / ".env")

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise SystemExit("DATABASE_URL not found in .env")

sql_path = project_root / "database" / "clear_database.sql"
sql = sql_path.read_text(encoding="utf-8")

engine = create_engine(database_url)
with engine.connect() as conn:
    conn.execute(text(sql))
    conn.commit()

print("Database reset completed successfully.")
"@

& $venvPython -c $pythonScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Database reset successfully!" -ForegroundColor Green
    Write-Host "All application data is now cleared." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERROR] Database reset failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host ""
