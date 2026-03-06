"""
Team management & invitation routes — /api/teams/*, /api/invitations/*
"""
from flask import Blueprint, request, jsonify
import logging

from api.decorators import token_required, team_admin_required
from api.shared import team_service, workspace_service
from database.auth_models import TeamRole

logger = logging.getLogger(__name__)

teams_bp = Blueprint('teams', __name__, url_prefix='/api')


@teams_bp.route('/teams', methods=['POST'])
@token_required
def create_team(current_user):
    try:
        data = request.get_json()
        if 'name' not in data:
            return jsonify({'error': 'Team name is required'}), 400

        team, error = team_service.create_team(
            name=data['name'],
            created_by_user_id=current_user['user_id'],
            description=data.get('description')
        )
        if error:
            return jsonify({'error': error}), 400

        return jsonify({
            'message': 'Team created successfully',
            'team': {
                'id': team.id, 'name': team.name,
                'description': team.description,
                'created_at': team.created_at.isoformat()
            }
        }), 201
    except Exception as e:
        logger.error(f"Create team error: {e}")
        return jsonify({'error': 'Failed to create team'}), 500


@teams_bp.route('/teams/<int:team_id>', methods=['GET', 'PUT', 'DELETE'])
@token_required
def team_operations(current_user, team_id):
    if request.method == 'GET':
        if not team_service.is_team_member(current_user['user_id'], team_id):
            return jsonify({'error': 'Access denied: Not a team member'}), 403
        try:
            members = team_service.get_team_members(team_id)
            user_role = team_service.get_member_role(current_user['user_id'], team_id)
            stats = team_service.get_team_stats(team_id)
            return jsonify({
                'team_id': team_id, 'members': members,
                'your_role': user_role.value if user_role else None,
                'stats': stats,
            }), 200
        except Exception as e:
            logger.error(f"Get team error: {e}")
            return jsonify({'error': 'Failed to get team details'}), 500

    elif request.method == 'PUT':
        if not team_service.is_team_admin(current_user['user_id'], team_id):
            return jsonify({'error': 'Access denied: Admin privileges required'}), 403
        try:
            data = request.get_json() or {}
            name = data.get('name')
            description = data.get('description')
            if name is None and description is None:
                return jsonify({'error': 'No fields to update'}), 400
            success, error = team_service.update_team(
                team_id=team_id, updated_by_user_id=current_user['user_id'],
                name=name, description=description,
            )
            if error:
                return jsonify({'error': error}), 400
            return jsonify({'message': 'Team updated successfully'}), 200
        except Exception as e:
            logger.error(f"Update team error: {e}")
            return jsonify({'error': 'Failed to update team'}), 500

    elif request.method == 'DELETE':
        if not team_service.is_team_admin(current_user['user_id'], team_id):
            return jsonify({'error': 'Access denied: Admin privileges required'}), 403
        try:
            success, error = team_service.delete_team(
                team_id=team_id, deleted_by_user_id=current_user['user_id']
            )
            if error:
                return jsonify({'error': error}), 400
            return jsonify({'message': 'Team deleted successfully'}), 200
        except Exception as e:
            logger.error(f"Delete team error: {e}")
            return jsonify({'error': 'Failed to delete team'}), 500


@teams_bp.route('/teams/<int:team_id>/members', methods=['POST'])
@token_required
@team_admin_required
def add_team_member(current_user, team_id):
    try:
        data = request.get_json()
        public_user_id = data.get('public_user_id')
        raw_user_id = data.get('user_id')
        resolved_user_id = None

        if public_user_id:
            resolved_user_id = team_service.get_user_id_by_public_id(public_user_id)
            if not resolved_user_id:
                return jsonify({'error': 'User not found for the provided User ID'}), 404
        elif raw_user_id is not None:
            try:
                resolved_user_id = int(raw_user_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'user_id must be a valid integer'}), 400
        else:
            return jsonify({'error': 'public_user_id is required'}), 400

        role_str = data.get('role', 'qa_member')
        try:
            role = TeamRole[role_str.upper()]
        except KeyError:
            return jsonify({'error': f'Invalid role: {role_str}'}), 400

        success, error = team_service.add_team_member(
            team_id=team_id, user_id=resolved_user_id,
            role=role, added_by_user_id=current_user['user_id']
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'message': 'Member added successfully'}), 201
    except Exception as e:
        logger.error(f"Add team member error: {e}")
        return jsonify({'error': 'Failed to add team member'}), 500


@teams_bp.route('/teams/<int:team_id>/members/<int:user_id>', methods=['DELETE'])
@token_required
@team_admin_required
def remove_team_member(current_user, team_id, user_id):
    try:
        success, error = team_service.remove_team_member(
            team_id=team_id, user_id=user_id,
            removed_by_user_id=current_user['user_id']
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'message': 'Member removed successfully'}), 200
    except Exception as e:
        logger.error(f"Remove team member error: {e}")
        return jsonify({'error': 'Failed to remove team member'}), 500


@teams_bp.route('/teams/<int:team_id>/members/<int:user_id>/role', methods=['PUT'])
@token_required
@team_admin_required
def update_member_role(current_user, team_id, user_id):
    try:
        data = request.get_json()
        if 'role' not in data:
            return jsonify({'error': 'role is required'}), 400
        try:
            new_role = TeamRole[data['role'].upper()]
        except KeyError:
            return jsonify({'error': f'Invalid role: {data["role"]}'}), 400

        success, error = team_service.update_member_role(
            team_id=team_id, user_id=user_id,
            new_role=new_role, updated_by_user_id=current_user['user_id']
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'message': 'Role updated successfully'}), 200
    except Exception as e:
        logger.error(f"Update member role error: {e}")
        return jsonify({'error': 'Failed to update member role'}), 500


# ── Invitations ──────────────────────────────────────────────────────

@teams_bp.route('/teams/<int:team_id>/invitations', methods=['GET'])
@token_required
def get_team_invitations(current_user, team_id):
    invitations, error = team_service.get_team_pending_invitations(
        team_id=team_id, requested_by_user_id=current_user['user_id'],
    )
    if error:
        return jsonify({'error': error}), 403
    return jsonify({'invitations': invitations}), 200


@teams_bp.route('/invitations/send', methods=['POST'])
@token_required
def send_team_invitation(current_user):
    try:
        data = request.get_json() or {}
        team_id = data.get('team_id')
        identifier = (data.get('identifier') or '').strip()
        role_str = data.get('role', 'qa_member')

        if not team_id or not identifier:
            return jsonify({'error': 'team_id and identifier (email / username / user ID) are required'}), 400

        try:
            role = TeamRole[role_str.upper()]
        except KeyError:
            return jsonify({'error': f'Invalid role: {role_str}'}), 400

        target = team_service.resolve_user_by_identifier(identifier)
        if not target:
            return jsonify({'error': 'User not found. Please check the email, username, or user ID.'}), 404

        if target['id'] == current_user['user_id']:
            return jsonify({'error': 'You cannot invite yourself'}), 400

        invitation, error = team_service.create_invitation(
            team_id=team_id, invited_user_id=target['id'],
            invited_by_user_id=current_user['user_id'], role=role,
        )
        if error:
            return jsonify({'error': error}), 400

        try:
            from utils.email_service import email_service
            email_service.send_team_invitation_email(
                to_email=target['email'], to_username=target['username'],
                team_name=invitation['team_name'],
                invited_by=invitation['invited_by_username'], role=role_str,
            )
        except Exception as email_err:
            logger.warning(f"Invitation email failed (non-blocking): {email_err}")

        return jsonify({
            'message': f'Invitation sent to {target["username"]}',
            'invitation': invitation,
        }), 201
    except Exception as e:
        logger.error(f"Send invitation error: {e}")
        return jsonify({'error': 'Failed to send invitation'}), 500


@teams_bp.route('/invitations', methods=['GET'])
@token_required
def get_my_invitations(current_user):
    try:
        invitations = team_service.get_pending_invitations(current_user['user_id'])
        return jsonify({'invitations': invitations, 'count': len(invitations)}), 200
    except Exception as e:
        logger.error(f"Get invitations error: {e}")
        return jsonify({'error': 'Failed to fetch invitations'}), 500


@teams_bp.route('/invitations/<int:invitation_id>/respond', methods=['POST'])
@token_required
def respond_to_invitation(current_user, invitation_id):
    try:
        data = request.get_json() or {}
        action = (data.get('action') or '').lower()
        if action not in ('accept', 'reject'):
            return jsonify({'error': "action must be 'accept' or 'reject'"}), 400

        accept = action == 'accept'
        success, error = team_service.respond_to_invitation(
            invitation_id=invitation_id,
            user_id=current_user['user_id'], accept=accept,
        )
        if error:
            return jsonify({'error': error}), 400

        verb = 'accepted' if accept else 'rejected'
        return jsonify({'message': f'Invitation {verb} successfully'}), 200
    except Exception as e:
        logger.error(f"Respond to invitation error: {e}")
        return jsonify({'error': 'Failed to process invitation'}), 500
