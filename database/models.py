"""
Data models for database
"""
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import json


@dataclass
class Generation:
    """Represents a test generation session"""
    id: str
    ticket_id: str
    ticket_title: str
    ticket_type: str
    ticket_description: str
    timestamp: str
    excel_file_path: Optional[str] = None
    status: str = 'completed'
    total_test_cases: int = 0
    metadata: Optional[str] = None
    created_at: Optional[str] = None
    ticket_acceptance_criteria: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Generation':
        """Create from dictionary"""
        return cls(**data)


@dataclass
class TestCase:
    """Represents a single test case"""
    generation_id: str
    title: str
    priority: str
    category: str
    preconditions: str
    test_steps: str  # JSON string
    expected_result: str
    test_data: str
    id: Optional[int] = None
    created_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        # Parse test_steps back to list if it's a string
        if isinstance(data['test_steps'], str):
            try:
                data['test_steps'] = json.loads(data['test_steps'])
            except:
                pass
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TestCase':
        """Create from dictionary"""
        # Convert test_steps list to JSON string if needed
        if isinstance(data.get('test_steps'), list):
            data['test_steps'] = json.dumps(data['test_steps'])
        return cls(**data)


@dataclass
class CoverageGap:
    """Represents a coverage gap"""
    generation_id: str
    gap_description: str
    id: Optional[int] = None
    created_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CoverageGap':
        """Create from dictionary"""
        return cls(**data)
