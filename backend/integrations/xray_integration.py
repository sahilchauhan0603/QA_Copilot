"""
Xray Integration
Export test cases to Xray for Jira (test management plugin)
"""
from typing import Dict, List, Optional, Any
import os
import requests
import logging
from requests.auth import HTTPBasicAuth

from integrations.test_management_base import TestManagementIntegration

logger = logging.getLogger(__name__)


class XrayIntegration(TestManagementIntegration):
    """
    Integration with Xray for Jira
    Xray is a test management plugin for Jira
    """
    
    def __init__(
        self,
        jira_url: Optional[str] = None,
        email: Optional[str] = None,
        api_token: Optional[str] = None,
        project_key: Optional[str] = None
    ):
        """
        Initialize Xray integration
        
        Args:
            jira_url: Jira instance URL (e.g., https://your-domain.atlassian.net)
            email: User email for authentication
            api_token: Jira API token
            project_key: Jira project key (e.g., 'PROJ')
        """
        self.jira_url = jira_url or os.getenv('JIRA_URL')
        self.email = email or os.getenv('JIRA_EMAIL')
        self.api_token = api_token or os.getenv('JIRA_API_TOKEN')
        self.project_key = project_key or os.getenv('XRAY_PROJECT_KEY')
        self.base_url = f"{self.jira_url}/rest/api/2" if self.jira_url else None
        self.auth = HTTPBasicAuth(self.email, self.api_token) if self.email and self.api_token else None
    
    def connect(self) -> bool:
        """Test connection to Jira/Xray"""
        try:
            if not all([self.jira_url, self.email, self.api_token]):
                logger.error("Missing Xray credentials")
                return False
            
            # Test connection
            response = requests.get(
                f"{self.base_url}/myself",
                auth=self.auth,
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Successfully connected to Xray/Jira at {self.jira_url}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Xray: {e}")
            return False

    def _get_issue_type_name(self, type_hint: str) -> str:
        """
        Query the project's valid issue types and return the name that best matches
        type_hint (e.g. "test" for Xray Test, "test set" for Xray Test Set).
        Results are cached per hint to avoid repeated API calls.
        """
        cache_key = f'_cached_issue_type_{type_hint.replace(" ", "_")}'
        cached = getattr(self, cache_key, None)
        if cached:
            return cached

        try:
            # Jira Cloud: use createmeta to enumerate project issue types
            response = requests.get(
                f"{self.base_url}/issue/createmeta",
                params={"projectKeys": self.project_key, "expand": "projects.issuetypes"},
                auth=self.auth,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            projects = data.get('projects', [])
            issue_types = projects[0].get('issuetypes', []) if projects else []

            # Prefer an exact match first, then substring
            hint_lower = type_hint.lower()
            exact = next((it['name'] for it in issue_types if it.get('name', '').lower() == hint_lower), None)
            if exact:
                setattr(self, cache_key, exact)
                logger.info(f"Resolved Xray issue type '{type_hint}' → '{exact}'")
                return exact

            partial = next((it['name'] for it in issue_types if hint_lower in it.get('name', '').lower()), None)
            if partial:
                setattr(self, cache_key, partial)
                logger.info(f"Resolved Xray issue type '{type_hint}' → '{partial}' (partial match)")
                return partial

            # Nothing matched — log available types to help with debugging
            names = [it.get('name') for it in issue_types]
            logger.error(f"No issue type matching '{type_hint}' found in project {self.project_key}. Available: {names}")
            raise ValueError(f"No issue type matching '{type_hint}' in project '{self.project_key}'. Available: {names}")

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to resolve issue type '{type_hint}': {e}")
            raise

    def create_test_suite(self, suite_name: str, description: str = "", project_key: str = None) -> Optional[str]:
        """
        Create a Test Set in Xray
        
        Args:
            suite_name: Name of the test set
            description: Test set description
            project_key: Project key (uses default if not provided)
        
        Returns:
            Test Set key if created, None otherwise
        """
        try:
            project = project_key or self.project_key
            if not project:
                logger.error("No project key provided")
                return None
            
            # Create Test Set issue
            payload = {
                "fields": {
                    "project": {"key": project},
                    "summary": suite_name,
                    "description": description,
                    "issuetype": {"name": self._get_issue_type_name("test set")}
                }
            }
            
            response = requests.post(
                f"{self.base_url}/issue",
                json=payload,
                auth=self.auth,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            test_set_key = result.get('key')
            logger.info(f"Created Xray Test Set: {test_set_key}")
            return test_set_key
            
        except Exception as e:
            logger.error(f"Failed to create Xray Test Set: {e}")
            return None
    
    def create_test_case(self, test_case: Dict[str, Any], suite_id: str = None) -> Optional[str]:
        """
        Create a Test issue in Xray

        Args:
            test_case: Test case data (fields: title, priority, category, preconditions,
                       test_steps, expected_result, test_data)
            suite_id: Optional Test Set key to add to

        Returns:
            Test issue key if created, None otherwise
        """
        try:
            if not self.project_key:
                logger.error("No project key configured")
                return None

            # Read from the actual test case model field names
            test_steps = test_case.get('test_steps', [])
            expected_result = test_case.get('expected_result', '')
            category = test_case.get('category', 'Functional')
            preconditions = test_case.get('preconditions', '')
            test_data = test_case.get('test_data', '')

            # Build a readable Jira description.
            # NOTE: Xray test steps must be added via the Xray native REST API
            # (/rest/raven/1.0/api/test/{key}/step) — NOT via customfield_XXXXX
            # in the issue creation payload (that field ID varies per instance
            # and sending a wrong one causes a 400 Bad Request).
            description_parts = []
            if preconditions:
                description_parts.append(f"*Preconditions:*\n{preconditions}")
            if test_steps:
                steps_text = "\n".join(f"{i+1}. {s}" for i, s in enumerate(test_steps))
                description_parts.append(f"*Test Steps:*\n{steps_text}")
            if expected_result:
                description_parts.append(f"*Expected Result:*\n{expected_result}")
            if test_data:
                description_parts.append(f"*Test Data:*\n{test_data}")
            description = "\n\n".join(description_parts)

            # Labels must be single words (no spaces)
            label = (category or 'Functional').replace(' ', '_')

            payload = {
                "fields": {
                    "project": {"key": self.project_key},
                    "summary": test_case.get('title', 'Untitled Test'),
                    "description": description,
                    "issuetype": {"name": self._get_issue_type_name("test")},
                    "priority": {"name": self._map_priority(test_case.get('priority', 'P2'))},
                    "labels": [label]
                }
            }

            response = requests.post(
                f"{self.base_url}/issue",
                json=payload,
                auth=self.auth,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()

            result = response.json()
            test_key = result.get('key')
            logger.info(f"Created Xray Test: {test_key}")

            # Try to add steps via the Xray native REST API (best-effort; falls back to description)
            if test_key and test_steps:
                self._add_test_steps(test_key, test_steps, expected_result)

            # Add to Test Set if provided
            if suite_id and test_key:
                self._add_test_to_set(test_key, suite_id)

            return test_key

        except Exception as e:
            logger.error(f"Failed to create Xray Test: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Jira response body: {e.response.text}")
            return None
    
    def bulk_create_test_cases(self, test_cases: List[Dict[str, Any]], suite_id: str = None) -> Dict[str, Any]:
        """
        Create multiple test cases
        
        Args:
            test_cases: List of test case dictionaries
            suite_id: Optional Test Set key
        
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
        
        logger.info(f"Xray bulk create: {results['created']} created, {results['failed']} failed")
        return results
    
    def link_to_ticket(self, test_case_id: str, ticket_id: str) -> bool:
        """
        Link a Test to a Story/Bug in Jira
        
        Args:
            test_case_id: Test issue key
            ticket_id: Story/Bug issue key
        
        Returns:
            True if linked successfully
        """
        try:
            # Create issue link
            payload = {
                "type": {"name": "Tests"},
                "inwardIssue": {"key": test_case_id},
                "outwardIssue": {"key": ticket_id}
            }
            
            response = requests.post(
                f"{self.base_url}/issueLink",
                json=payload,
                auth=self.auth,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            
            logger.info(f"Linked {test_case_id} to {ticket_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to link test to ticket: {e}")
            return False
    
    def _add_test_steps(self, test_key: str, steps: list, expected_result: str = '') -> bool:
        """Add test steps to a Test issue via the Xray native REST API (best-effort)."""
        try:
            xray_url = f"{self.jira_url}/rest/raven/1.0/api/test/{test_key}/step"
            n = len(steps)
            for i, step in enumerate(steps):
                payload = {
                    "step": step,
                    "data": "",
                    # Attach the overall expected result to the last step
                    "result": expected_result if (i == n - 1 and expected_result) else ""
                }
                resp = requests.post(
                    xray_url,
                    json=payload,
                    auth=self.auth,
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )
                if not resp.ok:
                    logger.debug(
                        f"Xray step API returned {resp.status_code} for {test_key} — "
                        "steps are preserved in the issue description."
                    )
                    return False
            logger.info(f"Added {n} steps to {test_key} via Xray API")
            return True
        except Exception as e:
            logger.debug(f"Could not add steps via Xray native API: {e}. Steps stored in description.")
            return False

    def _add_test_to_set(self, test_key: str, test_set_key: str) -> bool:
        """Add a Test to a Test Set"""
        try:
            # Xray REST API endpoint for adding tests to test set
            xray_url = f"{self.jira_url}/rest/raven/1.0/api/testset/{test_set_key}/test"
            
            payload = {
                "add": [test_key]
            }
            
            response = requests.post(
                xray_url,
                json=payload,
                auth=self.auth,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            return True
            
        except Exception as e:
            logger.warning(f"Failed to add test to set: {e}")
            return False
    
    def _map_priority(self, priority: str) -> str:
        """Map internal priority to Jira priority"""
        priority_map = {
            'P0': 'Highest',
            'P1': 'High',
            'P2': 'Medium',
            'P3': 'Low'
        }
        return priority_map.get(priority, 'Medium')
