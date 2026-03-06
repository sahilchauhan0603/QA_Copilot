"""
Data models for test generation (PostgreSQL with SQLAlchemy)
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database.auth_models import Base


class Generation(Base):
    """Represents a test generation session"""
    __tablename__ = 'generations'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(String(100), nullable=False, index=True)
    ticket_title = Column(Text, nullable=False)
    ticket_type = Column(String(50))
    ticket_description = Column(Text)
    ticket_acceptance_criteria = Column(JSONB)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    excel_file_path = Column(String(500))
    status = Column(String(50), default='completed')
    total_test_cases = Column(Integer, default=0)
    generation_metadata = Column(JSONB)  # Renamed from 'metadata' (reserved by SQLAlchemy)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey('teams.id', ondelete='SET NULL'), index=True)
    
    # Relationships
    test_cases = relationship('TestCase', back_populates='generation', cascade='all, delete-orphan')
    coverage_gaps = relationship('CoverageGap', back_populates='generation', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': str(self.id),
            'ticket_id': self.ticket_id,
            'ticket_title': self.ticket_title,
            'ticket_type': self.ticket_type,
            'ticket_description': self.ticket_description,
            'ticket_acceptance_criteria': self.ticket_acceptance_criteria,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'excel_file_path': self.excel_file_path,
            'status': self.status,
            'total_test_cases': self.total_test_cases,
            'metadata': self.generation_metadata,  # Return as 'metadata' for API compatibility
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_id': self.user_id,
            'team_id': self.team_id
        }


class TestCase(Base):
    """Represents a single test case"""
    __tablename__ = 'test_cases'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    generation_id = Column(UUID(as_uuid=True), ForeignKey('generations.id', ondelete='CASCADE'), nullable=False, index=True)
    title = Column(Text, nullable=False)
    priority = Column(String(10))
    category = Column(String(100))
    preconditions = Column(Text)
    test_steps = Column(JSONB)
    expected_result = Column(Text)
    test_data = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    generation = relationship('Generation', back_populates='test_cases')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'generation_id': str(self.generation_id),
            'title': self.title,
            'priority': self.priority,
            'category': self.category,
            'preconditions': self.preconditions,
            'test_steps': self.test_steps,
            'expected_result': self.expected_result,
            'test_data': self.test_data,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class CoverageGap(Base):
    """Represents a coverage gap"""
    __tablename__ = 'coverage_gaps'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    generation_id = Column(UUID(as_uuid=True), ForeignKey('generations.id', ondelete='CASCADE'), nullable=False, index=True)
    gap_description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    generation = relationship('Generation', back_populates='coverage_gaps')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'generation_id': str(self.generation_id),
            'gap_description': self.gap_description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
