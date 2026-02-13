"""
Database Connection Manager
Handles PostgreSQL connections using SQLAlchemy
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from dotenv import load_dotenv
import logging

from database.auth_models import Base

load_dotenv()
logger = logging.getLogger(__name__)


class DatabaseConnection:
    """Manages database connections and sessions"""
    
    def __init__(self, database_url: str = None):
        """
        Initialize database connection
        
        Args:
            database_url: PostgreSQL connection URL
                         Format: postgresql://user:password@host:port/database
                         If None, reads from DATABASE_URL env variable
        """
        self.database_url = database_url or os.getenv(
            'DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/ticket_to_test'
        )
        
        # Create engine with connection pooling
        self.engine = create_engine(
            self.database_url,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,  # Verify connections before using
            echo=os.getenv('SQL_ECHO', 'false').lower() == 'true'
        )
        
        # Create session factory
        self.SessionFactory = scoped_session(
            sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        )
        
        logger.info(f"Database connection initialized")
    
    def create_all_tables(self):
        """Create all tables defined in models"""
        try:
            Base.metadata.create_all(self.engine)
            logger.info("All database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise
    
    def drop_all_tables(self):
        """Drop all tables (USE WITH CAUTION!)"""
        try:
            Base.metadata.drop_all(self.engine)
            logger.warning("All database tables dropped")
        except Exception as e:
            logger.error(f"Failed to drop tables: {e}")
            raise
    
    @contextmanager
    def get_session(self):
        """
        Context manager for database sessions
        
        Usage:
            with db.get_session() as session:
                user = session.query(User).first()
        """
        session = self.SessionFactory()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Session error: {e}")
            raise
        finally:
            session.close()
    
    def close(self):
        """Close all database connections"""
        self.SessionFactory.remove()
        self.engine.dispose()
        logger.info("Database connections closed")


# Global database connection instance
_db_connection = None


def get_db_connection() -> DatabaseConnection:
    """Get or create global database connection"""
    global _db_connection
    if _db_connection is None:
        _db_connection = DatabaseConnection()
    return _db_connection


def init_database():
    """Initialize database and create tables"""
    db = get_db_connection()
    db.create_all_tables()
    return db
