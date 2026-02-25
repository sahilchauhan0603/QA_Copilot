"""
Integration Credentials Service
Manages integration credentials per user or team workspace
"""
import logging
import tempfile
import os
from database.connection import get_db_connection
from database.auth_models import IntegrationCredential, IntegrationType
from auth.encryption import EncryptionService

logger = logging.getLogger(__name__)


class IntegrationService:
    """Service for managing integration credentials (Jira, Azure DevOps)"""

    def __init__(self):
        self.db = get_db_connection()
        self.encryption = EncryptionService()

    def save_config(self, integration_type: str, credentials: dict, config: dict,
                    user_id: int = None, team_id: int = None) -> tuple:
        """
        Save or update integration config for a workspace.
        Either user_id (personal) or team_id (team) must be provided, not both.

        credentials: sensitive data (api_token, pat) — will be encrypted
        config: non-sensitive data (url, email, project) — stored as JSON
        """
        try:
            int_type = IntegrationType(integration_type)
        except ValueError:
            return None, f"Invalid integration type: {integration_type}"

        if not user_id and not team_id:
            return None, "Either user_id or team_id is required"

        try:
            with self.db.get_session() as session:
                # Find existing credential
                query = session.query(IntegrationCredential).filter(
                    IntegrationCredential.integration_type == int_type
                )
                if team_id:
                    query = query.filter(IntegrationCredential.team_id == team_id)
                else:
                    query = query.filter(
                        IntegrationCredential.user_id == user_id,
                        IntegrationCredential.team_id.is_(None)
                    )

                existing = query.first()
                merged_credentials = credentials or {}

                if existing:
                    # Preserve previously stored credential keys when callers
                    # update non-sensitive config only (e.g., project key).
                    try:
                        existing_creds = self.encryption.decrypt_dict(existing.encrypted_credentials) or {}
                    except Exception:
                        existing_creds = {}
                    merged_credentials = {**existing_creds, **merged_credentials}
                    existing.encrypted_credentials = self.encryption.encrypt_dict(merged_credentials)
                    existing.config = config
                    existing.is_active = True
                else:
                    encrypted = self.encryption.encrypt_dict(merged_credentials)
                    new_cred = IntegrationCredential(
                        user_id=user_id if not team_id else None,
                        team_id=team_id,
                        integration_type=int_type,
                        encrypted_credentials=encrypted,
                        config=config,
                        is_active=True
                    )
                    session.add(new_cred)

            return True, None

        except Exception as e:
            logger.error(f"Error saving integration config: {e}")
            return None, "Failed to retrieve integration configuration"

    def get_config(self, integration_type: str, user_id: int = None, team_id: int = None) -> dict:
        """
        Get integration config for a workspace.
        Returns config dict (without decrypted credentials) plus a 'configured' flag.
        """
        try:
            int_type = IntegrationType(integration_type)
        except ValueError:
            return {'configured': False, 'error': f'Invalid type: {integration_type}'}

        try:
            with self.db.get_session() as session:
                query = session.query(IntegrationCredential).filter(
                    IntegrationCredential.integration_type == int_type,
                    IntegrationCredential.is_active == True
                )
                if team_id:
                    query = query.filter(IntegrationCredential.team_id == team_id)
                else:
                    query = query.filter(
                        IntegrationCredential.user_id == user_id,
                        IntegrationCredential.team_id.is_(None)
                    )

                cred = query.first()
                if not cred:
                    return {'configured': False}

                return {
                    'configured': True,
                    'integration_type': integration_type,
                    'config': cred.config or {},
                    'updated_at': cred.updated_at.isoformat() if cred.updated_at else None
                }
        except Exception as e:
            logger.error(f"Error getting integration config: {e}")
            return {'configured': False, 'error': 'Failed to check integration setup'}

    def get_all_configs(self, user_id: int = None, team_id: int = None) -> list:
        """Get all integration configs for a workspace."""
        try:
            with self.db.get_session() as session:
                query = session.query(IntegrationCredential).filter(
                    IntegrationCredential.is_active == True
                )
                if team_id:
                    query = query.filter(IntegrationCredential.team_id == team_id)
                else:
                    query = query.filter(
                        IntegrationCredential.user_id == user_id,
                        IntegrationCredential.team_id.is_(None)
                    )

                creds = query.all()
                return [{
                    'integration_type': c.integration_type.value,
                    'configured': True,
                    'config': c.config or {},
                    'updated_at': c.updated_at.isoformat() if c.updated_at else None
                } for c in creds]
        except Exception as e:
            logger.error(f"Error getting all configs: {e}")
            return []

    def delete_config(self, integration_type: str, user_id: int = None, team_id: int = None) -> tuple:
        """Delete integration config."""
        try:
            int_type = IntegrationType(integration_type)
        except ValueError:
            return False, f"Invalid integration type: {integration_type}"

        try:
            with self.db.get_session() as session:
                query = session.query(IntegrationCredential).filter(
                    IntegrationCredential.integration_type == int_type
                )
                if team_id:
                    query = query.filter(IntegrationCredential.team_id == team_id)
                else:
                    query = query.filter(
                        IntegrationCredential.user_id == user_id,
                        IntegrationCredential.team_id.is_(None)
                    )

                deleted = query.delete()

            return deleted > 0, None
        except Exception as e:
            logger.error(f"Error deleting integration config: {e}")
            return False, "Failed to save integration configuration"

    def get_credentials(self, integration_type: str, user_id: int = None, team_id: int = None) -> dict:
        """
        Get decrypted credentials + config for use by the integration manager.
        Returns full credentials dict or None.
        """
        try:
            int_type = IntegrationType(integration_type)
        except ValueError:
            return None

        try:
            with self.db.get_session() as session:
                query = session.query(IntegrationCredential).filter(
                    IntegrationCredential.integration_type == int_type,
                    IntegrationCredential.is_active == True
                )
                if team_id:
                    query = query.filter(IntegrationCredential.team_id == team_id)
                else:
                    query = query.filter(
                        IntegrationCredential.user_id == user_id,
                        IntegrationCredential.team_id.is_(None)
                    )

                cred = query.first()
                if not cred:
                    return None

                decrypted = self.encryption.decrypt_dict(cred.encrypted_credentials)
                config = cred.config or {}
                return {**decrypted, **config}

        except Exception as e:
            logger.error(f"Error getting credentials: {e}")
            return None

    def test_connection(self, integration_type: str, credentials: dict, config: dict) -> tuple:
        """
        Test an integration connection without saving.
        Returns (success: bool, message: str).
        """
        try:
            if integration_type == 'jira':
                from integrations.jira_integration import JiraIntegration
                integration = JiraIntegration(
                    url=config.get('url'),
                    email=config.get('email'),
                    api_token=credentials.get('api_token')
                )
                connected = integration.connect()
                if connected:
                    return True, "Successfully connected to Jira"
                return False, "Failed to connect to Jira. Check your credentials."

            elif integration_type in ('azure_devops', 'ado', 'azure'):
                from integrations.azure_devops_integration import AzureDevOpsIntegration
                integration = AzureDevOpsIntegration(
                    organization_url=config.get('organization_url'),
                    personal_access_token=credentials.get('personal_access_token'),
                    project=config.get('project')
                )
                connected = integration.connect()
                if connected:
                    return True, "Successfully connected to Azure DevOps"
                return False, "Failed to connect to Azure DevOps. Check your credentials."

            elif integration_type == 'testrail':
                from integrations.testrail_integration import TestRailIntegration
                integration = TestRailIntegration(
                    url=config.get('url'),
                    email=config.get('email'),
                    api_key=credentials.get('api_key'),
                    project_id=int(config.get('project_id', 0)) if config.get('project_id') else None
                )
                connected = integration.connect()
                if connected:
                    return True, "Successfully connected to TestRail"
                return False, "Failed to connect to TestRail. Check your credentials."

            else:
                return False, f"Unknown integration type: {integration_type}"

        except Exception as e:
            logger.error(f"Connection test error: {e}")
            return False, "Connection test failed. Please check your credentials."

    def fetch_ticket(self, integration_type: str, ticket_id: str,
                     user_id: int = None, team_id: int = None) -> tuple:
        """
        Fetch a ticket from the configured integration.
        Returns (ticket_data: dict, error: str).
        """
        creds = self.get_credentials(integration_type, user_id=user_id, team_id=team_id)
        if not creds:
            return None, f"{integration_type.replace('_', ' ').title()} is not configured. Please set up your integration credentials first."

        try:
            if integration_type == 'jira':
                from integrations.jira_integration import JiraIntegration
                integration = JiraIntegration(
                    url=creds.get('url'),
                    email=creds.get('email'),
                    api_token=creds.get('api_token')
                )
            elif integration_type in ('azure_devops', 'ado', 'azure'):
                from integrations.azure_devops_integration import AzureDevOpsIntegration
                integration = AzureDevOpsIntegration(
                    organization_url=creds.get('organization_url'),
                    personal_access_token=creds.get('personal_access_token'),
                    project=creds.get('project')
                )
            else:
                return None, f"Unknown integration type: {integration_type}"

            if not integration.connect():
                return None, "Failed to connect. Please check your integration credentials."

            ticket = integration.fetch_ticket(ticket_id)
            if not ticket:
                return None, f"Ticket {ticket_id} not found"

            # Convert TicketInfo TypedDict to regular dict
            return dict(ticket), None

        except Exception as e:
            logger.error(f"Fetch ticket error: {e}")
            return None, f"Failed to fetch ticket: {str(e)}"

    def _create_integration(self, integration_type: str, creds: dict):
        """Create an integration instance from credentials."""
        if integration_type == 'jira':
            from integrations.jira_integration import JiraIntegration
            return JiraIntegration(
                url=creds.get('url'),
                email=creds.get('email'),
                api_token=creds.get('api_token')
            )
        elif integration_type in ('azure_devops', 'ado', 'azure'):
            from integrations.azure_devops_integration import AzureDevOpsIntegration
            return AzureDevOpsIntegration(
                organization_url=creds.get('organization_url'),
                personal_access_token=creds.get('personal_access_token'),
                project=creds.get('project')
            )
        return None

    def attach_excel_to_ticket(self, integration_type: str, ticket_id: str,
                               excel_buffer, filename: str,
                               user_id: int = None, team_id: int = None) -> tuple:
        """
        Attach an Excel file (BytesIO) to a ticket.
        Returns (success: bool, error: str or None).
        """
        creds = self.get_credentials(integration_type, user_id=user_id, team_id=team_id)
        if not creds:
            return False, f"{integration_type} is not configured."

        try:
            integration = self._create_integration(integration_type, creds)
            if not integration:
                return False, f"Unknown integration type: {integration_type}"

            if not integration.connect():
                return False, "Failed to connect. Check your credentials."

            # Write BytesIO to a temp file (integration APIs need file paths)
            tmp_dir = tempfile.mkdtemp()
            tmp_path = os.path.join(tmp_dir, filename)
            try:
                excel_buffer.seek(0)
                with open(tmp_path, 'wb') as f:
                    f.write(excel_buffer.read())

                success = integration.attach_file(ticket_id, tmp_path, filename)
                if success:
                    return True, None
                return False, "Failed to attach file to ticket."
            finally:
                # Cleanup temp file
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                if os.path.exists(tmp_dir):
                    os.rmdir(tmp_dir)

        except Exception as e:
            logger.error(f"Attach Excel error: {e}")
            return False, f"Failed to attach Excel: {str(e)}"

    def post_comment_to_ticket(self, integration_type: str, ticket_id: str,
                               comment: str,
                               user_id: int = None, team_id: int = None) -> tuple:
        """
        Post a comment to a ticket.
        Returns (success: bool, error: str or None).
        """
        creds = self.get_credentials(integration_type, user_id=user_id, team_id=team_id)
        if not creds:
            return False, f"{integration_type} is not configured."

        try:
            integration = self._create_integration(integration_type, creds)
            if not integration:
                return False, f"Unknown integration type: {integration_type}"

            if not integration.connect():
                return False, "Failed to connect. Check your credentials."

            success = integration.post_comment(ticket_id, comment)
            if success:
                return True, None
            return False, "Failed to post comment to ticket."

        except Exception as e:
            logger.error(f"Post comment error: {e}")
            return False, f"Failed to post comment: {str(e)}"
