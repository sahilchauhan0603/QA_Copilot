"""
Permission Decorators
Role-based access control decorators for API endpoints
"""
from functools import wraps
from flask import request, jsonify
from typing import Callable, List, Optional
import logging

from auth.auth_service import AuthService
from auth.team_service import TeamService
from database.auth_models import TeamRole

logger = logging.getLogger(__name__)


def token_required(f: Callable) -> Callable:
    """
    Decorator to require valid JWT token
    
    Adds 'current_user' to kwargs with user info from token
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Format: "Bearer <token>"
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        # Verify token
        auth_service = AuthService()
        payload, error = auth_service.verify_jwt_token(token)
        
        if error:
            return jsonify({'error': error}), 401
        
        # Add user info to kwargs
        kwargs['current_user'] = payload
        return f(*args, **kwargs)
    
    return decorated


def team_member_required(f: Callable) -> Callable:
    """
    Decorator to require user to be a team member
    
    Expects 'team_id' in request (JSON body, query params, or route params)
    Must be used after @token_required
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'current_user' not in kwargs:
            return jsonify({'error': 'Authentication required'}), 401
        
        user_id = kwargs['current_user']['user_id']
        
        # Get team_id from various sources
        team_id = kwargs.get('team_id')
        
        if not team_id:
            json_data = request.get_json(silent=True)
            if json_data:
                team_id = json_data.get('team_id')
        
        if not team_id:
            team_id = request.args.get('team_id')
        
        if not team_id:
            return jsonify({'error': 'team_id is required'}), 400
        
        try:
            team_id = int(team_id)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid team_id'}), 400
        
        # Check membership
        team_service = TeamService()
        if not team_service.is_team_member(user_id, team_id):
            return jsonify({'error': 'Access denied: Not a team member'}), 403
        
        kwargs['team_id'] = team_id
        return f(*args, **kwargs)
    
    return decorated


def team_admin_required(f: Callable) -> Callable:
    """
    Decorator to require user to be a team admin
    
    Expects 'team_id' in request (JSON body, query params, or route params)
    Must be used after @token_required
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'current_user' not in kwargs:
            return jsonify({'error': 'Authentication required'}), 401
        
        user_id = kwargs['current_user']['user_id']
        
        # Get team_id from various sources
        team_id = kwargs.get('team_id')
        
        if not team_id:
            json_data = request.get_json(silent=True)
            if json_data:
                team_id = json_data.get('team_id')
        
        if not team_id:
            team_id = request.args.get('team_id')
        
        if not team_id:
            return jsonify({'error': 'team_id is required'}), 400
        
        try:
            team_id = int(team_id)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid team_id'}), 400
        
        # Check admin status
        team_service = TeamService()
        if not team_service.is_team_admin(user_id, team_id):
            return jsonify({'error': 'Access denied: Admin privileges required'}), 403
        
        kwargs['team_id'] = team_id
        return f(*args, **kwargs)
    
    return decorated


def role_required(required_roles: List[TeamRole]):
    """
    Decorator to require specific team role(s)
    
    Args:
        required_roles: List of allowed TeamRole values
        
    Must be used after @token_required
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'current_user' not in kwargs:
                return jsonify({'error': 'Authentication required'}), 401
            
            user_id = kwargs['current_user']['user_id']
            
            # Get team_id
            team_id = kwargs.get('team_id')
            
            if not team_id:
                json_data = request.get_json(silent=True)
                if json_data:
                    team_id = json_data.get('team_id')
            
            if not team_id:
                team_id = request.args.get('team_id')
            
            if not team_id:
                return jsonify({'error': 'team_id is required'}), 400
            
            try:
                team_id = int(team_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid team_id'}), 400
            
            # Get user's role
            team_service = TeamService()
            user_role = team_service.get_member_role(user_id, team_id)
            
            if not user_role or user_role not in required_roles:
                return jsonify({
                    'error': f'Access denied: Requires role {[r.value for r in required_roles]}'
                }), 403
            
            kwargs['team_id'] = team_id
            kwargs['user_role'] = user_role
            return f(*args, **kwargs)
        
        return decorated
    return decorator


def workspace_aware(f: Callable) -> Callable:
    """
    Decorator to add workspace context to request
    
    Adds 'active_team_id' to kwargs based on user's workspace context
    Must be used after @token_required
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'current_user' not in kwargs:
            return jsonify({'error': 'Authentication required'}), 401
        
        user_id = kwargs['current_user']['user_id']
        
        from auth.workspace_service import WorkspaceService
        workspace_service = WorkspaceService()
        active_team_id = workspace_service.get_active_workspace(user_id)
        
        kwargs['active_team_id'] = active_team_id
        kwargs['is_personal_workspace'] = active_team_id is None
        
        return f(*args, **kwargs)
    
    return decorated
