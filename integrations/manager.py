"""
Integration Manager
Factory for creating and managing ticket integrations
"""
from typing import Optional, Dict
import os
from integrations.base import TicketIntegration
from integrations.jira_integration import JiraIntegration
from integrations.azure_devops_integration import AzureDevOpsIntegration


class IntegrationManager:
    """
    Factory and manager for ticket system integrations
    """
    
    def __init__(self, custom_credentials: Optional[Dict] = None):
        """
        Initialize Integration Manager
        
        Args:
            custom_credentials: Optional dict with custom credentials for integrations
                {
                    'jira': {'url': '...', 'email': '...', 'token': '...'},
                    'azure_devops': {'org': '...', 'pat': '...', 'project': '...'}
                }
        """
        self.integrations: Dict[str, TicketIntegration] = {}
        self.custom_credentials = custom_credentials or {}
    
    def get_integration(self, integration_type: str) -> Optional[TicketIntegration]:
        """
        Get or create an integration instance
        
        Args:
            integration_type: 'jira' or 'azure_devops'
        
        Returns:
            TicketIntegration instance or None
        """
        integration_type = integration_type.lower()
        
        # Return cached instance if exists
        if integration_type in self.integrations:
            return self.integrations[integration_type]
        
        # Create new instance
        if integration_type == 'jira':
            # Use custom credentials if provided, otherwise fall back to environment
            jira_creds = self.custom_credentials.get('jira', {})
            integration = JiraIntegration(
                url=jira_creds.get('url'),
                email=jira_creds.get('email'),
                api_token=jira_creds.get('token')
            )
            if integration.connect():
                self.integrations['jira'] = integration
                return integration
        
        elif integration_type in ['azure_devops', 'ado', 'azure']:
            # Use custom credentials if provided, otherwise fall back to environment
            ado_creds = self.custom_credentials.get('azure_devops', {})
            integration = AzureDevOpsIntegration(
                organization_url=ado_creds.get('org'),
                personal_access_token=ado_creds.get('pat'),
                project=ado_creds.get('project')
            )
            if integration.connect():
                self.integrations['azure_devops'] = integration
                return integration
        
        return None
    
    def auto_detect_integration(self) -> Optional[TicketIntegration]:
        """
        Auto-detect which integration to use based on environment variables
        
        Returns:
            TicketIntegration instance or None
        """
        # Check for Jira credentials
        if all([os.getenv('JIRA_URL'), os.getenv('JIRA_EMAIL'), os.getenv('JIRA_API_TOKEN')]):
            return self.get_integration('jira')
        
        # Check for Azure DevOps credentials
        if all([os.getenv('AZURE_DEVOPS_ORG'), os.getenv('AZURE_DEVOPS_PAT')]):
            return self.get_integration('azure_devops')
        
        return None
    
    def is_configured(self, integration_type: str) -> bool:
        """
        Check if integration is configured (either via custom credentials or environment)
        
        Args:
            integration_type: 'jira' or 'azure_devops'
        
        Returns:
            True if credentials are configured
        """
        integration_type = integration_type.lower()
        
        if integration_type == 'jira':
            # Check custom credentials first
            jira_creds = self.custom_credentials.get('jira', {})
            if all([jira_creds.get('url'), jira_creds.get('email'), jira_creds.get('token')]):
                return True
            # Fall back to environment variables
            return all([
                os.getenv('JIRA_URL'),
                os.getenv('JIRA_EMAIL'),
                os.getenv('JIRA_API_TOKEN')
            ])
        
        elif integration_type in ['azure_devops', 'ado', 'azure']:
            # Check custom credentials first
            ado_creds = self.custom_credentials.get('azure_devops', {})
            if all([ado_creds.get('org'), ado_creds.get('pat')]):
                return True
            # Fall back to environment variables
            return all([
                os.getenv('AZURE_DEVOPS_ORG'),
                os.getenv('AZURE_DEVOPS_PAT')
            ])
        
        return False
