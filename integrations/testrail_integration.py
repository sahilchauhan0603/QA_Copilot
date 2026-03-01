"""
TestRail Integration
Export test cases to TestRail test management system
"""
from typing import Dict, List, Optional, Any
import os
import requests
import logging
import base64

from integrations.test_management_base import TestManagementIntegration

logger = logging.getLogger(__name__)


class TestRailIntegration(TestManagementIntegration):
    """
    Integration with TestRail
    TestRail is a standalone test management system
    """
    
    def __init__(
        self,
        url: Optional[str] = None,
        email: Optional[str] = None,
        api_key: Optional[str] = None,
        project_id: Optional[int] = None
    ):
        """
        Initialize TestRail integration
        
        Args:
            url: TestRail instance URL (e.g., https://your-domain.testrail.io)
            email: User email for authentication
            api_key: TestRail API key (User Settings → API Keys)
            project_id: TestRail project ID
        """
        self.url = url or os.getenv('TESTRAIL_URL')
        self.email = email or os.getenv('TESTRAIL_EMAIL')
        self.api_key = api_key or os.getenv('TESTRAIL_API_KEY')
        self.project_id = project_id or int(os.getenv('TESTRAIL_PROJECT_ID', '0'))
        
        self.api_url = f"{self.url}/index.php?/api/v2" if self.url else None
        
        # Create authorization header
        if self.email and self.api_key:
            auth_str = f"{self.email}:{self.api_key}"
            auth_bytes = base64.b64encode(auth_str.encode('utf-8'))
            self.headers = {
                "Authorization": f"Basic {auth_bytes.decode('utf-8')}",
                "Content-Type": "application/json"
            }
        else:
            self.headers = None
    
    def connect(self) -> bool:
        """Test connection to TestRail"""
        try:
            if not all([self.url, self.email, self.api_key]):
                logger.error("Missing TestRail credentials. Set TESTRAIL_URL, TESTRAIL_EMAIL, TESTRAIL_API_KEY")
                return False
            
            # Test connection by getting projects
            response = requests.get(
                f"{self.api_url}/get_projects",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Successfully connected to TestRail at {self.url}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to TestRail: {e}")
            return False
    
    def create_test_suite(self, suite_name: str, description: str = "", project_key: str = None) -> Optional[str]:
        """
        Create a Test Suite in TestRail
        
        Args:
            suite_name: Name of the test suite
            description: Suite description
            project_key: Project ID (uses default if not provided)
        
        Returns:
            Suite ID if created
        """
        try:
            project_id = int(project_key) if project_key else self.project_id
            if not project_id:
                logger.error("No project ID provided")
                return None
            
            payload = {
                "name": suite_name,
                "description": description
            }
            
            response = requests.post(
                f"{self.api_url}/add_suite/{project_id}",
                json=payload,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            suite_id = str(result.get('id'))
            logger.info(f"Created TestRail Suite: {suite_id}")
            return suite_id
            
        except Exception as e:
            logger.error(f"Failed to create TestRail Suite: {e}")
            return None
    
    def create_test_case(self, test_case: Dict[str, Any], suite_id: str = None) -> Optional[str]:
        """
        Create a Test Case in TestRail
        
        Args:
            test_case: Test case data
            suite_id: Optional Suite ID
        
        Returns:
            Test Case ID if created
        """
        try:
            if not suite_id:
                logger.error("Suite ID is required for TestRail")
                return None
            
            # Read from the actual test case model field names
            test_steps = test_case.get('test_steps', [])
            expected_result = test_case.get('expected_result', '')
            category = test_case.get('category', 'Functional')
            preconditions = test_case.get('preconditions', '')
            test_data = test_case.get('test_data', '')

            # Get or create section (folder) in suite, grouped by category
            section_id = self._get_or_create_section(suite_id, category or 'Functional')

            # Format test steps — expected_result is a single overall value,
            # so show it after the last step.
            steps_text = ""
            for i, step in enumerate(test_steps):
                steps_text += f"{i + 1}. {step}\n"
            if expected_result:
                steps_text += f"\nExpected Result:\n{expected_result}\n"

            # Build preconditions block
            preconds_parts = []
            if preconditions:
                preconds_parts.append(preconditions)
            if test_data:
                preconds_parts.append(f"Test Data: {test_data}")
            preconds_text = "\n".join(preconds_parts)

            # Create test case
            payload = {
                "title": test_case.get('title', 'Untitled Test'),
                "type_id": self._get_type_id(category or 'Functional'),
                "priority_id": self._map_priority(test_case.get('priority', 'P2')),
                "custom_steps": steps_text,
                "custom_preconds": preconds_text,
            }
            
            if section_id:
                response = requests.post(
                    f"{self.api_url}/add_case/{section_id}",
                    json=payload,
                    headers=self.headers,
                    timeout=30
                )
            else:
                response = requests.post(
                    f"{self.api_url}/add_case/{suite_id}",
                    json=payload,
                    headers=self.headers,
                    timeout=30
                )
            
            response.raise_for_status()
            
            result = response.json()
            case_id = str(result.get('id'))
            logger.info(f"Created TestRail Case: {case_id}")
            return case_id
            
        except Exception as e:
            logger.error(f"Failed to create TestRail Case: {e}")
            logger.error(f"Response: {e.response.text if hasattr(e, 'response') else 'N/A'}")
            return None
    
    def bulk_create_test_cases(self, test_cases: List[Dict[str, Any]], suite_id: str = None) -> Dict[str, Any]:
        """
        Create multiple test cases
        
        Args:
            test_cases: List of test case dictionaries
            suite_id: Suite ID (required)
        
        Returns:
            Summary of created/failed tests
        """
        results = {
            'created': 0,
            'failed': 0,
            'ids': []
        }
        
        if not suite_id:
            logger.error("Suite ID is required for bulk create in TestRail")
            results['failed'] = len(test_cases)
            return results
        
        for test_case in test_cases:
            case_id = self.create_test_case(test_case, suite_id)
            if case_id:
                results['created'] += 1
                results['ids'].append(case_id)
            else:
                results['failed'] += 1
        
        logger.info(f"TestRail bulk create: {results['created']} created, {results['failed']} failed")
        return results
    
    def link_to_ticket(self, test_case_id: str, ticket_id: str) -> bool:
        """
        Link a Test Case to an external ticket
        
        Args:
            test_case_id: Test Case ID
            ticket_id: External ticket ID (e.g., PROJ-123)
        
        Returns:
            True if linked successfully
        """
        try:
            # Update test case with reference
            payload = {
                "refs": ticket_id
            }
            
            response = requests.post(
                f"{self.api_url}/update_case/{test_case_id}",
                json=payload,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            
            logger.info(f"Linked TestRail case {test_case_id} to {ticket_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to link test to ticket: {e}")
            return False
    
    def _get_or_create_section(self, suite_id: str, section_name: str) -> Optional[str]:
        """Get or create a section (folder) in a suite"""
        try:
            # Get existing sections
            response = requests.get(
                f"{self.api_url}/get_sections/{self.project_id}&suite_id={suite_id}",
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            
            sections = response.json().get('sections', [])
            for section in sections:
                if section.get('name') == section_name:
                    return str(section.get('id'))
            
            # Create new section
            payload = {
                "suite_id": int(suite_id),
                "name": section_name
            }
            
            response = requests.post(
                f"{self.api_url}/add_section/{self.project_id}",
                json=payload,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return str(result.get('id'))
            
        except Exception as e:
            logger.warning(f"Failed to get/create section: {e}")
            return None
    
    def _get_type_id(self, test_type: str) -> int:
        """Map test type to TestRail type ID"""
        type_map = {
            'Functional': 1,
            'Regression': 2,
            'Security': 3,
            'Performance': 4,
            'UI': 5,
            'API': 6,
            'Integration': 7
        }
        return type_map.get(test_type, 1)  # Default to Functional
    
    def _map_priority(self, priority: str) -> int:
        """Map internal priority to TestRail priority ID"""
        priority_map = {
            'P0': 4,  # Critical
            'P1': 3,  # High
            'P2': 2,  # Medium
            'P3': 1   # Low
        }
        return priority_map.get(priority, 2)
