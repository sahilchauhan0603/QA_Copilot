"""
Workspace Management Service
Handles user workspace context (personal vs team workspaces)
"""
from typing import List, Optional, Dict, Any, Tuple
import logging

from database.auth_models import User, Team, TeamMember, UserWorkspaceContext
from database.connection import get_db_connection
from auth.team_service import TeamService

logger = logging.getLogger(__name__)


class WorkspaceService:
    """Workspace management service"""
    
    def __init__(self):
        self.db = get_db_connection()
        self.team_service = TeamService()
    
    def get_user_workspaces(self, user_id: int) -> Dict[str, Any]:
        """
        Get all workspaces available to a user (personal + teams)
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with workspace information
        """
        try:
            with self.db.get_session() as session:
                user = session.query(User).filter(User.id == user_id).first()
                if not user:
                    return {'workspaces': [], 'active_workspace': None}
                
                # Get active workspace
                context = session.query(UserWorkspaceContext).filter(
                    UserWorkspaceContext.user_id == user_id
                ).first()
                
                active_workspace_id = context.active_team_id if context else None
                
                # Build workspaces list
                workspaces = [
                    {
                        'id': None,
                        'name': 'Personal Workspace',
                        'type': 'personal',
                        'description': 'Your private workspace'
                    }
                ]
                
                # Add team workspaces
                teams = self.team_service.get_user_teams(user_id)
                for team in teams:
                    workspaces.append({
                        'id': team['id'],
                        'name': team['name'],
                        'type': 'team',
                        'role': team['role'],
                        'description': team.get('description', ''),
                        'created_at': team.get('created_at'),
                        'joined_at': team.get('joined_at'),
                        'member_count': team.get('member_count', 0)
                    })
                
                return {
                    'workspaces': workspaces,
                    'active_workspace': active_workspace_id
                }
                
        except Exception as e:
            logger.error(f"Error getting user workspaces: {e}")
            return {'workspaces': [], 'active_workspace': None}
    
    def switch_workspace(
        self,
        user_id: int,
        team_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Switch user's active workspace
        
        Args:
            user_id: User ID
            team_id: Team ID to switch to (None for personal workspace)
            
        Returns:
            Tuple of (success bool, error message)
        """
        try:
            with self.db.get_session() as session:
                # Verify user exists
                user = session.query(User).filter(User.id == user_id).first()
                if not user:
                    return False, "User not found"
                
                # If switching to team, verify membership
                if team_id is not None:
                    if not self.team_service.is_team_member(user_id, team_id):
                        return False, "You are not a member of this team"
                
                # Get or create workspace context
                context = session.query(UserWorkspaceContext).filter(
                    UserWorkspaceContext.user_id == user_id
                ).first()
                
                if context:
                    context.active_team_id = team_id
                else:
                    context = UserWorkspaceContext(
                        user_id=user_id,
                        active_team_id=team_id
                    )
                    session.add(context)
                
                workspace_name = 'Personal Workspace' if team_id is None else f'Team {team_id}'
                logger.info(f"User {user_id} switched to workspace: {workspace_name}")
                return True, None
                
        except Exception as e:
            logger.error(f"Error switching workspace: {e}")
            return False, "Failed to switch workspace. Please try again."
    
    def get_active_workspace(self, user_id: int) -> Optional[int]:
        """
        Get user's currently active workspace
        
        Args:
            user_id: User ID
            
        Returns:
            Team ID if team workspace is active, None for personal workspace
        """
        try:
            with self.db.get_session() as session:
                context = session.query(UserWorkspaceContext).filter(
                    UserWorkspaceContext.user_id == user_id
                ).first()
                
                return context.active_team_id if context else None
                
        except Exception as e:
            logger.error(f"Error getting active workspace: {e}")
            return None
    
    def ensure_workspace_context(self, user_id: int):
        """
        Ensure workspace context exists for user (create if missing)
        
        Args:
            user_id: User ID
        """
        try:
            with self.db.get_session() as session:
                context = session.query(UserWorkspaceContext).filter(
                    UserWorkspaceContext.user_id == user_id
                ).first()
                
                if not context:
                    context = UserWorkspaceContext(
                        user_id=user_id,
                        active_team_id=None  # Default to personal workspace
                    )
                    session.add(context)
                    logger.info(f"Workspace context created for user {user_id}")
                    
        except Exception as e:
            logger.error(f"Error ensuring workspace context: {e}")
