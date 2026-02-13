"""
Flask API Server
Main API server with authentication and team management endpoints
"""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime
import logging
import os
from dotenv import load_dotenv
import traceback

from database.connection import init_database
from auth.auth_service import AuthService
from auth.team_service import TeamService
from auth.workspace_service import WorkspaceService
from auth.integration_service import IntegrationService
from database.auth_models import TeamRole
from database.db_manager import DatabaseManager
from agents.orchestrator import AgentOrchestrator
from agents.state import TicketInfo
from utils.excel_exporter import export_to_excel
from api.decorators import (
    token_required,
    team_member_required,
    team_admin_required,
    workspace_aware
)
import google.generativeai as genai

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

# Enable CORS with proper configuration
CORS(app, 
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=False,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization"]
)

# Initialize services
auth_service = AuthService()
team_service = TeamService()
workspace_service = WorkspaceService()
integration_service = IntegrationService()

# Initialize database manager
db_manager = DatabaseManager()

# Initialize agent orchestrator (lazy loading - only if API key is set)
orchestrator = None
def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        google_api_key = os.getenv('GOOGLE_API_KEY')
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY not set in environment variables")
        orchestrator = AgentOrchestrator(google_api_key)
    return orchestrator


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
# TEST GENERATION ENDPOINTS
# ============================================

@app.route('/api/test-generation/generate', methods=['POST'])
@token_required
def generate_tests(current_user):
    """Generate test cases from a ticket"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['ticket_id', 'title', 'description']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields: ticket_id, title, description'}), 400
        
        # Get workspace context
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        
        # Create ticket info
        ticket_info = TicketInfo(
            ticket_id=data['ticket_id'],
            title=data['title'],
            description=data['description'],
            acceptance_criteria=data.get('acceptance_criteria', []),
            ticket_type=data.get('ticket_type', 'story'),
            priority=data.get('priority', 'P2'),
            status=data.get('status', 'In Progress'),
            attachments=data.get('attachments', []),
            comments=data.get('comments', []),
            linked_tickets=data.get('linked_tickets', [])
        )
        
        # Initialize orchestrator and process ticket
        orch = get_orchestrator()
        
        # Process with progress tracking
        progress_updates = []
        def progress_callback(agent_name, state):
            progress_updates.append({
                'agent': agent_name,
                'status': 'completed',
                'timestamp': datetime.now().isoformat()
            })
        
        final_state = orch.process_ticket(ticket_info, progress_callback=progress_callback)
        
        # Export to Excel
        excel_path = None
        try:
            excel_path = export_to_excel(final_state)
        except Exception as excel_error:
            logger.warning(f"Failed to export to Excel: {excel_error}")
        
        # Save to database
        generation_id = db_manager.save_generation(
            state=final_state,
            user_id=user_id,
            team_id=team_id,
            excel_file_path=excel_path
        )
        
        # Get the saved generation
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        return jsonify({
            'message': 'Test cases generated successfully',
            'generation_id': generation_id,
            'total_test_cases': len(final_state.get('test_cases', [])),
            'coverage_gaps': len(final_state.get('coverage_gaps', [])),
            'excel_file': excel_path,
            'progress': progress_updates,
            'generation': generation_data
        }), 201
        
    except ValueError as ve:
        logger.error(f"Configuration error: {ve}")
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        logger.error(f"Test generation error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Test generation failed: {str(e)}'}), 500


@app.route('/api/test-generation/generations', methods=['GET'])
@token_required
def get_generations(current_user):
    """Get all test generations for the current workspace"""
    try:
        # Get workspace context
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        
        # Get query parameters
        limit = request.args.get('limit', 100, type=int)
        ticket_id = request.args.get('ticket_id')
        ticket_type = request.args.get('ticket_type')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # Search or get all
        if any([ticket_id, ticket_type, date_from, date_to]):
            generations = db_manager.search_generations(
                user_id=user_id,
                team_id=team_id,
                ticket_id=ticket_id,
                ticket_type=ticket_type,
                date_from=date_from,
                date_to=date_to
            )
        else:
            generations = db_manager.get_all_generations(
                user_id=user_id,
                team_id=team_id,
                limit=limit
            )
        
        return jsonify(generations), 200
        
    except Exception as e:
        logger.error(f"Get generations error: {e}")
        return jsonify({'error': 'Failed to get generations'}), 500


@app.route('/api/test-generation/generations/<generation_id>', methods=['GET'])
@token_required
def get_generation(current_user, generation_id):
    """Get a specific test generation with all details"""
    try:
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        # Verify workspace access
        generation = generation_data['generation']
        
        # Check if user has access to this generation
        if generation['user_id'] != current_user['user_id']:
            # If it's a team generation, check team membership
            if generation['team_id'] is not None:
                if not team_service.is_team_member(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify(generation_data), 200
        
    except Exception as e:
        logger.error(f"Get generation error: {e}")
        return jsonify({'error': 'Failed to get generation'}), 500


@app.route('/api/test-generation/generations/<generation_id>', methods=['DELETE'])
@token_required
def delete_generation(current_user, generation_id):
    """Delete a test generation"""
    try:
        # Get generation to check ownership
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        generation = generation_data['generation']
        
        # Check if user owns this generation or is team admin
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_admin(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied: Only the owner or team admin can delete'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403
        
        # Delete generation
        success = db_manager.delete_generation(generation_id)
        
        if success:
            return jsonify({'message': 'Generation deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete generation'}), 500
        
    except Exception as e:
        logger.error(f"Delete generation error: {e}")
        return jsonify({'error': 'Failed to delete generation'}), 500


@app.route('/api/test-generation/statistics', methods=['GET'])
@token_required
def get_test_statistics(current_user):
    """Get test generation statistics for the current workspace"""
    try:
        # Get workspace context
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        
        stats = db_manager.get_statistics(user_id=user_id, team_id=team_id)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Get statistics error: {e}")
        return jsonify({'error': 'Failed to get statistics'}), 500


@app.route('/api/test-generation/download/<generation_id>', methods=['GET'])
@token_required
def download_excel(current_user, generation_id):
    """Download Excel file for a generation"""
    try:
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        generation = generation_data['generation']
        
        # Verify workspace access
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403
        
        excel_path = generation.get('excel_file_path')
        if not excel_path or not os.path.exists(excel_path):
            return jsonify({'error': 'Excel file not found'}), 404
        
        return send_file(
            excel_path,
            as_attachment=True,
            download_name=f"test_cases_{generation_id}.xlsx",
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"Download Excel error: {e}")
        return jsonify({'error': 'Failed to download file'}), 500


# ============================================
# INTEGRATION ENDPOINTS
# ============================================

@app.route('/api/integrations/config', methods=['GET'])
@token_required
def get_integration_configs(current_user):
    """Get all integration configs for the current workspace"""
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        configs = integration_service.get_all_configs(
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        return jsonify({'integrations': configs}), 200

    except Exception as e:
        logger.error(f"Get integration configs error: {e}")
        return jsonify({'error': 'Failed to get integration configs'}), 500


@app.route('/api/integrations/config/<integration_type>', methods=['GET'])
@token_required
def get_integration_config(current_user, integration_type):
    """Get a specific integration config"""
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        config = integration_service.get_config(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        return jsonify(config), 200

    except Exception as e:
        logger.error(f"Get integration config error: {e}")
        return jsonify({'error': 'Failed to get integration config'}), 500


@app.route('/api/integrations/config', methods=['POST'])
@token_required
def save_integration_config(current_user):
    """Save integration config for the current workspace"""
    try:
        data = request.get_json()

        integration_type = data.get('integration_type')
        if not integration_type:
            return jsonify({'error': 'integration_type is required'}), 400

        credentials = data.get('credentials', {})
        config = data.get('config', {})

        if not credentials:
            return jsonify({'error': 'credentials are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        success, error = integration_service.save_config(
            integration_type=integration_type,
            credentials=credentials,
            config=config,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'message': f'{integration_type} configuration saved successfully'}), 200

    except Exception as e:
        logger.error(f"Save integration config error: {e}")
        return jsonify({'error': 'Failed to save integration config'}), 500


@app.route('/api/integrations/config/<integration_type>', methods=['DELETE'])
@token_required
def delete_integration_config(current_user, integration_type):
    """Delete integration config"""
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        success, error = integration_service.delete_config(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        if error:
            return jsonify({'error': error}), 400

        if not success:
            return jsonify({'error': 'Configuration not found'}), 404

        return jsonify({'message': 'Configuration deleted successfully'}), 200

    except Exception as e:
        logger.error(f"Delete integration config error: {e}")
        return jsonify({'error': 'Failed to delete integration config'}), 500


@app.route('/api/integrations/test-connection', methods=['POST'])
@token_required
def test_integration_connection(current_user):
    """Test integration connection without saving"""
    try:
        data = request.get_json()

        integration_type = data.get('integration_type')
        credentials = data.get('credentials', {})
        config = data.get('config', {})

        if not integration_type:
            return jsonify({'error': 'integration_type is required'}), 400

        success, message = integration_service.test_connection(
            integration_type=integration_type,
            credentials=credentials,
            config=config
        )

        return jsonify({
            'success': success,
            'message': message
        }), 200 if success else 400

    except Exception as e:
        logger.error(f"Test connection error: {e}")
        return jsonify({'error': f'Connection test failed: {str(e)}'}), 500


@app.route('/api/integrations/fetch-ticket', methods=['POST'])
@token_required
def fetch_integration_ticket(current_user):
    """Fetch a ticket from Jira or Azure DevOps"""
    try:
        data = request.get_json()

        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')

        if not integration_type or not ticket_id:
            return jsonify({'error': 'integration_type and ticket_id are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        ticket_data, error = integration_service.fetch_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'ticket': ticket_data}), 200

    except Exception as e:
        logger.error(f"Fetch ticket error: {e}")
        return jsonify({'error': f'Failed to fetch ticket: {str(e)}'}), 500


# ============================================
# AI DESCRIPTION GENERATION
# ============================================

@app.route('/api/test-generation/ai-describe', methods=['POST'])
@token_required
def ai_generate_description(current_user):
    """Generate description and acceptance criteria from a ticket title using AI"""
    try:
        data = request.get_json()

        title = data.get('title', '').strip()
        ticket_type = data.get('ticket_type', 'story')
        priority = data.get('priority', 'P2')

        if not title:
            return jsonify({'error': 'Title is required'}), 400

        google_api_key = os.getenv('GOOGLE_API_KEY')
        if not google_api_key:
            return jsonify({'error': 'AI service not configured'}), 500

        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel(os.getenv('LLM_MODEL', 'gemini-2.0-flash'))

        prompt = f"""You are a senior QA engineer and business analyst. Given the following ticket information, generate a detailed description and acceptance criteria.

Ticket Title: {title}
Ticket Type: {ticket_type}
Priority: {priority}

Generate:
1. A detailed description (2-4 paragraphs) explaining what this ticket involves, the business context, user impact, and technical considerations.
2. A list of 4-8 specific, testable acceptance criteria.

Respond in this exact JSON format:
{{
    "description": "The detailed description text here...",
    "acceptance_criteria": [
        "First acceptance criterion",
        "Second acceptance criterion",
        "Third acceptance criterion"
    ]
}}

Only return valid JSON, no markdown code blocks or extra text."""

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                response_mime_type="application/json"
            )
        )

        import json
        result = json.loads(response.text)

        return jsonify({
            'description': result.get('description', ''),
            'acceptance_criteria': result.get('acceptance_criteria', [])
        }), 200

    except json.JSONDecodeError:
        # Try to parse the response text manually
        try:
            text = response.text.strip()
            if text.startswith('```'):
                text = text.split('\n', 1)[1].rsplit('```', 1)[0].strip()
            result = json.loads(text)
            return jsonify({
                'description': result.get('description', ''),
                'acceptance_criteria': result.get('acceptance_criteria', [])
            }), 200
        except Exception:
            return jsonify({'error': 'Failed to parse AI response'}), 500

    except Exception as e:
        logger.error(f"AI description generation error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'AI generation failed: {str(e)}'}), 500


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
