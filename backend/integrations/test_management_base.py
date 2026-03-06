"""
Base Test Management Integration
Defines the contract for test management tool integrations (Xray, Zephyr, TestRail)
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any


class TestManagementIntegration(ABC):
    """Abstract base class for test management tool integrations"""
    
    @abstractmethod
    def connect(self) -> bool:
        """
        Establish connection to the test management system
        
        Returns:
            True if connection successful, False otherwise
        """
        pass
    
    @abstractmethod
    def create_test_suite(self, suite_name: str, description: str = "", project_key: str = None) -> Optional[str]:
        """
        Create a test suite/folder
        
        Args:
            suite_name: Name of the test suite
            description: Suite description
            project_key: Project identifier
        
        Returns:
            Suite ID if created, None otherwise
        """
        pass
    
    @abstractmethod
    def create_test_case(self, test_case: Dict[str, Any], suite_id: str = None) -> Optional[str]:
        """
        Create a single test case
        
        Args:
            test_case: Test case data with keys:
                - title: Test case title
                - steps: List of test steps
                - expected_results: Expected outcomes
                - priority: Test priority (P0/P1/P2/P3)
                - test_type: Type of test (Functional, Regression, etc.)
                - test_data: Test data requirements
            suite_id: Optional suite/folder ID to organize under
        
        Returns:
            Test case ID if created, None otherwise
        """
        pass
    
    @abstractmethod
    def bulk_create_test_cases(self, test_cases: List[Dict[str, Any]], suite_id: str = None) -> Dict[str, Any]:
        """
        Create multiple test cases in bulk
        
        Args:
            test_cases: List of test case dictionaries
            suite_id: Optional suite/folder ID
        
        Returns:
            Dict with 'created', 'failed', and 'ids' keys
        """
        pass
    
    @abstractmethod
    def link_to_ticket(self, test_case_id: str, ticket_id: str) -> bool:
        """
        Link a test case to a ticket/story
        
        Args:
            test_case_id: Test case identifier
            ticket_id: Ticket identifier (e.g., PROJ-123)
        
        Returns:
            True if linked successfully, False otherwise
        """
        pass
