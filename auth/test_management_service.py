"""
Test Management Service
Handles exporting generated test cases to test management tools
"""
from typing import Dict, List, Optional, Any
import logging

from integrations.xray_integration import XrayIntegration
from integrations.zephyr_integration import ZephyrIntegration
from integrations.testrail_integration import TestRailIntegration
from auth.integration_service import IntegrationService

logger = logging.getLogger(__name__)


class TestManagementService:
    """Service for managing test case exports"""
    
    def __init__(self):
        self.integration_service = IntegrationService()
    
    def export_to_xray(
        self,
        test_cases: List[Dict[str, Any]],
        user_id: int,
        team_id: Optional[int] = None,
        suite_name: str = None,
        ticket_id: str = None,
        project_key: str = None
    ) -> Dict[str, Any]:
        """
        Export test cases to Xray
        
        Args:
            test_cases: List of generated test cases
            user_id: User ID for credential lookup
            team_id: Optional team ID for credential lookup
            suite_name: Optional test set name
            ticket_id: Optional Jira ticket to link
            project_key: Jira project key (from config or override)
        
        Returns:
            Export results summary
        """
        try:
            # Get Jira credentials (Xray uses Jira)
            jira_creds = self.integration_service.get_credentials('jira', user_id=user_id, team_id=team_id)
            if not jira_creds:
                return {'success': False, 'error': 'Jira integration not configured. Please configure Jira credentials first.'}
            
            # Get Xray config for project key
            xray_config = self.integration_service.get_credentials('xray', user_id=user_id, team_id=team_id)
            if not project_key:
                project_key = xray_config.get('project_key') if xray_config else None
            
            if not project_key:
                return {'success': False, 'error': 'Xray project key not configured. Please configure Xray settings.'}
            
            xray = XrayIntegration(
                jira_url=jira_creds.get('url'),
                email=jira_creds.get('email'),
                api_token=jira_creds.get('api_token'),
                project_key=project_key
            )
            
            if not xray.connect():
                return {'success': False, 'error': 'Failed to connect to Xray'}
            
            # Create test set if suite name provided
            suite_id = None
            if suite_name:
                suite_id = xray.create_test_suite(suite_name)
            
            # Export test cases
            result = xray.bulk_create_test_cases(test_cases, suite_id)
            
            # Link to ticket if provided
            if ticket_id and result.get('ids'):
                for test_id in result['ids']:
                    xray.link_to_ticket(test_id, ticket_id)
            
            return {
                'success': True,
                'tool': 'Xray',
                'suite_id': suite_id,
                'created': result['created'],
                'failed': result['failed'],
                'test_ids': result['ids']
            }
            
        except Exception as e:
            logger.error(f"Export to Xray failed: {e}")
            return {'success': False, 'error': 'Failed to export to Xray. Please try again.'}
    
    def export_to_zephyr(
        self,
        test_cases: List[Dict[str, Any]],
        user_id: int,
        team_id: Optional[int] = None,
        suite_name: str = None,
        ticket_id: str = None,
        project_key: str = None
    ) -> Dict[str, Any]:
        """
        Export test cases to Zephyr Scale
        
        Args:
            test_cases: List of generated test cases
            user_id: User ID for credential lookup
            team_id: Optional team ID for credential lookup
            suite_name: Optional test cycle name
            ticket_id: Optional Jira ticket to link
            project_key: Jira project key (from config or override)
        
        Returns:
            Export results summary
        """
        try:
            # Get Jira credentials (Zephyr uses Jira)
            jira_creds = self.integration_service.get_credentials('jira', user_id=user_id, team_id=team_id)
            if not jira_creds:
                return {'success': False, 'error': 'Jira integration not configured. Please configure Jira credentials first.'}
            
            # Get Zephyr config for project key and token
            zephyr_config = self.integration_service.get_credentials('zephyr', user_id=user_id, team_id=team_id)
            if not project_key:
                project_key = zephyr_config.get('project_key') if zephyr_config else None
            
            if not project_key:
                return {'success': False, 'error': 'Zephyr project key not configured. Please configure Zephyr settings.'}
            
            zephyr_token = zephyr_config.get('zephyr_token') if zephyr_config else None
            if not zephyr_token:
                return {'success': False, 'error': 'Zephyr API token not configured. Please configure Zephyr settings.'}
            
            zephyr = ZephyrIntegration(
                jira_url=jira_creds.get('url'),
                email=jira_creds.get('email'),
                api_token=jira_creds.get('api_token'),
                zephyr_token=zephyr_token,
                project_key=project_key
            )
            
            if not zephyr.connect():
                return {'success': False, 'error': 'Failed to connect to Zephyr'}
            
            # Create test cycle if suite name provided
            suite_id = None
            if suite_name:
                suite_id = zephyr.create_test_suite(suite_name)
            
            # Export test cases
            result = zephyr.bulk_create_test_cases(test_cases, suite_id)
            
            # Link to ticket if provided
            if ticket_id and result.get('ids'):
                for test_id in result['ids']:
                    zephyr.link_to_ticket(test_id, ticket_id)
            
            return {
                'success': True,
                'tool': 'Zephyr',
                'suite_id': suite_id,
                'created': result['created'],
                'failed': result['failed'],
                'test_ids': result['ids']
            }
            
        except Exception as e:
            logger.error(f"Export to Zephyr failed: {e}")
            return {'success': False, 'error': 'Failed to export to Zephyr Scale. Please try again.'}
    
    def export_to_testrail(
        self,
        test_cases: List[Dict[str, Any]],
        user_id: int,
        team_id: Optional[int] = None,
        suite_name: str = None,
        ticket_id: str = None,
        project_id: int = None
    ) -> Dict[str, Any]:
        """
        Export test cases to TestRail
        
        Args:
            test_cases: List of generated test cases
            user_id: User ID for credential lookup
            team_id: Optional team ID for credential lookup
            suite_name: Test suite name (required for TestRail)
            ticket_id: Optional external ticket reference
            project_id: TestRail project ID (from config or override)
        
        Returns:
            Export results summary
        """
        try:
            # Get TestRail credentials
            testrail_creds = self.integration_service.get_credentials('testrail', user_id=user_id, team_id=team_id)
            if not testrail_creds:
                return {'success': False, 'error': 'TestRail integration not configured. Please configure TestRail credentials first.'}
            
            if not project_id:
                project_id = int(testrail_creds.get('project_id', 0)) if testrail_creds.get('project_id') else None
            
            testrail = TestRailIntegration(
                url=testrail_creds.get('url'),
                email=testrail_creds.get('email'),
                api_key=testrail_creds.get('api_key'),
                project_id=project_id
            )
            
            if not testrail.connect():
                return {'success': False, 'error': 'Failed to connect to TestRail'}
            
            # Create test suite (required for TestRail)
            suite_id = testrail.create_test_suite(
                suite_name or "AI Generated Tests",
                "Test cases generated by QA Copilot"
            )
            
            if not suite_id:
                return {'success': False, 'error': 'Failed to create test suite'}
            
            # Add ticket_id to test cases for reference
            if ticket_id:
                for tc in test_cases:
                    tc['ticket_id'] = ticket_id
            
            # Export test cases
            result = testrail.bulk_create_test_cases(test_cases, suite_id)
            
            return {
                'success': True,
                'tool': 'TestRail',
                'suite_id': suite_id,
                'created': result['created'],
                'failed': result['failed'],
                'test_ids': result['ids']
            }
            
        except Exception as e:
            logger.error(f"Export to TestRail failed: {e}")
            return {'success': False, 'error': 'Failed to export to TestRail. Please try again.'}
    
    @staticmethod
    def format_test_cases_for_export(generation_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Format generated test cases for export
        
        Args:
            generation_data: Complete generation result with all agent data
        
        Returns:
            List of formatted test cases
        """
        test_cases = []
        
        # Extract test cases from generation data
        test_generator_output = generation_data.get('test_generator', {})
        all_test_cases = test_generator_output.get('test_cases', [])
        
        for tc in all_test_cases:
            formatted = {
                'title': tc.get('title', ''),
                'description': tc.get('description', ''),
                'steps': tc.get('steps', []),
                'expected_results': tc.get('expected_results', []),
                'priority': tc.get('priority', 'P2'),
                'test_type': tc.get('test_type', 'Functional'),
                'test_data': tc.get('test_data', '')
            }
            test_cases.append(formatted)
        
        return test_cases
