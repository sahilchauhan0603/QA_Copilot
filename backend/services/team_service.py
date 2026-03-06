"""
Team Management Service
Handles team creation, member management, and permissions
"""
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import or_
import logging

from database.auth_models import User, Team, TeamMember, TeamRole, UserWorkspaceContext, TeamInvitation, InvitationStatus
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
            return None, "Failed to create team. Please try again."
    
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
            return False, "Failed to add team member. Please try again."

    def get_user_id_by_public_id(self, public_user_id: str) -> Optional[int]:
        """
        Resolve internal numeric user ID from public user ID.
        """
        try:
            normalized = (public_user_id or "").strip().upper()
            if not normalized:
                return None
            with self.db.get_session() as session:
                user = session.query(User).filter(User.public_user_id == normalized).first()
                return user.id if user else None
        except Exception as e:
            logger.error(f"Error resolving public user ID {public_user_id}: {e}")
            return None
    
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
            return False, "Failed to remove team member. Please try again."
    
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
            return False, "Failed to update member role. Please try again."
    
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
                    # Count members in this team
                    member_count = session.query(TeamMember).filter(
                        TeamMember.team_id == team.id
                    ).count()
                    teams.append({
                        'id': team.id,
                        'name': team.name,
                        'description': team.description,
                        'role': membership.role.value,
                        'joined_at': membership.joined_at.isoformat(),
                        'created_at': team.created_at.isoformat(),
                        'member_count': member_count
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
                        'public_user_id': user.public_user_id,
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
    
    def update_team(
        self,
        team_id: int,
        updated_by_user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Update team name and/or description.
        Only team admins can update team details.
        """
        try:
            with self.db.get_session() as session:
                if not self.is_team_admin(updated_by_user_id, team_id):
                    return False, "Only team admins can edit team details"

                team = session.query(Team).filter(Team.id == team_id).first()
                if not team:
                    return False, "Team not found"

                if name is not None:
                    name = name.strip()
                    if len(name) < 3 or len(name) > 100:
                        return False, "Team name must be 3–100 characters"
                    team.name = name

                if description is not None:
                    description = description.strip()
                    if len(description) > 500:
                        return False, "Description must be at most 500 characters"
                    team.description = description or None

                logger.info(f"Team {team_id} updated by user {updated_by_user_id}")
                return True, None

        except Exception as e:
            logger.error(f"Error updating team: {e}")
            return False, "Failed to update team. Please try again."

    def get_team_stats(self, team_id: int) -> Dict[str, Any]:
        """Return basic stats for a team (member count by role, created_at)."""
        try:
            with self.db.get_session() as session:
                team = session.query(Team).filter(Team.id == team_id).first()
                if not team:
                    return {}

                members = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id
                ).all()

                role_counts: Dict[str, int] = {}
                for m in members:
                    key = m.role.value
                    role_counts[key] = role_counts.get(key, 0) + 1

                return {
                    'member_count': len(members),
                    'role_counts': role_counts,
                    'created_at': team.created_at.isoformat() if team.created_at else None,
                }
        except Exception as e:
            logger.error(f"Error getting team stats: {e}")
            return {}

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
            return False, "Failed to delete team. Please try again."

    # ============================================
    # TEAM INVITATIONS
    # ============================================

    def create_invitation(
        self,
        team_id: int,
        invited_user_id: int,
        invited_by_user_id: int,
        role: TeamRole = TeamRole.QA_MEMBER,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Create a team invitation (pending). Does NOT add the user to the team.

        Returns (invitation_dict, error_string).
        """
        try:
            with self.db.get_session() as session:
                # Requester must be team admin
                if not self.is_team_admin(invited_by_user_id, team_id):
                    return None, "Only team admins can invite members"

                # Target user must exist
                user = session.query(User).filter(User.id == invited_user_id).first()
                if not user:
                    return None, "User not found"

                # Already a team member?
                existing_member = session.query(TeamMember).filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == invited_user_id,
                ).first()
                if existing_member:
                    return None, "User is already a team member"

                # Check for existing pending invitation
                existing_inv = session.query(TeamInvitation).filter(
                    TeamInvitation.team_id == team_id,
                    TeamInvitation.invited_user_id == invited_user_id,
                    TeamInvitation.status == InvitationStatus.PENDING,
                ).first()
                if existing_inv:
                    return None, "An invitation is already pending for this user"

                # Remove old rejected/expired row so the unique constraint allows re-invite
                session.query(TeamInvitation).filter(
                    TeamInvitation.team_id == team_id,
                    TeamInvitation.invited_user_id == invited_user_id,
                    TeamInvitation.status.in_([InvitationStatus.REJECTED, InvitationStatus.EXPIRED]),
                ).delete()

                invitation = TeamInvitation(
                    team_id=team_id,
                    invited_user_id=invited_user_id,
                    invited_by_user_id=invited_by_user_id,
                    role=role,
                    status=InvitationStatus.PENDING,
                )
                session.add(invitation)
                session.flush()

                team = session.query(Team).filter(Team.id == team_id).first()
                inviter = session.query(User).filter(User.id == invited_by_user_id).first()

                result = {
                    'id': invitation.id,
                    'team_id': team_id,
                    'team_name': team.name if team else '',
                    'invited_user_id': invited_user_id,
                    'invited_user_email': user.email,
                    'invited_user_username': user.username,
                    'invited_by_username': inviter.username if inviter else '',
                    'role': role.value,
                    'status': 'pending',
                }
                logger.info(f"Invitation created: user {invited_user_id} → team {team_id} by user {invited_by_user_id}")
                return result, None

        except Exception as e:
            logger.error(f"Error creating invitation: {e}")
            return None, "Failed to create invitation. Please try again."

    def get_team_pending_invitations(self, team_id: int, requested_by_user_id: int) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        """Get all pending invitations for a team (admin only)."""
        try:
            if not self.is_team_admin(requested_by_user_id, team_id):
                return None, "Only team admins can view pending invitations"

            with self.db.get_session() as session:
                invitations = (
                    session.query(TeamInvitation, User)
                    .join(User, TeamInvitation.invited_user_id == User.id)
                    .filter(
                        TeamInvitation.team_id == team_id,
                        TeamInvitation.status == InvitationStatus.PENDING,
                    )
                    .order_by(TeamInvitation.created_at.desc())
                    .all()
                )

                result = []
                for inv, user in invitations:
                    result.append({
                        'id': inv.id,
                        'invited_username': user.username,
                        'invited_full_name': user.full_name,
                        'invited_email': user.email,
                        'role': inv.role.value,
                        'sent_at': inv.created_at.isoformat(),
                    })
                return result, None

        except Exception as e:
            logger.error(f"Error fetching team pending invitations for team {team_id}: {e}")
            return None, "Failed to fetch invitations"

    def get_pending_invitations(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all pending invitations for a user (their inbox)."""
        try:
            with self.db.get_session() as session:
                invitations = (
                    session.query(TeamInvitation, Team, User)
                    .join(Team, TeamInvitation.team_id == Team.id)
                    .join(User, TeamInvitation.invited_by_user_id == User.id)
                    .filter(
                        TeamInvitation.invited_user_id == user_id,
                        TeamInvitation.status == InvitationStatus.PENDING,
                    )
                    .order_by(TeamInvitation.created_at.desc())
                    .all()
                )

                result = []
                for inv, team, inviter in invitations:
                    result.append({
                        'id': inv.id,
                        'team_id': team.id,
                        'team_name': team.name,
                        'team_description': team.description,
                        'invited_by_username': inviter.username,
                        'invited_by_full_name': inviter.full_name,
                        'role': inv.role.value,
                        'created_at': inv.created_at.isoformat(),
                    })
                return result

        except Exception as e:
            logger.error(f"Error fetching invitations for user {user_id}: {e}")
            return []

    def respond_to_invitation(
        self,
        invitation_id: int,
        user_id: int,
        accept: bool,
    ) -> Tuple[bool, Optional[str]]:
        """
        Accept or reject a team invitation.

        If accepted, the user is added to the team with the assigned role.
        """
        from datetime import datetime
        try:
            # Data needed for notification email (collected inside session)
            inviter_email = None
            inviter_username = None
            invitee_username = None
            invitee_email = None
            team_name = None

            with self.db.get_session() as session:
                invitation = session.query(TeamInvitation).filter(
                    TeamInvitation.id == invitation_id,
                    TeamInvitation.invited_user_id == user_id,
                    TeamInvitation.status == InvitationStatus.PENDING,
                ).first()

                if not invitation:
                    return False, "Invitation not found or already responded"

                # Collect notification data
                inviter = session.query(User).filter(User.id == invitation.invited_by_user_id).first()
                invitee = session.query(User).filter(User.id == user_id).first()
                team = session.query(Team).filter(Team.id == invitation.team_id).first()
                if inviter:
                    inviter_email = inviter.email
                    inviter_username = inviter.username
                if invitee:
                    invitee_username = invitee.username
                    invitee_email = invitee.email
                if team:
                    team_name = team.name

                if accept:
                    # Check not already a member (edge case)
                    existing = session.query(TeamMember).filter(
                        TeamMember.team_id == invitation.team_id,
                        TeamMember.user_id == user_id,
                    ).first()
                    if existing:
                        invitation.status = InvitationStatus.ACCEPTED
                        invitation.responded_at = datetime.utcnow()
                        return False, "You are already a member of this team"

                    # Add to team
                    member = TeamMember(
                        team_id=invitation.team_id,
                        user_id=user_id,
                        role=invitation.role,
                    )
                    session.add(member)
                    invitation.status = InvitationStatus.ACCEPTED
                    invitation.responded_at = datetime.utcnow()
                    logger.info(f"Invitation {invitation_id} accepted — user {user_id} joined team {invitation.team_id}")
                else:
                    invitation.status = InvitationStatus.REJECTED
                    invitation.responded_at = datetime.utcnow()
                    logger.info(f"Invitation {invitation_id} rejected by user {user_id}")

            # Send notification email to inviter (fire-and-forget)
            if inviter_email and invitee_username and team_name:
                try:
                    from utils.email_service import email_service
                    email_service.send_invitation_response_email(
                        to_email=inviter_email,
                        to_username=inviter_username or inviter_email,
                        invitee_username=invitee_username,
                        invitee_email=invitee_email or '',
                        team_name=team_name,
                        accepted=accept,
                    )
                except Exception as email_err:
                    logger.warning(f"Failed to send invitation response email: {email_err}")

            return True, None

        except Exception as e:
            logger.error(f"Error responding to invitation {invitation_id}: {e}")
            return False, "Failed to process invitation. Please try again."

    def resolve_user_by_identifier(self, identifier: str) -> Optional[Dict[str, Any]]:
        """
        Look up a user by email, username, or public_user_id.

        Returns a dict with id, email, username, public_user_id, full_name or None.
        """
        try:
            identifier = (identifier or '').strip()
            if not identifier:
                return None
            with self.db.get_session() as session:
                user = session.query(User).filter(
                    (User.email == identifier.lower()) |
                    (User.username == identifier.lower()) |
                    (User.public_user_id == identifier.upper())
                ).first()
                if not user:
                    return None
                return {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'public_user_id': user.public_user_id,
                    'full_name': user.full_name,
                }
        except Exception as e:
            logger.error(f"Error resolving user identifier '{identifier}': {e}")
            return None
