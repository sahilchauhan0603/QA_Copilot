"""
Workspace routes — /api/workspaces/*
"""
from flask import Blueprint, request, jsonify
import logging

from api.decorators import token_required
from api.shared import workspace_service

logger = logging.getLogger(__name__)

workspaces_bp = Blueprint('workspaces', __name__, url_prefix='/api')


@workspaces_bp.route('/workspaces', methods=['GET'])
@token_required
def get_workspaces(current_user):
    try:
        workspaces = workspace_service.get_user_workspaces(current_user['user_id'])
        return jsonify(workspaces), 200
    except Exception as e:
        logger.error(f"Get workspaces error: {e}")
        return jsonify({'error': 'Failed to get workspaces'}), 500


@workspaces_bp.route('/workspaces/active', methods=['PUT'])
@token_required
def switch_workspace(current_user):
    try:
        data = request.get_json()
        team_id = data.get('team_id')

        if team_id is not None:
            try:
                team_id = int(team_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid team_id'}), 400

        success, error = workspace_service.switch_workspace(current_user['user_id'], team_id)
        if error:
            return jsonify({'error': error}), 400

        workspace_name = 'Personal Workspace' if team_id is None else f'Team {team_id}'
        return jsonify({
            'message': f'Switched to {workspace_name}',
            'active_team_id': team_id
        }), 200
    except Exception as e:
        logger.error(f"Switch workspace error: {e}")
        return jsonify({'error': 'Failed to switch workspace'}), 500
