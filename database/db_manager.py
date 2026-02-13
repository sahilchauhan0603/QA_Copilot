"""
Database Manager
Handles all database operations for persistent storage
"""
import sqlite3
import os
import json
import uuid
from typing import List, Dict, Optional, Any
from datetime import datetime
from pathlib import Path
import logging

from database.models import Generation, TestCase, CoverageGap


logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database operations for test generation history"""
    
    def __init__(self, db_path: str = "ticket_test.db"):
        """
        Initialize database manager
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize database and create tables if they don't exist"""
        try:
            # Read schema file
            schema_path = Path(__file__).parent / "schema.sql"
            with open(schema_path, 'r') as f:
                schema_sql = f.read()
            
            # Execute schema
            conn = sqlite3.connect(self.db_path)
            conn.executescript(schema_sql)
            conn.commit()
            conn.close()
            
            logger.info(f"Database initialized at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def save_generation(
        self,
        state: Dict[str, Any],
        excel_file_path: Optional[str] = None
    ) -> str:
        """
        Save a test generation to database
        
        Args:
            state: Agent state containing test cases and ticket info
            excel_file_path: Path to generated Excel file
        
        Returns:
            Generation ID (UUID)
        """
        try:
            generation_id = str(uuid.uuid4())
            ticket_info = state.get('ticket_info', {})
            test_cases = state.get('test_cases', [])
            coverage_gaps = state.get('coverage_gaps', [])
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Save generation
            cursor.execute("""
                INSERT INTO generations 
                (id, ticket_id, ticket_title, ticket_type, ticket_description, 
                 ticket_acceptance_criteria, timestamp, excel_file_path, status, total_test_cases, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                generation_id,
                ticket_info.get('ticket_id', ''),
                ticket_info.get('title', ''),
                ticket_info.get('ticket_type', ''),
                ticket_info.get('description', ''),
                json.dumps(ticket_info.get('acceptance_criteria', [])),
                datetime.now().isoformat(),
                excel_file_path,
                'completed',
                len(test_cases),
                json.dumps({
                    'agent_workflow': state.get('agent_workflow', []),
                    'qa_roadmap': state.get('qa_roadmap', {}),
                    'clarification_questions': state.get('clarification_questions', []),
                    'risk_areas': state.get('risk_areas', [])
                })
            ))
            
            # Save test cases
            for test_case in test_cases:
                cursor.execute("""
                    INSERT INTO test_cases
                    (generation_id, title, priority, category, preconditions,
                     test_steps, expected_result, test_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    generation_id,
                    test_case.get('title', ''),
                    test_case.get('priority', 'P2'),
                    test_case.get('category', ''),
                    test_case.get('preconditions', ''),
                    json.dumps(test_case.get('test_steps', [])),
                    test_case.get('expected_result', ''),
                    test_case.get('test_data', '')
                ))
            
            # Save coverage gaps
            for gap in coverage_gaps:
                cursor.execute("""
                    INSERT INTO coverage_gaps (generation_id, gap_description)
                    VALUES (?, ?)
                """, (generation_id, gap))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Saved generation {generation_id} with {len(test_cases)} test cases")
            return generation_id
            
        except Exception as e:
            logger.error(f"Failed to save generation: {e}")
            raise
    
    def update_excel_path(self, generation_id: str, excel_path: str) -> bool:
        """
        Update the Excel file path for an existing generation
        
        Args:
            generation_id: UUID of the generation
            excel_path: Path to the Excel file
        
        Returns:
            True if successful, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE generations
                SET excel_file_path = ?
                WHERE id = ?
            """, (excel_path, generation_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated Excel path for generation {generation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update Excel path: {e}")
            return False
    
    def get_all_generations(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get all generations ordered by timestamp (newest first)
        
        Args:
            limit: Maximum number of generations to retrieve
        
        Returns:
            List of generation dictionaries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, ticket_id, ticket_title, ticket_type, 
                       timestamp, total_test_cases, excel_file_path, status
                FROM generations
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            
            generations = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            return generations
            
        except Exception as e:
            logger.error(f"Failed to get generations: {e}")
            return []
    
    def get_generation_by_id(self, generation_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific generation with all its test cases and coverage gaps
        
        Args:
            generation_id: UUID of the generation
        
        Returns:
            Dictionary with generation data, test cases, and coverage gaps
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get generation info
            cursor.execute("""
                SELECT * FROM generations WHERE id = ?
            """, (generation_id,))
            
            gen_row = cursor.fetchone()
            if not gen_row:
                conn.close()
                return None
            
            generation = dict(gen_row)
            
            # Get test cases
            cursor.execute("""
                SELECT * FROM test_cases WHERE generation_id = ?
            """, (generation_id,))
            
            test_cases = []
            for row in cursor.fetchall():
                tc = dict(row)
                # Parse test_steps JSON
                try:
                    tc['test_steps'] = json.loads(tc['test_steps'])
                except:
                    tc['test_steps'] = []
                test_cases.append(tc)
            
            # Get coverage gaps
            cursor.execute("""
                SELECT gap_description FROM coverage_gaps WHERE generation_id = ?
            """, (generation_id,))
            
            coverage_gaps = [row['gap_description'] for row in cursor.fetchall()]
            
            # Parse metadata to get qa_roadmap, clarification_questions, and risk_areas
            qa_roadmap = {}
            clarification_questions = []
            risk_areas = []
            try:
                if generation.get('metadata'):
                    metadata = json.loads(generation['metadata'])
                    qa_roadmap = metadata.get('qa_roadmap', {})
                    clarification_questions = metadata.get('clarification_questions', [])
                    risk_areas = metadata.get('risk_areas', [])
            except:
                qa_roadmap = {}
                clarification_questions = []
                risk_areas = []
            
            conn.close()
            
            return {
                'generation': generation,
                'test_cases': test_cases,
                'coverage_gaps': coverage_gaps,
                'qa_roadmap': qa_roadmap,
                'clarification_questions': clarification_questions,
                'risk_areas': risk_areas
            }
            
        except Exception as e:
            logger.error(f"Failed to get generation {generation_id}: {e}")
            return None
    
    def delete_generation(self, generation_id: str) -> bool:
        """
        Delete a generation and all its associated data (including Excel file)
        
        Args:
            generation_id: UUID of the generation to delete
        
        Returns:
            True if successful, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # First, get the Excel file path before deleting the record
            cursor.execute(
                "SELECT excel_file_path FROM generations WHERE id = ?",
                (generation_id,)
            )
            result = cursor.fetchone()
            excel_file_path = result[0] if result else None
            
            # Delete the Excel file from outputs folder if it exists
            if excel_file_path and os.path.exists(excel_file_path):
                try:
                    os.remove(excel_file_path)
                    logger.info(f"Deleted Excel file: {excel_file_path}")
                except Exception as file_error:
                    logger.warning(f"Failed to delete Excel file {excel_file_path}: {file_error}")
            
            # Delete generation (CASCADE will delete test_cases and coverage_gaps)
            cursor.execute("DELETE FROM generations WHERE id = ?", (generation_id,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Deleted generation {generation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete generation {generation_id}: {e}")
            return False
    
    def search_generations(
        self,
        ticket_id: Optional[str] = None,
        ticket_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search generations with filters
        
        Args:
            ticket_id: Filter by ticket ID (partial match)
            ticket_type: Filter by ticket type
            date_from: Filter by start date (ISO format)
            date_to: Filter by end date (ISO format)
        
        Returns:
            List of matching generations
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
                SELECT id, ticket_id, ticket_title, ticket_type,
                       timestamp, total_test_cases, excel_file_path, status
                FROM generations
                WHERE 1=1
            """
            params = []
            
            if ticket_id:
                query += " AND ticket_id LIKE ?"
                params.append(f"%{ticket_id}%")
            
            if ticket_type:
                query += " AND ticket_type = ?"
                params.append(ticket_type)
            
            if date_from:
                query += " AND timestamp >= ?"
                params.append(date_from)
            
            if date_to:
                query += " AND timestamp <= ?"
                params.append(date_to)
            
            query += " ORDER BY timestamp DESC LIMIT 100"
            
            cursor.execute(query, params)
            generations = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            return generations
            
        except Exception as e:
            logger.error(f"Failed to search generations: {e}")
            return []
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get database statistics (only counts test cases from existing generations)
        
        Returns:
            Dictionary with statistics
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Total generations
            cursor.execute("SELECT COUNT(*) FROM generations")
            total_generations = cursor.fetchone()[0]
            
            # Total test cases (only from existing generations)
            cursor.execute("""
                SELECT COUNT(*) 
                FROM test_cases tc
                INNER JOIN generations g ON tc.generation_id = g.id
            """)
            total_test_cases = cursor.fetchone()[0]
            
            # Test cases by priority (only from existing generations)
            cursor.execute("""
                SELECT tc.priority, COUNT(*) as count
                FROM test_cases tc
                INNER JOIN generations g ON tc.generation_id = g.id
                GROUP BY tc.priority
            """)
            by_priority = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Test cases by category (only from existing generations)
            cursor.execute("""
                SELECT tc.category, COUNT(*) as count
                FROM test_cases tc
                INNER JOIN generations g ON tc.generation_id = g.id
                GROUP BY tc.category
                ORDER BY count DESC
                LIMIT 10
            """)
            by_category = {row[0]: row[1] for row in cursor.fetchall()}
            
            conn.close()
            
            return {
                'total_generations': total_generations,
                'total_test_cases': total_test_cases,
                'by_priority': by_priority,
                'by_category': by_category
            }
            
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {}
    
    def cleanup_orphaned_records(self) -> int:
        """
        Remove orphaned test cases and coverage gaps that have no parent generation.
        This is a safeguard in case CASCADE delete doesn't work properly.
        
        Returns:
            Number of orphaned records cleaned up
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Delete orphaned test cases
            cursor.execute("""
                DELETE FROM test_cases 
                WHERE generation_id NOT IN (SELECT id FROM generations)
            """)
            test_cases_deleted = cursor.rowcount
            
            # Delete orphaned coverage gaps
            cursor.execute("""
                DELETE FROM coverage_gaps 
                WHERE generation_id NOT IN (SELECT id FROM generations)
            """)
            coverage_gaps_deleted = cursor.rowcount
            
            conn.commit()
            conn.close()
            
            total_deleted = test_cases_deleted + coverage_gaps_deleted
            if total_deleted > 0:
                logger.info(f"Cleaned up {test_cases_deleted} orphaned test cases and {coverage_gaps_deleted} orphaned coverage gaps")
            
            return total_deleted
            
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned records: {e}")
            return 0
