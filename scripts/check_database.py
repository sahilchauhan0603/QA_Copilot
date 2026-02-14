"""
Quick script to verify PostgreSQL migration
"""
from database.connection import DatabaseConnection
from database.models import Generation, TestCase, CoverageGap
from database.auth_models import User, Team, IntegrationCredential
from sqlalchemy import inspect

try:
    print("🔍 Connecting to PostgreSQL...")
    db = DatabaseConnection()
    
    print("✅ Connection successful!")
    print(f"   Database: {db.database_url.split('/')[-1]}")
    
    # Create all tables
    print("\n📊 Creating/verifying tables...")
    db.create_all_tables()
    
    # List all tables
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    
    print(f"\n✅ Found {len(tables)} tables:")
    for table in sorted(tables):
        print(f"   • {table}")
    
    # Verify key tables exist
    required_tables = [
        'users', 'teams', 'team_members',
        'integration_credentials', 
        'generations', 'test_cases', 'coverage_gaps'
    ]
    
    missing = [t for t in required_tables if t not in tables]
    
    if missing:
        print(f"\n❌ Missing tables: {', '.join(missing)}")
    else:
        print("\n✅ All required tables exist!")
        print("\n🎉 PostgreSQL migration successful!")
        print("   You can now run the backend server.")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\n💡 Make sure PostgreSQL is running:")
    print("   • Check if PostgreSQL service is started")
    print("   • Verify DATABASE_URL in .env is correct")
    print("   • Current: postgresql://postgres:bmw@localhost:5432/ticket_to_test")
