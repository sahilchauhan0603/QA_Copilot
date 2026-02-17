#!/usr/bin/env python3
"""
Add test management tool enums to PostgreSQL database
Adds xray, zephyr, and testrail values to the integration_type enum
"""
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import DatabaseConnection
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def run_migration():
    """Run the test management enums migration"""
    
    logger.info("=" * 50)
    logger.info("  Add Test Management Enums Migration")
    logger.info("=" * 50)
    logger.info("")
    
    try:
        # Connect to database
        db = DatabaseConnection()
        
        logger.info("Connected to database successfully")
        logger.info("")
        
        # Use raw connection for DDL operations
        conn = db.engine.raw_connection()
        cursor = conn.cursor()
        
        try:
            # Check current enum values
            logger.info("Checking current integration_type enum values...")
            cursor.execute("""
                SELECT unnest(enum_range(NULL::integration_type))::text;
            """)
            current_values = [row[0] for row in cursor.fetchall()]
            logger.info(f"Current values: {', '.join(current_values)}")
            logger.info("")
            
            # Add new enum values
            new_values = ['xray', 'zephyr', 'testrail']
            
            for value in new_values:
                if value not in current_values:
                    logger.info(f"Adding enum value '{value}'...")
                    try:
                        cursor.execute(f"""
                            ALTER TYPE integration_type ADD VALUE IF NOT EXISTS '{value}';
                        """)
                        conn.commit()
                        logger.info(f"✓ Added '{value}'")
                    except Exception as e:
                        logger.error(f"✗ Failed to add '{value}': {e}")
                        conn.rollback()
                else:
                    logger.info(f"  '{value}' already exists, skipping")
            
            logger.info("")
            
            # Verify final enum values
            logger.info("Verifying final enum values...")
            cursor.execute("""
                SELECT unnest(enum_range(NULL::integration_type))::text;
            """)
            final_values = [row[0] for row in cursor.fetchall()]
            logger.info(f"Final values: {', '.join(final_values)}")
            logger.info("")
            
        finally:
            cursor.close()
            conn.close()
        
        logger.info("=" * 50)
        logger.info("✓ Migration completed successfully!")
        logger.info("")
        logger.info("You can now:")
        logger.info("  1. Refresh your browser")
        logger.info("  2. Configure test management tools in Settings")
        logger.info("  3. Export tests to Xray, Zephyr, or TestRail")
        logger.info("=" * 50)
        
        return True
        
    except Exception as e:
        logger.error("")
        logger.error("=" * 50)
        logger.error(f"✗ Migration failed: {e}")
        logger.error("=" * 50)
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
