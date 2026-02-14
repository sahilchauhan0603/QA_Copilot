"""
Zephyr Scale Integration
Export test cases to Zephyr Scale (formerly Zephyr Squad) for Jira
"""
from typing import Dict, List, Optional, Any
import os
import requests
import logging
from requests.auth import HTTPBasicAuth

from integrations.test_management_base import TestManagementIntegration

logger = logging.getLogger(__name__)


class ZephyrIntegration(TestManagementIntegration):
    """
    Integration with Zephyr Scale for Jira
    Supports both Zephyr Squad (server) and Zephyr Scale (cloud)
    """
    
    def __init__(
        self,
        jira_url: Optional[str] = None,
        email: Optional[str] = None,
        api_token: Optional[str] = None,
        zephyr_token: Optional[str] = None,
        project_key: Optional[str] = None
    ):
        """
        Initialize Zephyr integration
        
        Args:
            jira_url: Jira instance URL
            email: User email for authentication
            api_token: Jira API token
            zephyr_token: Zephyr Scale API token (for cloud version)
            project_key: Jira project key
        """
        self.jira_url = jira_url or os.getenv('JIRA_URL')
        self.email = email or os.getenv('JIRA_EMAIL')
        self.api_token = api_token or os.getenv('JIRA_API_TOKEN')
        self.zephyr_token = zephyr_token or os.getenv('ZEPHYR_API_TOKEN')
        self.project_key = project_key or os.getenv('ZEPHYR_PROJECT_KEY')
        
        # Zephyr Scale Cloud API
        self.zephyr_base_url = "https://api.zephyrscale.smartbear.com/v2"
        self.auth = HTTPBasicAuth(self.email, self.api_token) if self.email and self.api_token else None
    
    def connect(self) -> bool:
        """Test connection to Zephyr"""
        try:
            if not self.zephyr_token:
                logger.error("Missing Zephyr API token. Set ZEPHYR_API_TOKEN")
                return False
            
            # Test connection to Zephyr Scale API
            response = requests.get(
                f"{self.zephyr_base_url}/healthcheck",
                headers={"Authorization": f"Bearer {self.zephyr_token}"},
                timeout=10
            )
            response.raise_for_status()
            logger.info("Successfully connected to Zephyr Scale")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Zephyr: {e}")
            return False
    
    def create_test_suite(self, suite_name: str, description: str = "", project_key: str = None) -> Optional[str]:
        """
        Create a Test Cycle in Zephyr
        
        Args:
            suite_name: Name of the test cycle
            description: Cycle description
            project_key: Project key
        
        Returns:
            Test Cycle ID if created
        """
        try:
            project = project_key or self.project_key
            if not project:
                logger.error("No project key provided")
                return None
            
            # Get project ID from key
            project_id = self._get_project_id(project)
            if not project_id:
                return None
            
            # Create Test Cycle
            payload = {
                "projectKey": project,
                "name": suite_name,
                "description": description
            }
            
            response = requests.post(
                f"{self.zephyr_base_url}/testcycles",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.zephyr_token}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            cycle_key = result.get('key')
            logger.info(f"Created Zephyr Test Cycle: {cycle_key}")
            return cycle_key
            
        except Exception as e:
            logger.error(f"Failed to create Zephyr Test Cycle: {e}")
            return None
    
    def create_test_case(self, test_case: Dict[str, Any], suite_id: str = None) -> Optional[str]:
        """
        Create a Test Case in Zephyr
        
        Args:
            test_case: Test case data
            suite_id: Optional Test Cycle key
        
        Returns:
            Test Case key if created
        """
        try:
            if not self.project_key:
                logger.error("No project key configured")
                return None
            
            # Format test steps for Zephyr
            test_script = {
                "type": "STEP_BY_STEP",
                "steps": []
            }
            
            test_steps = test_case.get('steps', [])
            expected_results = test_case.get('expected_results', [])
            
            for i, step in enumerate(test_steps):
                test_script["steps"].append({
                    "index": i,
                    "description": step,
                    "expectedResult": expected_results[i] if i < len(expected_results) else ""
                })
            
            # Create Test Case
            payload = {
                "projectKey": self.project_key,
                "name": test_case.get('title', 'Untitled Test'),
                "objective": test_case.get('description', ''),
                "priority": self._map_priority(test_case.get('priority', 'P2')),
                "labels": [test_case.get('test_type', 'Functional').replace(' ', '_')],
                "testScript": test_script
            }
            
            # Add custom fields if available
            if test_case.get('test_data'):
                payload['precondition'] = f"Test Data: {test_case['test_data']}"
            
            response = requests.post(
                f"{self.zephyr_base_url}/testcases",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.zephyr_token}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            test_key = result.get('key')
            logger.info(f"Created Zephyr Test Case: {test_key}")
            
            # Add to Test Cycle if provided
            if suite_id and test_key:
                self._add_test_to_cycle(test_key, suite_id)
            
            return test_key
            
        except Exception as e:
            logger.error(f"Failed to create Zephyr Test Case: {e}")
            logger.error(f"Response: {e.response.text if hasattr(e, 'response') else 'N/A'}")
            return None
    
    def bulk_create_test_cases(self, test_cases: List[Dict[str, Any]], suite_id: str = None) -> Dict[str, Any]:
        """
        Create multiple test cases
        
        Args:
            test_cases: List of test case dictionaries
            suite_id: Optional Test Cycle key
        
        Returns:
            Summary of created/failed tests
        """
        results = {
            'created': 0,
            'failed': 0,
            'ids': []
        }
        
        for test_case in test_cases:
            test_key = self.create_test_case(test_case, suite_id)
            if test_key:
                results['created'] += 1
                results['ids'].append(test_key)
            else:
                results['failed'] += 1
        
        logger.info(f"Zephyr bulk create: {results['created']} created, {results['failed']} failed")
        return results
    
    def link_to_ticket(self, test_case_id: str, ticket_id: str) -> bool:
        """
        Link a Test Case to a Jira issue
        
        Args:
            test_case_id: Test Case key
            ticket_id: Jira issue key
        
        Returns:
            True if linked successfully
        """
        try:
            # Link test case to issue
            payload = {
                "issueId": ticket_id
            }
            
            response = requests.post(
                f"{self.zephyr_base_url}/testcases/{test_case_id}/links/issues",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.zephyr_token}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            response.raise_for_status()
            
            logger.info(f"Linked Zephyr test {test_case_id} to {ticket_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to link test to ticket: {e}")
            return False
    
    def _get_project_id(self, project_key: str) -> Optional[str]:
        """Get Zephyr project ID from Jira project key"""
        try:
            response = requests.get(
                f"{self.zephyr_base_url}/projects",
                headers={"Authorization": f"Bearer {self.zephyr_token}"},
                timeout=30
            )
            response.raise_for_status()
            
            projects = response.json().get('values', [])
            for project in projects:
                if project.get('key') == project_key:
                    return project.get('id')
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get project ID: {e}")
            return None
    
    def _add_test_to_cycle(self, test_key: str, cycle_key: str) -> bool:
        """Add a Test Case to a Test Cycle"""
        try:
            payload = {
                "testCaseKey": test_key
            }
            
            response = requests.post(
                f"{self.zephyr_base_url}/testcycles/{cycle_key}/testexecutions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.zephyr_token}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            response.raise_for_status()
            return True
            
        except Exception as e:
            logger.warning(f"Failed to add test to cycle: {e}")
            return False
    
    def _map_priority(self, priority: str) -> str:
        """Map internal priority to Zephyr priority"""
        priority_map = {
            'P0': 'High',
            'P1': 'High',
            'P2': 'Normal',
            'P3': 'Low'
        }
        return priority_map.get(priority, 'Normal')
