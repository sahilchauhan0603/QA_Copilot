# Reset Database Script
# This script clears all data from the database and resets sequences

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Reset Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will DELETE ALL DATA from your database!" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Are you sure you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Database reset cancelled." -ForegroundColor Green
    exit
}

Write-Host ""
Write-Host "Resetting database..." -ForegroundColor Cyan

# Add PostgreSQL to PATH if not already there
$pgPath = "C:\Program Files\PostgreSQL\18\bin"
if ($env:Path -notlike "*$pgPath*") {
    $env:Path += ";$pgPath"
}

# Run the SQL script
$env:PGPASSWORD = "bmw"
psql -U postgres -d ticket_to_test -f database\clear_database.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Database reset successfully!" -ForegroundColor Green
    Write-Host "All tables are now empty and ready for fresh data." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERROR] Database reset failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Red
}

Write-Host ""
