#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Add test management tool enums to PostgreSQL database
.DESCRIPTION
    Adds xray, zephyr, and testrail values to the integration_type enum
#>

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Add Test Management Enums Migration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env if it exists
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envPath) {
    Write-Host "Loading database config from .env..." -ForegroundColor Yellow
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Get database connection details
$dbHost = $env:DB_HOST ?? "localhost"
$dbPort = $env:DB_PORT ?? "5432"
$dbName = $env:DB_NAME ?? "ticket_to_test"
$dbUser = $env:DB_USER ?? "postgres"

Write-Host "Database: $dbName @ $dbHost`:$dbPort" -ForegroundColor Gray
Write-Host ""

# Build connection string
$env:PGPASSWORD = Read-Host -Prompt "Enter PostgreSQL password for user '$dbUser'" -AsSecureString | ConvertFrom-SecureString -AsPlainText

# SQL migration file
$sqlFile = Join-Path $PSScriptRoot ".." "database" "add_test_management_enums.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: Migration file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Running migration..." -ForegroundColor Yellow
Write-Host ""

# Run the migration
try {
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now:" -ForegroundColor Cyan
        Write-Host "  1. Refresh your browser" -ForegroundColor White
        Write-Host "  2. Configure test management tools in Settings" -ForegroundColor White
        Write-Host "  3. Export tests to Xray, Zephyr, or TestRail" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "✗ Migration failed. Check the errors above." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "✗ Error running migration: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
