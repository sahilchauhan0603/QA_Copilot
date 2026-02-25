"""
Database Manager
Handles all database operations for persistent storage using PostgreSQL
"""
import os
import uuid
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from database.connection import DatabaseConnection
from database.models import Generation, TestCase, CoverageGap


logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database operations for test generation history using PostgreSQL"""
    
    def __init__(self, database_url: str = None):
        """
        Initialize database manager
        
        Args:
            database_url: PostgreSQL connection URL (optional, uses env var if not provided)
        """
        self.db = DatabaseConnection(database_url)
        logger.info("Database manager initialized with PostgreSQL")
    
    def save_generation(
        self,
        state: Dict[str, Any],
        user_id: int,
        team_id: Optional[int] = None,
        excel_file_path: Optional[str] = None
    ) -> str:
        """
        Save a test generation to database
        
        Args:
            state: Agent state containing test cases and ticket info
            user_id: ID of the user who created the generation
            team_id: Optional team ID (None for personal workspace)
            excel_file_path: Path to generated Excel file
        
        Returns:
            Generation ID (UUID as string)
        """
        try:
            ticket_info = state.get('ticket_info', {})
            test_cases = state.get('test_cases', [])
            coverage_gaps = state.get('coverage_gaps', [])
            
            with self.db.get_session() as session:
                # Create generation
                generation = Generation(
                    ticket_id=ticket_info.get('ticket_id', ''),
                    ticket_title=ticket_info.get('title', ''),
                    ticket_type=ticket_info.get('ticket_type', ''),
                    ticket_description=ticket_info.get('description', ''),
                    ticket_acceptance_criteria=ticket_info.get('acceptance_criteria', []),
                    excel_file_path=excel_file_path,
                    status='completed',
                    total_test_cases=len(test_cases),
                    generation_metadata={
                        'qa_roadmap': state.get('qa_roadmap', {}),
                        'clarification_questions': state.get('clarification_questions', []),
                        'risk_areas': state.get('risk_areas', []),
                        'extracted_requirements': state.get('extracted_requirements', []),
                        'acceptance_criteria_gaps': state.get('acceptance_criteria_gaps', []),
                        'impacted_modules': state.get('impacted_modules', []),
                        'dependencies': state.get('dependencies', []),
                        'processing_time': state.get('processing_time', 0),
                        'priority': state.get('ticket_info', {}).get('priority', ''),
                        'status': state.get('ticket_info', {}).get('status', ''),
                        'source_integration': state.get('source_integration'),
                        'refinement': state.get('refinement'),  # Add refinement metadata
                    },
                    user_id=user_id,
                    team_id=team_id
                )
                
                session.add(generation)
                session.flush()  # Get the generation ID
                
                generation_id = str(generation.id)
                
                # Create test cases
                for test_case in test_cases:
                    tc = TestCase(
                        generation_id=generation.id,
                        title=test_case.get('title', ''),
                        priority=test_case.get('priority', 'P2'),
                        category=test_case.get('category', ''),
                        preconditions=test_case.get('preconditions', ''),
                        test_steps=test_case.get('test_steps', []),
                        expected_result=test_case.get('expected_result', ''),
                        test_data=test_case.get('test_data', '')
                    )
                    session.add(tc)
                
                # Create coverage gaps
                for gap in coverage_gaps:
                    cg = CoverageGap(
                        generation_id=generation.id,
                        gap_description=gap
                    )
                    session.add(cg)
                
                session.commit()
                
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
            with self.db.get_session() as session:
                generation = session.query(Generation).filter(
                    Generation.id == uuid.UUID(generation_id)
                ).first()
                
                if generation:
                    generation.excel_file_path = excel_path
                    session.commit()
                    logger.info(f"Updated Excel path for generation {generation_id}")
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Failed to update Excel path: {e}")
            return False
    
    def get_all_generations(
        self, 
        user_id: int, 
        team_id: Optional[int] = None, 
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Get all generations for a specific workspace ordered by timestamp (newest first)
        
        Args:
            user_id: User ID to filter by
            team_id: Optional team ID (None for personal workspace)
            limit: Maximum number of generations to retrieve
        
        Returns:
            List of generation dictionaries
        """
        try:
            with self.db.get_session() as session:
                query = session.query(Generation).filter(
                    Generation.user_id == user_id
                )
                
                # Workspace filter
                if team_id is None:
                    query = query.filter(Generation.team_id.is_(None))
                else:
                    query = query.filter(Generation.team_id == team_id)
                
                generations = query.order_by(desc(Generation.timestamp)).offset(offset).limit(limit).all()
                
                return [
                    {
                        'id': str(g.id),
                        'ticket_id': g.ticket_id,
                        'ticket_title': g.ticket_title,
                        'ticket_type': g.ticket_type,
                        'timestamp': g.timestamp.isoformat() if g.timestamp else None,
                        'total_test_cases': g.total_test_cases,
                        'excel_file_path': g.excel_file_path,
                        'status': g.status,
                        'generation_metadata': g.generation_metadata or {},
                    }
                    for g in generations
                ]
                
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
            with self.db.get_session() as session:
                generation = session.query(Generation).filter(
                    Generation.id == uuid.UUID(generation_id)
                ).first()
                
                if not generation:
                    return None
                
                # Get test cases
                test_cases = [tc.to_dict() for tc in generation.test_cases]
                
                # Get coverage gaps
                coverage_gaps = [cg.gap_description for cg in generation.coverage_gaps]
                
                # Extract metadata
                gen_metadata = generation.generation_metadata or {}
                
                return {
                    'generation': generation.to_dict(),
                    'test_cases': test_cases,
                    'coverage_gaps': coverage_gaps,
                    'qa_roadmap': gen_metadata.get('qa_roadmap', {}),
                    'clarification_questions': gen_metadata.get('clarification_questions', []),
                    'risk_areas': gen_metadata.get('risk_areas', []),
                    'extracted_requirements': gen_metadata.get('extracted_requirements', []),
                    'acceptance_criteria_gaps': gen_metadata.get('acceptance_criteria_gaps', []),
                    'impacted_modules': gen_metadata.get('impacted_modules', []),
                    'dependencies': gen_metadata.get('dependencies', []),
                    'source_integration': gen_metadata.get('source_integration'),
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
            with self.db.get_session() as session:
                generation = session.query(Generation).filter(
                    Generation.id == uuid.UUID(generation_id)
                ).first()
                
                if not generation:
                    return False
                
                # Delete the generation (CASCADE will handle related records)
                session.delete(generation)
                session.commit()
                
                logger.info(f"Deleted generation {generation_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to delete generation {generation_id}: {e}")
            return False
    
    def search_generations(
        self,
        user_id: int,
        team_id: Optional[int] = None,
        ticket_id: Optional[str] = None,
        ticket_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Search generations with filters in a specific workspace
        
        Args:
            user_id: User ID to filter by
            team_id: Optional team ID (None for personal workspace)
            ticket_id: Filter by ticket ID (partial match)
            ticket_type: Filter by ticket type
            date_from: Filter by start date (ISO format)
            date_to: Filter by end date (ISO format)
        
        Returns:
            List of matching generations
        """
        try:
            with self.db.get_session() as session:
                query = session.query(Generation).filter(
                    Generation.user_id == user_id
                )
                
                # Workspace filter
                if team_id is None:
                    query = query.filter(Generation.team_id.is_(None))
                else:
                    query = query.filter(Generation.team_id == team_id)
                
                # Additional filters
                if ticket_id:
                    query = query.filter(
                        or_(
                            Generation.ticket_id.ilike(f"%{ticket_id}%"),
                            Generation.ticket_title.ilike(f"%{ticket_id}%")
                        )
                    )
                
                if ticket_type:
                    query = query.filter(Generation.ticket_type == ticket_type)
                
                if date_from:
                    query = query.filter(Generation.timestamp >= datetime.fromisoformat(date_from))
                
                if date_to:
                    query = query.filter(Generation.timestamp <= datetime.fromisoformat(date_to))
                
                generations = query.order_by(desc(Generation.timestamp)).offset(offset).limit(limit).all()
                
                return [
                    {
                        'id': str(g.id),
                        'ticket_id': g.ticket_id,
                        'ticket_title': g.ticket_title,
                        'ticket_type': g.ticket_type,
                        'timestamp': g.timestamp.isoformat() if g.timestamp else None,
                        'total_test_cases': g.total_test_cases,
                        'excel_file_path': g.excel_file_path,
                        'status': g.status,
                        'generation_metadata': g.generation_metadata or {},
                    }
                    for g in generations
                ]
                
        except Exception as e:
            logger.error(f"Failed to search generations: {e}")
            return []

    def count_generations(
        self,
        user_id: int,
        team_id: Optional[int] = None,
        ticket_id: Optional[str] = None,
        ticket_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> int:
        """Count generations for pagination with optional filters."""
        try:
            with self.db.get_session() as session:
                query = session.query(Generation).filter(
                    Generation.user_id == user_id
                )

                if team_id is None:
                    query = query.filter(Generation.team_id.is_(None))
                else:
                    query = query.filter(Generation.team_id == team_id)

                if ticket_id:
                    query = query.filter(
                        or_(
                            Generation.ticket_id.ilike(f"%{ticket_id}%"),
                            Generation.ticket_title.ilike(f"%{ticket_id}%")
                        )
                    )

                if ticket_type:
                    query = query.filter(Generation.ticket_type == ticket_type)

                if date_from:
                    query = query.filter(Generation.timestamp >= datetime.fromisoformat(date_from))

                if date_to:
                    query = query.filter(Generation.timestamp <= datetime.fromisoformat(date_to))

                return query.count()
        except Exception as e:
            logger.error(f"Failed to count generations: {e}")
            return 0
    
    def get_statistics(self, user_id: int, team_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get database statistics for a specific workspace
        
        Args:
            user_id: User ID to filter by
            team_id: Optional team ID (None for personal workspace)
        
        Returns:
            Dictionary with statistics
        """
        try:
            with self.db.get_session() as session:
                # Base workspace filter
                workspace_filter = Generation.user_id == user_id
                if team_id is None:
                    workspace_filter = and_(workspace_filter, Generation.team_id.is_(None))
                else:
                    workspace_filter = and_(workspace_filter, Generation.team_id == team_id)
                
                # Total generations
                total_generations = session.query(Generation).filter(workspace_filter).count()
                
                # Total test cases
                total_test_cases = session.query(TestCase).join(Generation).filter(
                    workspace_filter
                ).count()
                
                # Test cases by priority
                priority_counts = session.query(
                    TestCase.priority, 
                    func.count(TestCase.id)
                ).join(Generation).filter(
                    workspace_filter
                ).group_by(TestCase.priority).all()
                by_priority = {p: c for p, c in priority_counts}
                
                # Test cases by category (top 10)
                category_counts = session.query(
                    TestCase.category,
                    func.count(TestCase.id)
                ).join(Generation).filter(
                    workspace_filter
                ).group_by(TestCase.category).order_by(
                    desc(func.count(TestCase.id))
                ).limit(10).all()
                by_category = {c: count for c, count in category_counts}
                
                avg_test_cases = round(total_test_cases / total_generations, 1) if total_generations > 0 else 0
                
                return {
                    'total_generations': total_generations,
                    'total_test_cases': total_test_cases,
                    'avg_test_cases': avg_test_cases,
                    'by_priority': by_priority,
                    'by_category': by_category
                }
                
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {}
    
    def cleanup_orphaned_records(self) -> int:
        """
        Remove orphaned test cases and coverage gaps.
        Note: With PostgreSQL CASCADE, this shouldn't be necessary, but kept for safety.
        
        Returns:
            Number of orphaned records cleaned up
        """
        try:
            with self.db.get_session() as session:
                # Find orphaned test cases
                orphaned_tc = session.query(TestCase).filter(
                    ~TestCase.generation_id.in_(
                        session.query(Generation.id)
                    )
                ).all()
                
                # Find orphaned coverage gaps
                orphaned_cg = session.query(CoverageGap).filter(
                    ~CoverageGap.generation_id.in_(
                        session.query(Generation.id)
                    )
                ).all()
                
                total_deleted = len(orphaned_tc) + len(orphaned_cg)
                
                if total_deleted > 0:
                    for tc in orphaned_tc:
                        session.delete(tc)
                    for cg in orphaned_cg:
                        session.delete(cg)
                    session.commit()
                    logger.info(f"Cleaned up {len(orphaned_tc)} orphaned test cases and {len(orphaned_cg)} orphaned coverage gaps")
                
                return total_deleted
                
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned records: {e}")
            return 0
