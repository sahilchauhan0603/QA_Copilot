"""
Flask API Server
Main API server with authentication and team management endpoints
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import logging
import os
from dotenv import load_dotenv

from database.connection import init_database
from auth.auth_service import AuthService
from auth.team_service import TeamService
from auth.workspace_service import WorkspaceService
from database.auth_models import TeamRole
from api.decorators import (
    token_required,
    team_member_required,
    team_admin_required,
    workspace_aware
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')

# Enable CORS
CORS(app, resources={
    r"/api/*": {
        "origins": os.getenv('CORS_ORIGINS', '*').split(','),
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize services
auth_service = AuthService()
team_service = TeamService()
workspace_service = WorkspaceService()


# ============================================
# HEALTH CHECK
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'QA Copilot API'
    }), 200


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'username', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Create user
        user, error = auth_service.create_user(
            email=data['email'],
            username=data['username'],
            password=data['password'],
            full_name=data.get('full_name')
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        # Initialize workspace context
        workspace_service.ensure_workspace_context(user.id)
        
        # Generate token
        token = auth_service.generate_jwt_token(
            user,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Username and password required'}), 400
        
        # Authenticate user
        user, error = auth_service.authenticate_user(
            username_or_email=data['username'],
            password=data['password']
        )
        
        if error:
            return jsonify({'error': error}), 401
        
        # Generate token
        token = auth_service.generate_jwt_token(
            user,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        # Get user workspaces
        workspaces = workspace_service.get_user_workspaces(user.id)
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name
            },
            'workspaces': workspaces
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500


@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    """User logout endpoint"""
    try:
        token = request.headers['Authorization'].split(' ')[1]
        auth_service.revoke_token(token)
        
        return jsonify({'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500


@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Get current user information"""
    try:
        # Get user workspaces
        workspaces = workspace_service.get_user_workspaces(current_user['user_id'])
        
        return jsonify({
            'user': current_user,
            'workspaces': workspaces
        }), 200
        
    except Exception as e:
        logger.error(f"Get user error: {e}")
        return jsonify({'error': 'Failed to get user information'}), 500


# ============================================
# WORKSPACE ENDPOINTS
# ============================================

@app.route('/api/workspaces', methods=['GET'])
@token_required
def get_workspaces(current_user):
    """Get all workspaces available to user"""
    try:
        workspaces = workspace_service.get_user_workspaces(current_user['user_id'])
        return jsonify(workspaces), 200
        
    except Exception as e:
        logger.error(f"Get workspaces error: {e}")
        return jsonify({'error': 'Failed to get workspaces'}), 500


@app.route('/api/workspaces/active', methods=['PUT'])
@token_required
def switch_workspace(current_user):
    """Switch active workspace"""
    try:
        data = request.get_json()
        team_id = data.get('team_id')  # None for personal workspace
        
        # Convert team_id to int if not None
        if team_id is not None:
            try:
                team_id = int(team_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid team_id'}), 400
        
        success, error = workspace_service.switch_workspace(
            current_user['user_id'],
            team_id
        )
        
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


# ============================================
# TEAM MANAGEMENT ENDPOINTS
# ============================================

@app.route('/api/teams', methods=['POST'])
@token_required
def create_team(current_user):
    """Create a new team"""
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
                'id': team.id,
                'name': team.name,
                'description': team.description,
                'created_at': team.created_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Create team error: {e}")
        return jsonify({'error': 'Failed to create team'}), 500


@app.route('/api/teams/<int:team_id>', methods=['GET', 'DELETE'])
@token_required
def team_operations(current_user, team_id):
    """Get or delete team details"""
    if request.method == 'GET':
        # Get team details - requires team membership
        if not team_service.is_team_member(current_user['user_id'], team_id):
            return jsonify({'error': 'Access denied: Not a team member'}), 403
        
        try:
            members = team_service.get_team_members(team_id)
            user_role = team_service.get_member_role(current_user['user_id'], team_id)
            
            return jsonify({
                'team_id': team_id,
                'members': members,
                'your_role': user_role.value if user_role else None
            }), 200
            
        except Exception as e:
            logger.error(f"Get team error: {e}")
            return jsonify({'error': 'Failed to get team details'}), 500
    
    elif request.method == 'DELETE':
        # Delete team - requires admin privileges
        if not team_service.is_team_admin(current_user['user_id'], team_id):
            return jsonify({'error': 'Access denied: Admin privileges required'}), 403
        
        try:
            success, error = team_service.delete_team(
                team_id=team_id,
                deleted_by_user_id=current_user['user_id']
            )
            
            if error:
                return jsonify({'error': error}), 400
            
            return jsonify({'message': 'Team deleted successfully'}), 200
            
        except Exception as e:
            logger.error(f"Delete team error: {e}")
            return jsonify({'error': 'Failed to delete team'}), 500


@app.route('/api/teams/<int:team_id>/members', methods=['POST'])
@token_required
@team_admin_required
def add_team_member(current_user, team_id):
    """Add a member to team (admin only)"""
    try:
        data = request.get_json()
        
        if 'user_id' not in data:
            return jsonify({'error': 'user_id is required'}), 400
        
        role_str = data.get('role', 'qa_member')
        try:
            role = TeamRole[role_str.upper()]
        except KeyError:
            return jsonify({'error': f'Invalid role: {role_str}'}), 400
        
        success, error = team_service.add_team_member(
            team_id=team_id,
            user_id=data['user_id'],
            role=role,
            added_by_user_id=current_user['user_id']
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Member added successfully'}), 201
        
    except Exception as e:
        logger.error(f"Add team member error: {e}")
        return jsonify({'error': 'Failed to add team member'}), 500


@app.route('/api/teams/<int:team_id>/members/<int:user_id>', methods=['DELETE'])
@token_required
@team_admin_required
def remove_team_member(current_user, team_id, user_id):
    """Remove a member from team (admin only)"""
    try:
        success, error = team_service.remove_team_member(
            team_id=team_id,
            user_id=user_id,
            removed_by_user_id=current_user['user_id']
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Member removed successfully'}), 200
        
    except Exception as e:
        logger.error(f"Remove team member error: {e}")
        return jsonify({'error': 'Failed to remove team member'}), 500


@app.route('/api/teams/<int:team_id>/members/<int:user_id>/role', methods=['PUT'])
@token_required
@team_admin_required
def update_member_role(current_user, team_id, user_id):
    """Update member role (admin only)"""
    try:
        data = request.get_json()
        
        if 'role' not in data:
            return jsonify({'error': 'role is required'}), 400
        
        try:
            new_role = TeamRole[data['role'].upper()]
        except KeyError:
            return jsonify({'error': f'Invalid role: {data["role"]}'}), 400
        
        success, error = team_service.update_member_role(
            team_id=team_id,
            user_id=user_id,
            new_role=new_role,
            updated_by_user_id=current_user['user_id']
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Role updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Update member role error: {e}")
        return jsonify({'error': 'Failed to update member role'}), 500


# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    # Initialize database
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        exit(1)
    
    # Run server
    port = int(os.getenv('API_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting API server on port {port}")
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
