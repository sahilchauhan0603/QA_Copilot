"""
Database Migration Script
Adds workspace isolation columns to existing database
"""
import sqlite3
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_database(db_path: str = None):
    """
    Run database migration to add workspace columns
    
    Args:
        db_path: Path to database file (defaults to ticket_test.db in project root)
    """
    if db_path is None:
        # Get project root (parent of database directory)
        project_root = Path(__file__).parent.parent
        db_path = project_root / "ticket_test.db"
    
    if not os.path.exists(db_path):
        logger.info(f"Database doesn't exist yet at {db_path}, will be created with new schema")
        return
    
    logger.info(f"Migrating database at {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(generations)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'user_id' in columns and 'team_id' in columns:
            logger.info("Migration already applied - columns exist")
            conn.close()
            return
        
        # Read migration SQL
        migration_path = Path(__file__).parent / "add_workspace_columns.sql"
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        # Execute migration
        conn.executescript(migration_sql)
        conn.commit()
        
        logger.info("Migration completed successfully")
        logger.info("Added user_id and team_id columns to generations table")
        
        conn.close()
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == '__main__':
    migrate_database()
    logger.info("Database migration complete!")
