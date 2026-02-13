"""
Team Management Service
Handles team creation, member management, and permissions
"""
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import or_
import logging

from database.auth_models import User, Team, TeamMember, TeamRole, UserWorkspaceContext
from database.connection import get_db_connection

logger = logging.getLogger(__name__)


class TeamService:
    """Team management service"""
    
    def __init__(self):
        self.db = get_db_connection()
    
    def create_team(
        self,
        name: str,
        created_by_user_id: int,
        description: Optional[str] = None
    ) -> Tuple[Optional[Team], Optional[str]]:
        """
        Create a new team
        
        Args:
            name: Team name
            created_by_user_id: ID of user creating the team
            description: Team description (optional)
            
        Returns:
            Tuple of (Team object, error message)
        """
        try:
            with self.db.get_session() as session:
                # Verify user exists
                user = session.query(User).filter(User.id == created_by_user_id).first()
                if not user:
                    return None, "User not found"
                
                # Create team
                new_team = Team(
                    name=name,
                    description=description,
                    created_by=created_by_user_id
                )
                session.add(new_team)
                session.flush()
                
                # Add creator as admin
                team_member = TeamMember(
                    team_id=new_team.id,
                    user_id=created_by_user_id,
                    role=TeamRole.ADMIN
                )
                session.add(team_member)
                
                # Access attributes before session closes
                team_id = new_team.id
                team_name = new_team.name
                team_description = new_team.description
                
                # Detach from session
                session.expunge(new_team)
                
                logger.info(f"Team created: {name} (ID: {team_id}) by user {created_by_user_id}")
                return new_team, None
                
        except Exception as e:
            logger.error(f"Error creating team: {e}")
            return None, f"Failed to create team: {str(e)}"
    
    def add_team_member(
        self,
        team_id: int,
        user_id: int,
        role: TeamRole,
        added_by_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Add a member to a team
        
        Args:
            team_id: Team ID
            user_id: User ID to add
            role: Role to assign
            added_by_user_id: ID of user adding the member (must be admin)
            
        Returns:
            Tuple of (success bool, error message)
        """
        try:
            with self.db.get_session() as session:
                # Verify requester is team admin
                if not self.is_team_admin(added_by_user_id, team_id):
                    return False, "Only team admins can add members"
                
                # Verify user exists
                user = session.query(User).filter(User.id == user_id).first()
                if not user:
                    return False, "User not found"
                
                # Check if already a member
                existing = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                ).first()
                
                if existing:
                    return False, "User is already a team member"
                
                # Add member
                team_member = TeamMember(
                    team_id=team_id,
                    user_id=user_id,
                    role=role
                )
                session.add(team_member)
                
                logger.info(f"User {user_id} added to team {team_id} with role {role.value}")
                return True, None
                
        except Exception as e:
            logger.error(f"Error adding team member: {e}")
            return False, f"Failed to add team member: {str(e)}"
    
    def remove_team_member(
        self,
        team_id: int,
        user_id: int,
        removed_by_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Remove a member from a team
        
        Args:
            team_id: Team ID
            user_id: User ID to remove
            removed_by_user_id: ID of user removing the member (must be admin)
            
        Returns:
            Tuple of (success bool, error message)
        """
        try:
            with self.db.get_session() as session:
                # Verify requester is team admin
                if not self.is_team_admin(removed_by_user_id, team_id):
                    return False, "Only team admins can remove members"
                
                # Cannot remove yourself if you're the last admin
                if user_id == removed_by_user_id:
                    admin_count = session.query(TeamMember).filter(
                        TeamMember.team_id == team_id,
                        TeamMember.role == TeamRole.ADMIN
                    ).count()
                    
                    if admin_count <= 1:
                        return False, "Cannot remove yourself as the last admin"
                
                # Remove member
                deleted = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                ).delete()
                
                if deleted == 0:
                    return False, "User is not a team member"
                
                logger.info(f"User {user_id} removed from team {team_id}")
                return True, None
                
        except Exception as e:
            logger.error(f"Error removing team member: {e}")
            return False, f"Failed to remove team member: {str(e)}"
    
    def update_member_role(
        self,
        team_id: int,
        user_id: int,
        new_role: TeamRole,
        updated_by_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Update a team member's role
        
        Args:
            team_id: Team ID
            user_id: User ID to update
            new_role: New role to assign
            updated_by_user_id: ID of user making the change (must be admin)
            
        Returns:
            Tuple of (success bool, error message)
        """
        try:
            with self.db.get_session() as session:
                # Verify requester is team admin
                if not self.is_team_admin(updated_by_user_id, team_id):
                    return False, "Only team admins can update member roles"
                
                # Get member
                member = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                ).first()
                
                if not member:
                    return False, "User is not a team member"
                
                # Cannot demote yourself if you're the last admin
                if user_id == updated_by_user_id and member.role == TeamRole.ADMIN:
                    admin_count = session.query(TeamMember).filter(
                        TeamMember.team_id == team_id,
                        TeamMember.role == TeamRole.ADMIN
                    ).count()
                    
                    if admin_count <= 1 and new_role != TeamRole.ADMIN:
                        return False, "Cannot demote yourself as the last admin"
                
                # Update role
                member.role = new_role
                
                logger.info(f"User {user_id} role updated to {new_role.value} in team {team_id}")
                return True, None
                
        except Exception as e:
            logger.error(f"Error updating member role: {e}")
            return False, f"Failed to update member role: {str(e)}"
    
    def get_user_teams(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all teams a user is a member of
        
        Args:
            user_id: User ID
            
        Returns:
            List of team dictionaries with role information
        """
        try:
            with self.db.get_session() as session:
                memberships = session.query(TeamMember, Team).join(
                    Team, TeamMember.team_id == Team.id
                ).filter(
                    TeamMember.user_id == user_id
                ).all()
                
                teams = []
                for membership, team in memberships:
                    teams.append({
                        'id': team.id,
                        'name': team.name,
                        'description': team.description,
                        'role': membership.role.value,
                        'joined_at': membership.joined_at.isoformat(),
                        'created_at': team.created_at.isoformat()
                    })
                
                return teams
                
        except Exception as e:
            logger.error(f"Error getting user teams: {e}")
            return []
    
    def get_team_members(self, team_id: int) -> List[Dict[str, Any]]:
        """
        Get all members of a team
        
        Args:
            team_id: Team ID
            
        Returns:
            List of member dictionaries
        """
        try:
            with self.db.get_session() as session:
                members = session.query(TeamMember, User).join(
                    User, TeamMember.user_id == User.id
                ).filter(
                    TeamMember.team_id == team_id
                ).all()
                
                result = []
                for membership, user in members:
                    result.append({
                        'user_id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'full_name': user.full_name,
                        'role': membership.role.value,
                        'joined_at': membership.joined_at.isoformat()
                    })
                
                return result
                
        except Exception as e:
            logger.error(f"Error getting team members: {e}")
            return []
    
    def is_team_member(self, user_id: int, team_id: int) -> bool:
        """Check if user is a member of a team"""
        try:
            with self.db.get_session() as session:
                member = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                ).first()
                return member is not None
        except Exception as e:
            logger.error(f"Error checking team membership: {e}")
            return False
    
    def is_team_admin(self, user_id: int, team_id: int) -> bool:
        """Check if user is an admin of a team"""
        try:
            with self.db.get_session() as session:
                member = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id,
                    TeamMember.role == TeamRole.ADMIN
                ).first()
                return member is not None
        except Exception as e:
            logger.error(f"Error checking team admin status: {e}")
            return False
    
    def get_member_role(self, user_id: int, team_id: int) -> Optional[TeamRole]:
        """Get user's role in a team"""
        try:
            with self.db.get_session() as session:
                member = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                ).first()
                return member.role if member else None
        except Exception as e:
            logger.error(f"Error getting member role: {e}")
            return None
    
    def delete_team(
        self,
        team_id: int,
        deleted_by_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete a team (only admins can delete)
        
        Args:
            team_id: Team ID to delete
            deleted_by_user_id: User ID requesting deletion
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            with self.db.get_session() as session:
                # Verify user is admin
                if not self.is_team_admin(deleted_by_user_id, team_id):
                    return False, "Only team admins can delete teams"
                
                # Get team for logging
                team = session.query(Team).filter(Team.id == team_id).first()
                if not team:
                    return False, "Team not found"
                
                team_name = team.name
                
                # Delete all team members first (cascade)
                session.query(TeamMember).filter(
                    TeamMember.team_id == team_id
                ).delete()
                
                # Delete the team
                session.delete(team)
                
                logger.info(f"Team deleted: {team_name} (ID: {team_id}) by user {deleted_by_user_id}")
                return True, None
                
        except Exception as e:
            logger.error(f"Error deleting team: {e}")
            return False, f"Failed to delete team: {str(e)}"
