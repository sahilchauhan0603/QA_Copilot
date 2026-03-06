"""
Azure DevOps Integration
Connects to Azure DevOps and manages work item operations
"""
from typing import Dict, List, Optional
import os
from azure.devops.connection import Connection
from azure.devops.v7_0.work_item_tracking import WorkItemTrackingClient
from msrest.authentication import BasicAuthentication
import logging

from integrations.base import TicketIntegration
from agents.state import TicketInfo


logger = logging.getLogger(__name__)


class AzureDevOpsIntegration(TicketIntegration):
    """
    Integration with Azure DevOps
    """
    
    def __init__(
        self,
        organization_url: Optional[str] = None,
        personal_access_token: Optional[str] = None,
        project: Optional[str] = None
    ):
        """
        Initialize Azure DevOps integration
        
        Args:
            organization_url: Azure DevOps org URL (e.g., https://dev.azure.com/your-org)
            personal_access_token: Personal Access Token with work item permissions
            project: Default project name
        """
        self.organization_url = organization_url or os.getenv('AZURE_DEVOPS_ORG')
        self.pat = personal_access_token or os.getenv('AZURE_DEVOPS_PAT')
        self.project = project or os.getenv('AZURE_DEVOPS_PROJECT')
        self.connection: Optional[Connection] = None
        self.wit_client: Optional[WorkItemTrackingClient] = None
    
    def connect(self) -> bool:
        """
        Establish connection to Azure DevOps
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if not all([self.organization_url, self.pat]):
                logger.error("Missing Azure DevOps credentials. Set AZURE_DEVOPS_ORG and AZURE_DEVOPS_PAT")
                return False
            
            credentials = BasicAuthentication('', self.pat)
            self.connection = Connection(base_url=self.organization_url, creds=credentials)
            self.wit_client = self.connection.clients.get_work_item_tracking_client()
            
            logger.info(f"Successfully connected to Azure DevOps at {self.organization_url}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Azure DevOps: {e}")
            return False
    
    def fetch_ticket(self, ticket_id: str) -> Optional[TicketInfo]:
        """
        Fetch a single work item from Azure DevOps
        
        Args:
            ticket_id: The work item ID (numeric)
        
        Returns:
            TicketInfo if found, None otherwise
        """
        if not self.wit_client:
            if not self.connect():
                return None
        
        try:
            work_item_id = int(ticket_id)
            work_item = self.wit_client.get_work_item(
                work_item_id,
                expand='All'
            )
            
            fields = work_item.fields
            
            # Extract basic fields
            title = fields.get('System.Title', '')
            description = fields.get('System.Description', '')
            work_item_type = fields.get('System.WorkItemType', 'Task')
            state = fields.get('System.State', 'New')
            priority = str(fields.get('Microsoft.VSTS.Common.Priority', '2'))
            
            # Extract acceptance criteria
            acceptance_criteria_text = fields.get('Microsoft.VSTS.Common.AcceptanceCriteria', '')
            acceptance_criteria = self._extract_acceptance_criteria(acceptance_criteria_text)
            
            # Get comments
            comments = []
            if work_item.relations:
                comment_relations = [r for r in work_item.relations if r.rel == 'AttachedFile']
                for rel in comment_relations[:5]:  # Last 5
                    comments.append({
                        'author': 'Unknown',  # ADO doesn't provide this easily
                        'body': rel.attributes.get('name', ''),
                        'created': ''
                    })
            
            # Get attachments
            attachments = []
            if work_item.relations:
                attachment_relations = [r for r in work_item.relations if r.rel == 'AttachedFile']
                attachments = [rel.attributes.get('name', '') for rel in attachment_relations]
            
            # Get linked work items
            linked_tickets = []
            if work_item.relations:
                link_relations = [r for r in work_item.relations if 'workitems' in r.url.lower()]
                for rel in link_relations:
                    # Extract ID from URL
                    url_parts = rel.url.split('/')
                    if url_parts:
                        linked_tickets.append(url_parts[-1])
            
            # Map work item type to standard types
            ticket_type_map = {
                'Bug': 'bug',
                'User Story': 'story',
                'Task': 'task',
                'Feature': 'feature'
            }
            ticket_type = ticket_type_map.get(work_item_type, work_item_type.lower())
            
            # Map priority (ADO uses 1-4, convert to P0-P3)
            priority_map = {'1': 'P0', '2': 'P1', '3': 'P2', '4': 'P3'}
            priority = priority_map.get(priority, 'P2')
            
            ticket_info = TicketInfo(
                ticket_id=str(work_item_id),
                title=title,
                description=description,
                acceptance_criteria=acceptance_criteria,
                ticket_type=ticket_type,
                priority=priority,
                status=state,
                attachments=attachments,
                comments=comments,
                linked_tickets=linked_tickets
            )
            
            logger.info(f"Successfully fetched Azure DevOps work item: {ticket_id}")
            return ticket_info
            
        except Exception as e:
            logger.error(f"Failed to fetch Azure DevOps work item {ticket_id}: {e}")
            return None
    
    def _extract_acceptance_criteria(self, ac_text: str) -> List[str]:
        """
        Extract acceptance criteria from text
        
        Args:
            ac_text: Raw acceptance criteria text (may include HTML)
        
        Returns:
            List of criteria strings
        """
        if not ac_text:
            return []
        
        # Remove HTML tags (basic cleanup)
        import re
        clean_text = re.sub('<[^<]+?>', '', ac_text)
        
        criteria = []
        lines = clean_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if line:
                # Remove bullet points and numbering
                cleaned = line.lstrip('*-•·○►123456789.() ')
                if cleaned:
                    criteria.append(cleaned)
        
        return criteria
    
    def post_comment(self, ticket_id: str, comment: str) -> bool:
        """
        Post a comment to an Azure DevOps work item
        
        Args:
            ticket_id: The work item ID
            comment: The comment text
        
        Returns:
            True if successful, False otherwise
        """
        if not self.wit_client:
            if not self.connect():
                return False
        
        try:
            work_item_id = int(ticket_id)
            
            # Azure DevOps uses JSON Patch for updates
            from azure.devops.v7_0.work_item_tracking.models import JsonPatchOperation
            
            patch_document = [
                JsonPatchOperation(
                    op='add',
                    path='/fields/System.History',
                    value=comment
                )
            ]
            
            self.wit_client.update_work_item(
                document=patch_document,
                id=work_item_id
            )
            
            logger.info(f"Posted comment to Azure DevOps work item: {ticket_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to post comment to {ticket_id}: {e}")
            return False
    
    def attach_file(self, ticket_id: str, file_path: str, filename: str) -> bool:
        """
        Attach a file to an Azure DevOps work item
        
        Args:
            ticket_id: The work item ID
            file_path: Path to the file
            filename: Name for the attachment
        
        Returns:
            True if successful, False otherwise
        """
        if not self.wit_client:
            if not self.connect():
                return False
        
        try:
            work_item_id = int(ticket_id)
            
            # Upload attachment
            with open(file_path, 'rb') as f:
                attachment = self.wit_client.create_attachment(
                    upload_stream=f,
                    file_name=filename
                )
            
            # Link attachment to work item
            from azure.devops.v7_0.work_item_tracking.models import JsonPatchOperation
            
            patch_document = [
                JsonPatchOperation(
                    op='add',
                    path='/relations/-',
                    value={
                        'rel': 'AttachedFile',
                        'url': attachment.url,
                        'attributes': {
                            'name': filename
                        }
                    }
                )
            ]
            
            self.wit_client.update_work_item(
                document=patch_document,
                id=work_item_id
            )
            
            logger.info(f"Attached file {filename} to Azure DevOps work item: {ticket_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to attach file to {ticket_id}: {e}")
            return False
    
    def get_linked_tickets(self, ticket_id: str) -> List[str]:
        """
        Get IDs of work items linked to this work item
        
        Args:
            ticket_id: The work item ID
        
        Returns:
            List of linked work item IDs
        """
        if not self.wit_client:
            if not self.connect():
                return []
        
        try:
            work_item_id = int(ticket_id)
            work_item = self.wit_client.get_work_item(work_item_id, expand='Relations')
            
            linked = []
            if work_item.relations:
                for relation in work_item.relations:
                    if 'workitems' in relation.url.lower():
                        # Extract ID from URL
                        url_parts = relation.url.split('/')
                        if url_parts:
                            linked.append(url_parts[-1])
            
            return linked
            
        except Exception as e:
            logger.error(f"Failed to get linked work items for {ticket_id}: {e}")
            return []
    
    def search_tickets(self, wiql: str, max_results: int = 50) -> List[TicketInfo]:
        """
        Search for work items using WIQL (Work Item Query Language)
        
        Args:
            wiql: WIQL query string
            max_results: Maximum number of results
        
        Returns:
            List of TicketInfo objects
        """
        if not self.wit_client:
            if not self.connect():
                return []
        
        try:
            from azure.devops.v7_0.work_item_tracking.models import Wiql
            
            wiql_object = Wiql(query=wiql)
            result = self.wit_client.query_by_wiql(wiql_object)
            
            tickets = []
            for work_item_ref in result.work_items[:max_results]:
                ticket = self.fetch_ticket(str(work_item_ref.id))
                if ticket:
                    tickets.append(ticket)
            
            logger.info(f"Found {len(tickets)} work items matching WIQL query")
            return tickets
            
        except Exception as e:
            logger.error(f"WIQL search failed: {e}")
            return []
    
    def create_test_tasks(
        self,
        parent_ticket_id: str,
        test_cases: List[Dict],
        max_tasks: int = 10
    ) -> List[str]:
        """
        Create child tasks for test cases (Azure DevOps-specific feature)
        
        Args:
            parent_ticket_id: The parent work item ID
            test_cases: List of test case dictionaries
            max_tasks: Maximum number of tasks to create
        
        Returns:
            List of created task IDs
        """
        if not self.wit_client:
            if not self.connect():
                return []
        
        if not self.project:
            logger.error("Project name required to create tasks")
            return []
        
        created_tasks = []
        
        try:
            from azure.devops.v7_0.work_item_tracking.models import JsonPatchOperation
            
            for i, test_case in enumerate(test_cases[:max_tasks]):
                # Create task
                patch_document = [
                    JsonPatchOperation(
                        op='add',
                        path='/fields/System.Title',
                        value=f"[TEST] {test_case.get('title', 'Test Case')}"
                    ),
                    JsonPatchOperation(
                        op='add',
                        path='/fields/System.Description',
                        value=self._format_test_case_description(test_case)
                    )
                ]
                
                task = self.wit_client.create_work_item(
                    document=patch_document,
                    project=self.project,
                    type='Task'
                )
                
                # Link to parent
                link_patch = [
                    JsonPatchOperation(
                        op='add',
                        path='/relations/-',
                        value={
                            'rel': 'System.LinkTypes.Hierarchy-Reverse',
                            'url': f"{self.organization_url}/{self.project}/_apis/wit/workItems/{parent_ticket_id}"
                        }
                    )
                ]
                
                self.wit_client.update_work_item(
                    document=link_patch,
                    id=task.id
                )
                
                created_tasks.append(str(task.id))
                logger.info(f"Created test task: {task.id}")
            
            return created_tasks
            
        except Exception as e:
            logger.error(f"Failed to create test tasks: {e}")
            return created_tasks
    
    def _format_test_case_description(self, test_case: Dict) -> str:
        """Format test case as HTML description"""
        description = f"<b>Priority:</b> {test_case.get('priority', 'P2')}<br>"
        description += f"<b>Category:</b> {test_case.get('category', 'Unknown')}<br><br>"
        
        if test_case.get('preconditions'):
            description += f"<b>Preconditions:</b><br>{test_case['preconditions']}<br><br>"
        
        description += "<b>Test Steps:</b><br><ol>"
        for step in test_case.get('test_steps', []):
            description += f"<li>{step}</li>"
        description += "</ol>"
        
        description += f"<br><b>Expected Result:</b><br>{test_case.get('expected_result', '')}<br>"
        
        if test_case.get('test_data'):
            description += f"<br><b>Test Data:</b><br>{test_case['test_data']}<br>"
        
        return description
