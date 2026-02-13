"""
Jira Integration
Connects to Jira Cloud/Server and manages ticket operations
"""
from typing import Dict, List, Optional
import os
from jira import JIRA
from jira.exceptions import JIRAError
import logging

from integrations.base import TicketIntegration
from agents.state import TicketInfo


logger = logging.getLogger(__name__)


class JiraIntegration(TicketIntegration):
    """
    Integration with Jira (Cloud or Server)
    """
    
    def __init__(
        self, 
        url: Optional[str] = None,
        email: Optional[str] = None,
        api_token: Optional[str] = None
    ):
        """
        Initialize Jira integration
        
        Args:
            url: Jira instance URL (e.g., https://your-domain.atlassian.net)
            email: User email for authentication
            api_token: Jira API token (create at https://id.atlassian.com/manage/api-tokens)
        """
        self.url = url or os.getenv('JIRA_URL')
        self.email = email or os.getenv('JIRA_EMAIL')
        self.api_token = api_token or os.getenv('JIRA_API_TOKEN')
        self.client: Optional[JIRA] = None
    
    def connect(self) -> bool:
        """
        Establish connection to Jira
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if not all([self.url, self.email, self.api_token]):
                logger.error("Missing Jira credentials. Set JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN")
                return False
            
            self.client = JIRA(
                server=self.url,
                basic_auth=(self.email, self.api_token)
            )
            
            # Test connection
            self.client.myself()
            logger.info(f"Successfully connected to Jira at {self.url}")
            return True
            
        except JIRAError as e:
            logger.error(f"Failed to connect to Jira: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error connecting to Jira: {e}")
            return False
    
    def fetch_ticket(self, ticket_id: str) -> Optional[TicketInfo]:
        """
        Fetch a single ticket from Jira
        
        Args:
            ticket_id: The ticket key (e.g., 'PROJ-123')
        
        Returns:
            TicketInfo if found, None otherwise
        """
        if not self.client:
            if not self.connect():
                return None
        
        try:
            issue = self.client.issue(ticket_id)
            
            # Extract acceptance criteria from description or custom field
            description = issue.fields.description or ""
            acceptance_criteria = self._extract_acceptance_criteria(description)
            
            # Get comments
            comments = []
            for comment in issue.fields.comment.comments[-5:]:  # Last 5 comments
                comments.append({
                    'author': comment.author.displayName,
                    'body': comment.body,
                    'created': str(comment.created)
                })
            
            # Get attachments
            attachments = [att.filename for att in issue.fields.attachment]
            
            # Get linked issues
            linked_tickets = [link.key for link in issue.fields.issuelinks if hasattr(link, 'key')]
            
            ticket_info = TicketInfo(
                ticket_id=issue.key,
                title=issue.fields.summary,
                description=description,
                acceptance_criteria=acceptance_criteria,
                ticket_type=issue.fields.issuetype.name.lower(),
                priority=issue.fields.priority.name if issue.fields.priority else "Medium",
                status=issue.fields.status.name,
                attachments=attachments,
                comments=comments,
                linked_tickets=linked_tickets
            )
            
            logger.info(f"Successfully fetched Jira ticket: {ticket_id}")
            return ticket_info
            
        except JIRAError as e:
            logger.error(f"Failed to fetch Jira ticket {ticket_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching Jira ticket {ticket_id}: {e}")
            return None
    
    def _extract_acceptance_criteria(self, description: str) -> List[str]:
        """
        Extract acceptance criteria from description
        
        Looks for common patterns:
        - "Acceptance Criteria:"
        - "AC:"
        - Numbered/bulleted lists after these headers
        """
        criteria = []
        
        if not description:
            return criteria
        
        # Look for acceptance criteria section
        lines = description.split('\n')
        in_ac_section = False
        
        for line in lines:
            line = line.strip()
            
            # Check if we're entering AC section
            if any(marker in line.lower() for marker in ['acceptance criteria', 'ac:', 'acceptance:']):
                in_ac_section = True
                continue
            
            # Check if we're leaving AC section (new section header)
            if in_ac_section and line and line[0] in ['#', '*'] and ':' in line:
                in_ac_section = False
            
            # Extract criteria
            if in_ac_section and line:
                # Remove bullet points and numbering
                cleaned = line.lstrip('*-•·○►123456789.() ')
                if cleaned:
                    criteria.append(cleaned)
        
        return criteria
    
    def post_comment(self, ticket_id: str, comment: str) -> bool:
        """
        Post a comment to a Jira ticket
        
        Args:
            ticket_id: The ticket key
            comment: The comment text (supports Jira markdown)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.warning("Jira client not connected. Attempting to connect...")
            if not self.connect():
                logger.error("Failed to connect to Jira before posting comment")
                return False
        
        try:
            self.client.add_comment(ticket_id, comment)
            logger.info(f"Posted comment to Jira ticket: {ticket_id}")
            return True
        except JIRAError as e:
            logger.error(f"Failed to post comment to {ticket_id}: {e.status_code} - {e.text}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error posting comment to {ticket_id}: {type(e).__name__} - {str(e)}")
            return False
    
    def attach_file(self, ticket_id: str, file_path: str, filename: str) -> bool:
        """
        Attach a file to a Jira ticket
        
        Args:
            ticket_id: The ticket key
            file_path: Path to the file to attach
            filename: Name to give the attachment
        
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.warning("Jira client not connected. Attempting to connect...")
            if not self.connect():
                logger.error("Failed to connect to Jira before attaching file")
                return False
        
        try:
            import os
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return False
            
            with open(file_path, 'rb') as f:
                self.client.add_attachment(
                    issue=ticket_id,
                    attachment=f,
                    filename=filename
                )
            logger.info(f"Attached file {filename} to Jira ticket: {ticket_id}")
            return True
        except JIRAError as e:
            logger.error(f"Failed to attach file to {ticket_id}: {e.status_code} - {e.text}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error attaching file to {ticket_id}: {type(e).__name__} - {str(e)}")
            return False
    
    def get_linked_tickets(self, ticket_id: str) -> List[str]:
        """
        Get IDs of tickets linked to this ticket
        
        Args:
            ticket_id: The ticket key
        
        Returns:
            List of linked ticket keys
        """
        if not self.client:
            if not self.connect():
                return []
        
        try:
            issue = self.client.issue(ticket_id)
            linked = []
            
            for link in issue.fields.issuelinks:
                if hasattr(link, 'outwardIssue'):
                    linked.append(link.outwardIssue.key)
                if hasattr(link, 'inwardIssue'):
                    linked.append(link.inwardIssue.key)
            
            return linked
        except Exception as e:
            logger.error(f"Failed to get linked tickets for {ticket_id}: {e}")
            return []
    
    def search_tickets(self, jql: str, max_results: int = 50) -> List[TicketInfo]:
        """
        Search for tickets using JQL
        
        Args:
            jql: Jira Query Language string
            max_results: Maximum number of results
        
        Returns:
            List of TicketInfo objects
        """
        if not self.client:
            if not self.connect():
                return []
        
        try:
            issues = self.client.search_issues(jql, maxResults=max_results)
            tickets = []
            
            for issue in issues:
                ticket = self.fetch_ticket(issue.key)
                if ticket:
                    tickets.append(ticket)
            
            logger.info(f"Found {len(tickets)} tickets matching JQL query")
            return tickets
            
        except JIRAError as e:
            logger.error(f"JQL search failed: {e}")
            return []
    
    def create_test_subtasks(
        self, 
        parent_ticket_id: str, 
        test_cases: List[Dict],
        max_subtasks: int = 10
    ) -> List[str]:
        """
        Create subtasks for test cases (Jira-specific feature)
        
        Args:
            parent_ticket_id: The parent ticket key
            test_cases: List of test case dictionaries
            max_subtasks: Maximum number of subtasks to create
        
        Returns:
            List of created subtask keys
        """
        if not self.client:
            logger.warning("Jira client not connected. Attempting to connect...")
            if not self.connect():
                logger.error("Failed to connect to Jira before creating subtasks")
                return []
        
        created_subtasks = []
        
        try:
            parent_issue = self.client.issue(parent_ticket_id)
            project_key = parent_issue.fields.project.key
            
            logger.info(f"Creating subtasks for {parent_ticket_id} in project {project_key}")
            
            for i, test_case in enumerate(test_cases[:max_subtasks]):
                try:
                    subtask_dict = {
                        'project': {'key': project_key},
                        'summary': f"[TEST] {test_case.get('title', 'Test Case')}",
                        'description': self._format_test_case_description(test_case),
                        'issuetype': {'name': 'Sub-task'},
                        'parent': {'key': parent_ticket_id}
                    }
                    
                    subtask = self.client.create_issue(fields=subtask_dict)
                    created_subtasks.append(subtask.key)
                    logger.info(f"Created test subtask {i+1}/{min(len(test_cases), max_subtasks)}: {subtask.key}")
                except JIRAError as e:
                    logger.error(f"Failed to create subtask {i+1}: {e.status_code} - {e.text}")
                    # Continue with other subtasks
                    continue
                except Exception as e:
                    logger.error(f"Unexpected error creating subtask {i+1}: {type(e).__name__} - {str(e)}")
                    continue
            
            logger.info(f"Successfully created {len(created_subtasks)} out of {min(len(test_cases), max_subtasks)} subtasks")
            return created_subtasks
            
        except JIRAError as e:
            logger.error(f"Failed to access parent ticket {parent_ticket_id}: {e.status_code} - {e.text}")
            return created_subtasks
        except Exception as e:
            logger.error(f"Failed to create test subtasks: {type(e).__name__} - {str(e)}")
            return created_subtasks
    
    def _format_test_case_description(self, test_case: Dict) -> str:
        """Format test case as Jira description"""
        description = f"*Priority:* {test_case.get('priority', 'P2')}\n"
        description += f"*Category:* {test_case.get('category', 'Unknown')}\n\n"
        
        if test_case.get('preconditions'):
            description += f"*Preconditions:*\n{test_case['preconditions']}\n\n"
        
        description += "*Test Steps:*\n"
        for i, step in enumerate(test_case.get('test_steps', []), 1):
            description += f"{i}. {step}\n"
        
        description += f"\n*Expected Result:*\n{test_case.get('expected_result', '')}\n"
        
        if test_case.get('test_data'):
            description += f"\n*Test Data:*\n{test_case['test_data']}\n"
        
        return description
