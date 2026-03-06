"""
Base Integration Interface
Defines the contract for ticket system integrations
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from agents.state import TicketInfo


class TicketIntegration(ABC):
    """
    Abstract base class for ticket system integrations
    """
    
    @abstractmethod
    def connect(self) -> bool:
        """
        Establish connection to the ticket system
        
        Returns:
            True if connection successful, False otherwise
        """
        pass
    
    @abstractmethod
    def fetch_ticket(self, ticket_id: str) -> Optional[TicketInfo]:
        """
        Fetch a single ticket by ID
        
        Args:
            ticket_id: The ticket identifier (e.g., 'PROJ-123')
        
        Returns:
            TicketInfo if found, None otherwise
        """
        pass
    
    @abstractmethod
    def post_comment(self, ticket_id: str, comment: str) -> bool:
        """
        Post a comment to a ticket
        
        Args:
            ticket_id: The ticket identifier
            comment: The comment text (supports markdown)
        
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    def attach_file(self, ticket_id: str, file_path: str, filename: str) -> bool:
        """
        Attach a file to a ticket
        
        Args:
            ticket_id: The ticket identifier
            file_path: Path to the file to attach
            filename: Name to give the attachment
        
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    def get_linked_tickets(self, ticket_id: str) -> List[str]:
        """
        Get IDs of tickets linked to this ticket
        
        Args:
            ticket_id: The ticket identifier
        
        Returns:
            List of linked ticket IDs
        """
        pass
    
    @abstractmethod
    def search_tickets(self, jql: str, max_results: int = 50) -> List[TicketInfo]:
        """
        Search for tickets using query language
        
        Args:
            jql: Query string (JQL for Jira, WIQL for Azure DevOps)
            max_results: Maximum number of results to return
        
        Returns:
            List of TicketInfo objects
        """
        pass
