"""
Sync Agent
Posts generated test cases back to Jira/Azure DevOps
"""
from typing import Dict, List, Optional
import logging
from agents.state import AgentState, log_agent_action
from integrations.manager import IntegrationManager


logger = logging.getLogger(__name__)


class SyncAgent:
    """
    Agent that syncs results back to ticket systems
    """
    
    def __init__(self, custom_credentials: Optional[Dict] = None):
        """
        Initialize Sync Agent
        
        Args:
            custom_credentials: Optional custom credentials for integrations
        """
        self.name = "SyncAgent"
        self.integration_manager = IntegrationManager(custom_credentials=custom_credentials)
    
    def process(self, state: AgentState, sync_options: Optional[Dict] = None) -> tuple[AgentState, Dict]:
        """
        Sync results back to ticket system
        
        Args:
            state: Current agent state with generated test cases
            sync_options: Options for syncing (post_comment, attach_file, create_subtasks)
        
        Returns:
            Tuple of (updated state, sync_result dict with success status and messages)
        """
        state["current_agent"] = self.name
        
        sync_options = sync_options or {}
        sync_result = {
            "success": False,
            "message": "",
            "details": []
        }
        
        # Auto-detect integration
        integration = self.integration_manager.auto_detect_integration()
        
        if not integration:
            logger.warning("No integration configured. Skipping sync.")
            log_agent_action(state, self.name, "sync_skipped", {
                "reason": "No integration configured"
            })
            sync_result["message"] = "No integration configured. Please check your .env file."
            return state, sync_result
        
        ticket_id = state["ticket_info"]["ticket_id"]
        all_success = True
        
        # Post summary comment
        if sync_options.get('post_comment', True):
            success = self._post_summary_comment(integration, ticket_id, state)
            if success:
                sync_result["details"].append("✅ Posted summary comment")
            else:
                sync_result["details"].append("❌ Failed to post comment")
                all_success = False
        
        # Attach Excel file
        if sync_options.get('attach_file', False) and sync_options.get('excel_path'):
            success = self._attach_test_cases(integration, ticket_id, sync_options['excel_path'])
            if success:
                sync_result["details"].append("✅ Attached Excel file")
            else:
                sync_result["details"].append("❌ Failed to attach file")
                all_success = False
        
        # Create subtasks/tasks for test cases
        if sync_options.get('create_subtasks', False):
            subtasks = self._create_test_subtasks(integration, ticket_id, state)
            if subtasks:
                sync_result["details"].append(f"✅ Created {len(subtasks)} test subtasks")
            else:
                sync_result["details"].append("❌ Failed to create subtasks")
                all_success = False
        
        sync_result["success"] = all_success
        if all_success:
            sync_result["message"] = f"Successfully synced to {ticket_id}"
        else:
            sync_result["message"] = f"Sync to {ticket_id} completed with some errors"
        
        log_agent_action(state, self.name, "sync_completed", {
            "ticket_id": ticket_id,
            "integration_type": type(integration).__name__,
            "success": all_success
        })
        
        return state, sync_result
    
    def _post_summary_comment(self, integration, ticket_id: str, state: AgentState) -> bool:
        """Post a summary comment with test case statistics"""
        try:
            test_cases = state["test_cases"]
            coverage_gaps = state.get("coverage_gaps", [])
            
            # Count by priority
            priority_counts = {}
            for tc in test_cases:
                p = tc.get('priority', 'P2')
                priority_counts[p] = priority_counts.get(p, 0) + 1
            
            # Build comment
            comment = "🤖 **QA Copilot - Test Cases Generated**\n\n"
            comment += f"**Total Test Cases:** {len(test_cases)}\n\n"
            
            comment += "**By Priority:**\n"
            for priority in ['P0', 'P1', 'P2', 'P3']:
                count = priority_counts.get(priority, 0)
                if count > 0:
                    comment += f"- {priority}: {count} test cases\n"
            
            comment += f"\n**Test Categories:**\n"
            categories = set(tc.get('category', 'Other') for tc in test_cases)
            for category in categories:
                count = sum(1 for tc in test_cases if tc.get('category') == category)
                comment += f"- {category}: {count} scenarios\n"
            
            if coverage_gaps:
                comment += f"\n⚠️ **Coverage Gaps Identified:** {len(coverage_gaps)}\n"
                for gap in coverage_gaps[:3]:
                    comment += f"- {gap}\n"
                if len(coverage_gaps) > 3:
                    comment += f"- ... and {len(coverage_gaps) - 3} more\n"
            
            comment += f"\n📊 View detailed test cases in the attached Excel file or generated subtasks."
            
            return integration.post_comment(ticket_id, comment)
            
        except Exception as e:
            logger.error(f"Failed to post summary comment: {e}")
            return False
    
    def _attach_test_cases(self, integration, ticket_id: str, excel_path: str) -> bool:
        """Attach Excel file with test cases"""
        try:
            import os
            filename = os.path.basename(excel_path)
            return integration.attach_file(ticket_id, excel_path, filename)
        except Exception as e:
            logger.error(f"Failed to attach test cases: {e}")
            return False
    
    def _create_test_subtasks(self, integration, ticket_id: str, state: AgentState) -> List[str]:
        """Create subtasks/tasks for test cases"""
        try:
            test_cases = state["test_cases"]
            
            # Convert to dict format
            test_case_dicts = [
                {
                    'title': tc.get('title', ''),
                    'priority': tc.get('priority', 'P2'),
                    'category': tc.get('category', 'Unknown'),
                    'preconditions': tc.get('preconditions', ''),
                    'test_steps': tc.get('test_steps', []),
                    'expected_result': tc.get('expected_result', ''),
                    'test_data': tc.get('test_data', '')
                }
                for tc in test_cases
            ]
            
            # Use integration-specific method
            if hasattr(integration, 'create_test_subtasks'):
                # Jira
                return integration.create_test_subtasks(ticket_id, test_case_dicts, max_subtasks=10)
            elif hasattr(integration, 'create_test_tasks'):
                # Azure DevOps
                return integration.create_test_tasks(ticket_id, test_case_dicts, max_tasks=10)
            
            return []
            
        except Exception as e:
            logger.error(f"Failed to create test subtasks: {e}")
            return []
