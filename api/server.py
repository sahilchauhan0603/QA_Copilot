"""
Flask API Server
Main API server with authentication and team management endpoints
"""
import warnings
# Suppress deprecation warnings for stable operation
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=UserWarning, message='.*Pydantic.*')
warnings.filterwarnings('ignore', category=UserWarning, message='.*pydantic.*')

from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from datetime import datetime
import logging
import os
import time
import uuid as uuid_lib
import json
import threading
from dotenv import load_dotenv
import traceback

from database.connection import init_database
from auth.auth_service import AuthService
from auth.team_service import TeamService
from auth.workspace_service import WorkspaceService
from auth.integration_service import IntegrationService
from auth.test_management_service import TestManagementService
from database.auth_models import TeamRole
from database.db_manager import DatabaseManager
from agents.orchestrator import AgentOrchestrator
from agents.refine_agent import RefineAgent
from agents.state import TicketInfo
from utils.rate_limiter import get_rate_limiter
from utils.api_cache import get_api_cache
from utils.excel_exporter import export_to_excel_bytes, get_excel_filename
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
     expose_headers=["Content-Type", "Authorization", "Content-Disposition"]
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
# SSE PROGRESS TRACKING
# ============================================

# In-memory store for generation progress (keyed by generation_job_id)
_progress_store = {}
_progress_lock = threading.Lock()

# In-memory store for non-regenerate refinement jobs
_refine_job_store = {}
_refine_job_lock = threading.Lock()

AGENT_STEPS = [
    {"agent": "ticket_reader", "label": "Reading Ticket", "order": 1},
    {"agent": "context_builder", "label": "Building Context", "order": 2},
    {"agent": "test_strategy", "label": "Creating Test Strategy", "order": 3},
    {"agent": "test_generator", "label": "Generating Test Cases", "order": 4},
    {"agent": "coverage_auditor", "label": "Auditing Coverage", "order": 5},
]

def _update_progress(job_id: str, agent_name: str, status: str = "completed", detail: str = None):
    """Update progress for a generation job"""
    with _progress_lock:
        if job_id not in _progress_store:
            _progress_store[job_id] = {
                "status": "running",
                "steps": [],
                "current_agent": None,
                "error": None,
                "result": None,
                "cancelled": False,
            }
        store = _progress_store[job_id]
        
        if status == "started":
            store["current_agent"] = agent_name
        
        step_info = {
            "agent": agent_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
        }
        if detail:
            step_info["detail"] = detail
        
        store["steps"].append(step_info)


@app.route('/api/test-generation/progress/<job_id>', methods=['GET'])
def stream_progress(job_id):
    """SSE endpoint for streaming generation progress"""
    def generate():
        last_step_count = 0
        timeout = 300  # 5 minute timeout
        start = time.time()
        
        while time.time() - start < timeout:
            with _progress_lock:
                store = _progress_store.get(job_id)
            
            if not store:
                yield f"data: {json.dumps({'type': 'waiting', 'message': 'Initializing...'})}\n\n"
                time.sleep(0.5)
                continue
            
            # Send any new steps
            current_steps = store["steps"]
            if len(current_steps) > last_step_count:
                for step in current_steps[last_step_count:]:
                    # Calculate progress percentage
                    completed = len([s for s in current_steps if s["status"] == "completed"])
                    total = len(AGENT_STEPS)
                    progress_pct = int((completed / total) * 100)
                    
                    # Find label for this agent
                    label = step["agent"]
                    for a in AGENT_STEPS:
                        if a["agent"] == step["agent"]:
                            label = a["label"]
                            break
                    
                    yield f"data: {json.dumps({'type': 'step', 'agent': step['agent'], 'label': label, 'status': step['status'], 'progress': progress_pct, 'detail': step.get('detail')})}\n\n"
                
                last_step_count = len(current_steps)
            
            # Check if generation is cancelled
            if store.get("cancelled"):
                yield f"data: {json.dumps({'type': 'cancelled', 'message': 'Generation cancelled by user'})}\n\n"
                with _progress_lock:
                    _progress_store.pop(job_id, None)
                break
            
            # Check if generation is complete
            if store["status"] in ("completed", "error"):
                if store["status"] == "completed":
                    yield f"data: {json.dumps({'type': 'complete', 'progress': 100, 'result': store['result']})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'error', 'message': store['error']})}\n\n"
                
                # Clean up after sending final event
                with _progress_lock:
                    _progress_store.pop(job_id, None)
                break
            
            time.sleep(0.3)
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )


@app.route('/api/test-generation/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_generation(current_user, job_id):
    """Cancel an ongoing test generation job"""
    try:
        with _progress_lock:
            store = _progress_store.get(job_id)
            if not store:
                return jsonify({'error': 'Job not found or already completed'}), 404
            
            if store["status"] in ("completed", "error"):
                return jsonify({'error': 'Job already finished'}), 400
            
            # Mark as cancelled
            store["cancelled"] = True
            store["status"] = "cancelled"
            store["error"] = "Cancelled by user"
        
        return jsonify({'message': 'Generation cancelled successfully'}), 200
    
    except Exception as e:
        logger.error(f"Cancel generation error: {e}")
        return jsonify({'error': 'Failed to cancel generation'}), 500


class RefineJobCancelledError(Exception):
    """Raised when a refinement job is cancelled by the user."""


def start_refine_job(owner_user_id, target, *args, **kwargs):
    job_id = str(uuid_lib.uuid4())
    with _refine_job_lock:
        _refine_job_store[job_id] = {
            'status': 'running',
            'cancelled': False,
            'result': None,
            'error': None,
            'owner_user_id': owner_user_id,
        }

    def job_wrapper():
        try:
            result = target(job_id, *args, **kwargs)
            with _refine_job_lock:
                if _refine_job_store.get(job_id, {}).get('cancelled'):
                    return
                _refine_job_store[job_id]['result'] = result
                _refine_job_store[job_id]['status'] = 'completed'
        except RefineJobCancelledError:
            with _refine_job_lock:
                if job_id in _refine_job_store:
                    _refine_job_store[job_id]['cancelled'] = True
                    _refine_job_store[job_id]['status'] = 'cancelled'
                    _refine_job_store[job_id]['error'] = 'Cancelled by user'
        except Exception as e:
            with _refine_job_lock:
                if _refine_job_store.get(job_id, {}).get('cancelled'):
                    _refine_job_store[job_id]['status'] = 'cancelled'
                    _refine_job_store[job_id]['error'] = 'Cancelled by user'
                    return
                _refine_job_store[job_id]['error'] = str(e)
                _refine_job_store[job_id]['status'] = 'error'

    t = threading.Thread(target=job_wrapper, daemon=True)
    t.start()
    return job_id


def cancel_refine_job(job_id):
    with _refine_job_lock:
        if job_id in _refine_job_store:
            if _refine_job_store[job_id].get('status') in ('completed', 'error', 'cancelled'):
                return False
            _refine_job_store[job_id]['cancelled'] = True
            _refine_job_store[job_id]['status'] = 'cancelled'
            _refine_job_store[job_id]['error'] = 'Cancelled by user'
            return True
    return False


def is_refine_job_cancelled(job_id):
    with _refine_job_lock:
        return _refine_job_store.get(job_id, {}).get('cancelled', False)


def get_refine_job_status_payload(current_user_id, job_id):
    with _refine_job_lock:
        job = _refine_job_store.get(job_id)
        if not job:
            return {'error': 'Job not found'}, 404
        if job.get('owner_user_id') != current_user_id:
            return {'error': 'Access denied'}, 403
        return {
            'status': job['status'],
            'result': job.get('result'),
            'error': job.get('error'),
        }, 200


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

@app.route('/api/auth/check-availability', methods=['POST'])
def check_availability():
    """Check if email or username is available"""
    try:
        data = request.get_json()
        
        email = data.get('email')
        username = data.get('username')
        
        if not email and not username:
            return jsonify({'error': 'At least one field (email or username) is required'}), 400
        
        result = auth_service.check_availability(email=email, username=username)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error checking availability: {e}")
        return jsonify({'error': str(e)}), 500


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


@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset email"""
    try:
        data = request.get_json()
        
        if 'email' not in data:
            return jsonify({'error': 'Email is required'}), 400
        
        email = data['email'].strip()
        ip_address = request.remote_addr
        
        # Request password reset
        reset_token, error = auth_service.request_password_reset(email, ip_address)
        
        if error:
            return jsonify({'error': error}), 500
        
        # Send email only if user exists (reset_token will be None for non-existent emails)
        if reset_token:
            from utils.email_service import email_service
            
            # Get username for personalization
            username = auth_service.get_username_by_email(email)
            if not username:
                username = email.split('@')[0]  # Fallback to email prefix
            
            # Send reset email
            email_sent = email_service.send_password_reset_email(email, username, reset_token)
            
            if not email_sent:
                logger.error(f"Failed to send password reset email to {email}")
                # Don't fail the request - return success to prevent email enumeration
        
        # Always return success to prevent email enumeration
        return jsonify({
            'message': 'If an account with that email exists, a password reset link has been sent.'
        }), 200
        
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return jsonify({'error': 'Failed to process password reset request'}), 500


@app.route('/api/auth/verify-reset-token/<token>', methods=['GET'])
def verify_reset_token(token):
    """Verify if a reset token is valid"""
    try:
        user_id, error = auth_service.verify_reset_token(token)
        
        if error:
            return jsonify({'valid': False, 'error': error}), 400
        
        return jsonify({'valid': True}), 200
        
    except Exception as e:
        logger.error(f"Verify reset token error: {e}")
        return jsonify({'valid': False, 'error': 'Failed to verify token'}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password using valid token"""
    try:
        data = request.get_json()
        
        required_fields = ['token', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Token and password are required'}), 400
        
        token = data['token']
        new_password = data['password']
        
        # Validate password strength
        if len(new_password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
        # Reset password
        success, error = auth_service.reset_password(token, new_password)
        
        if not success:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Password has been reset successfully'}), 200
        
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return jsonify({'error': 'Failed to reset password'}), 500


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
    """Generate test cases from a ticket (returns job_id for SSE progress tracking)"""
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
        
        # Track the source of generation (custom input or integration)
        source_integration = data.get('integration_type')  # 'jira', 'azure_devops', or None
        
        # Create a job ID for progress tracking
        job_id = str(uuid_lib.uuid4())
        
        # Initialize progress store
        with _progress_lock:
            _progress_store[job_id] = {
                "status": "running",
                "steps": [],
                "current_agent": None,
                "error": None,
                "result": None,
                "cancelled": False,
            }
        
        def run_generation():
            """Run generation in background thread"""
            try:
                # Check if cancelled before starting
                with _progress_lock:
                    if _progress_store.get(job_id, {}).get("cancelled"):
                        raise Exception("Generation cancelled by user")
                
                orch = get_orchestrator()
                
                def progress_callback(agent_name, state):
                    # Check for cancellation
                    with _progress_lock:
                        if _progress_store.get(job_id, {}).get("cancelled"):
                            raise Exception("Generation cancelled by user")
                    # Mark previous agent as completed, current as started
                    _update_progress(job_id, agent_name, "completed",
                                     detail=f"Processed by {agent_name}")
                
                # Send initial "started" event for first agent
                _update_progress(job_id, "ticket_reader", "started", detail="Starting pipeline...")
                
                final_state = orch.process_ticket(ticket_info, progress_callback=progress_callback)
                
                # Inject source integration info into state for DB storage
                if source_integration:
                    final_state['source_integration'] = source_integration
                
                # Save to database
                generation_id = db_manager.save_generation(
                    state=final_state,
                    user_id=user_id,
                    team_id=team_id,
                    excel_file_path=None
                )
                
                # Get the saved generation
                generation_data = db_manager.get_generation_by_id(generation_id)
                
                with _progress_lock:
                    store = _progress_store.get(job_id)
                    if store:
                        store["status"] = "completed"
                        store["result"] = {
                            'message': 'Test cases generated successfully',
                            'generation_id': generation_id,
                            'total_test_cases': len(final_state.get('test_cases', [])),
                            'coverage_gaps': len(final_state.get('coverage_gaps', [])),
                            'generation': generation_data
                        }
                
            except Exception as e:
                logger.error(f"Test generation error: {e}")
                logger.error(traceback.format_exc())
                with _progress_lock:
                    store = _progress_store.get(job_id)
                    if store:
                        store["status"] = "error"
                        store["error"] = str(e)
        
        # Start generation in background thread
        thread = threading.Thread(target=run_generation, daemon=True)
        thread.start()
        
        return jsonify({
            'job_id': job_id,
            'message': 'Generation started. Use SSE endpoint to track progress.',
            'progress_url': f'/api/test-generation/progress/{job_id}'
        }), 202
        
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
        page = request.args.get('page', 1, type=int)
        if page < 1:
            page = 1
        if limit < 1:
            limit = 1
        if limit > 100:
            limit = 100
        offset = (page - 1) * limit
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
                date_to=date_to,
                limit=limit,
                offset=offset
            )
        else:
            generations = db_manager.get_all_generations(
                user_id=user_id,
                team_id=team_id,
                limit=limit,
                offset=offset
            )

        total = db_manager.count_generations(
            user_id=user_id,
            team_id=team_id,
            ticket_id=ticket_id,
            ticket_type=ticket_type,
            date_from=date_from,
            date_to=date_to
        )

        total_pages = max(1, (total + limit - 1) // limit)
        return jsonify({
            'generations': generations,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'total_pages': total_pages,
            }
        }), 200
        
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
    """Download Excel file for a generation (generated on-the-fly)"""
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
        
        # Reconstruct full state from database
        meta = generation.get('generation_metadata', {})
        state = {
            'ticket_info': {
                'ticket_id': generation['ticket_id'],
                'title': generation['ticket_title'],
                'ticket_type': generation['ticket_type'],
                'description': generation.get('ticket_description', ''),
                'acceptance_criteria': generation.get('ticket_acceptance_criteria', ''),
                'priority': meta.get('priority', 'N/A'),
                'status': meta.get('status', 'N/A'),
            },
            'test_cases': generation_data.get('test_cases', []),
            'coverage_gaps': generation_data.get('coverage_gaps', []),
            'qa_roadmap': generation_data.get('qa_roadmap', {}),
            'extracted_requirements': generation_data.get('extracted_requirements', []),
            'acceptance_criteria_gaps': generation_data.get('acceptance_criteria_gaps', []),
            'risk_areas': generation_data.get('risk_areas', []),
            'clarification_questions': generation_data.get('clarification_questions', []),
            'impacted_modules': generation_data.get('impacted_modules', []),
            'dependencies': generation_data.get('dependencies', []),
            'processing_time': meta.get('processing_time', 0),
        }
        
        # Generate Excel in-memory
        excel_buffer = export_to_excel_bytes(state)
        filename = get_excel_filename(state)
        
        response = send_file(
            excel_buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
        # Explicitly set Content-Disposition header to ensure it's properly formatted
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        logger.error(f"Download Excel error: {e}")
        return jsonify({'error': 'Failed to download file'}), 500


@app.route('/api/test-generation/refine', methods=['POST'])
@token_required
def refine_tests(current_user):
    """Refine existing test cases based on user feedback"""
    try:
        data = request.get_json()
        
        # Validate required fields
        generation_id = data.get('generation_id')
        refinement_type = data.get('refinement_type')
        
        if not generation_id or not refinement_type:
            return jsonify({'error': 'generation_id and refinement_type are required'}), 400
        
        # Validate refinement type
        valid_types = ['minimize', 'focus', 'edge_cases', 'coverage', 'simplify', 'regenerate']
        if refinement_type not in valid_types:
            return jsonify({'error': f'Invalid refinement_type. Must be one of: {", ".join(valid_types)}'}), 400
        
        # Get the original generation
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        generation = generation_data['generation']
        
        # Verify access
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403
        
        # If regenerate entire, run full pipeline again
        if refinement_type == 'regenerate':
            # Get original ticket info
            meta = generation.get('generation_metadata', {})
            ticket_info = TicketInfo(
                ticket_id=generation['ticket_id'],
                title=generation['ticket_title'],
                description=generation.get('ticket_description', ''),
                acceptance_criteria=generation.get('ticket_acceptance_criteria', ''),
                ticket_type=generation['ticket_type'],
                priority=meta.get('priority', 'P2'),
                status=meta.get('status', 'In Progress'),
                attachments=meta.get('attachments', []),
                comments=meta.get('comments', []),
                linked_tickets=meta.get('linked_tickets', [])
            )
            
            # Create job ID for SSE tracking
            job_id = str(uuid_lib.uuid4())
            
            with _progress_lock:
                _progress_store[job_id] = {
                    "status": "running",
                    "steps": [],
                    "current_agent": None,
                    "error": None,
                    "result": None,
                    "cancelled": False,
                }
            
            def run_regeneration():
                try:
                    # Check if cancelled before starting
                    with _progress_lock:
                        if _progress_store.get(job_id, {}).get("cancelled"):
                            raise Exception("Regeneration cancelled by user")
                    
                    orch = get_orchestrator()
                    
                    _update_progress(job_id, "ticket_reader", "started", detail="Regenerating...")
                    
                    final_state = orch.process_ticket(ticket_info)
                    
                    # Preserve source integration
                    if meta.get('source_integration'):
                        final_state['source_integration'] = meta['source_integration']
                    
                    # Add refinement metadata
                    if 'refinement' not in final_state:
                        final_state['refinement'] = {}
                    final_state['refinement']['is_refined'] = True
                    final_state['refinement']['original_generation_id'] = generation_id
                    final_state['refinement']['refinement_type'] = 'regenerate'
                    
                    # Save as new generation
                    new_generation_id = db_manager.save_generation(
                        state=final_state,
                        user_id=current_user['user_id'],
                        team_id=generation['team_id'],
                        excel_file_path=None
                    )
                    
                    new_generation_data = db_manager.get_generation_by_id(new_generation_id)
                    
                    with _progress_lock:
                        store = _progress_store.get(job_id)
                        if store:
                            store["status"] = "completed"
                            store["result"] = {
                                'message': 'Test cases regenerated successfully',
                                'generation_id': new_generation_id,
                                'total_test_cases': len(final_state.get('test_cases', [])),
                                'generation': new_generation_data
                            }
                    
                except Exception as e:
                    logger.error(f"Regeneration error: {e}")
                    logger.error(traceback.format_exc())
                    with _progress_lock:
                        store = _progress_store.get(job_id)
                        if store:
                            store["status"] = "error"
                            store["error"] = str(e)
            
            thread = threading.Thread(target=run_regeneration, daemon=True)
            thread.start()
            
            return jsonify({
                'job_id': job_id,
                'message': 'Regeneration started. Use SSE endpoint to track progress.',
                'progress_url': f'/api/test-generation/progress/{job_id}'
            }), 202
        
        # For all other refinement types, use RefineAgent
        else:
            # Reconstruct state from generation
            meta = generation.get('generation_metadata', {})
            state = {
                'ticket_info': {
                    'ticket_id': generation['ticket_id'],
                    'title': generation['ticket_title'],
                    'description': generation.get('ticket_description', ''),
                    'acceptance_criteria': generation.get('ticket_acceptance_criteria', ''),
                    'ticket_type': generation['ticket_type'],
                    'priority': meta.get('priority', 'P2'),
                },
                'test_cases': generation_data.get('test_cases', []),
                'coverage_gaps': generation_data.get('coverage_gaps', []),
                'qa_roadmap': generation_data.get('qa_roadmap', {}),
                'source_integration': meta.get('source_integration'),
            }
            
            # Get refinement context (e.g., focus_area)
            refinement_context = {}
            if refinement_type == 'focus':
                focus_area = data.get('focus_area', '')
                if not focus_area:
                    return jsonify({'error': 'focus_area is required for focus refinement'}), 400
                refinement_context['focus_area'] = focus_area
            
            # Validate AI config before starting async job
            google_api_key = os.getenv('GOOGLE_API_KEY')
            if not google_api_key:
                return jsonify({'error': 'AI service not configured'}), 500

            # Use async job for cancellable non-regenerate refinement
            def run_refinement_job(job_id):
                if is_refine_job_cancelled(job_id):
                    raise RefineJobCancelledError("Refinement cancelled by user")

                genai.configure(api_key=google_api_key)
                rate_limiter = get_rate_limiter(max_requests=15, time_window=60)
                api_cache = get_api_cache(ttl=3600)
                refine_agent = RefineAgent(genai, rate_limiter, api_cache)

                # Perform refinement
                logger.info(f"Refining generation {generation_id} with type: {refinement_type}")
                refined_state = refine_agent.refine(state, refinement_type, refinement_context)

                # If user cancelled while LLM call was running, stop before persisting
                if is_refine_job_cancelled(job_id):
                    raise RefineJobCancelledError("Refinement cancelled by user")

                # Preserve source integration from original generation
                if state.get('source_integration'):
                    refined_state['source_integration'] = state['source_integration']

                # Add refinement metadata
                if 'refinement' not in refined_state:
                    refined_state['refinement'] = {}
                refined_state['refinement']['is_refined'] = True
                refined_state['refinement']['original_generation_id'] = generation_id
                refined_state['refinement']['refinement_type'] = refinement_type

                # Save refined generation as new entry
                new_generation_id = db_manager.save_generation(
                    state=refined_state,
                    user_id=current_user['user_id'],
                    team_id=generation['team_id'],
                    excel_file_path=None
                )

                # Get the new generation data
                new_generation_data = db_manager.get_generation_by_id(new_generation_id)

                return {
                    'message': f'Test cases refined successfully ({refinement_type})',
                    'generation_id': new_generation_id,
                    'original_generation_id': generation_id,
                    'refinement_type': refinement_type,
                    'total_test_cases': len(refined_state.get('test_cases', [])),
                    'generation': new_generation_data
                }

            job_id = start_refine_job(current_user['user_id'], run_refinement_job)
            return jsonify({
                'job_id': job_id,
                'message': 'Refinement started'
            }), 202
        
    except ValueError as ve:
        logger.error(f"Configuration error: {ve}")
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        logger.error(f"Refinement error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Refinement failed: {str(e)}'}), 500


@app.route('/api/test-generation/refine/job-status/<job_id>', methods=['GET'])
@token_required
def refine_job_status(current_user, job_id):
    payload, status_code = get_refine_job_status_payload(current_user['user_id'], job_id)
    return jsonify(payload), status_code


@app.route('/api/test-generation/refine/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_refine_job_endpoint(current_user, job_id):
    payload, status_code = get_refine_job_status_payload(current_user['user_id'], job_id)
    if status_code != 200:
        return jsonify(payload), status_code
    if payload.get('status') in ('completed', 'error', 'cancelled'):
        return jsonify({'error': 'Job already finished'}), 400
    if cancel_refine_job(job_id):
        return jsonify({'message': 'Refinement job cancelled'}), 200
    return jsonify({'error': 'Job not found'}), 404


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

@app.route('/api/integrations/view-credentials/<integration_type>', methods=['POST'])
@token_required
def view_integration_credentials(current_user, integration_type):
    """View decrypted credentials after password verification"""
    try:
        data = request.get_json()
        password = data.get('password')

        if not password:
            return jsonify({'error': 'Password is required'}), 400

        user_id = current_user['user_id']

        # Verify user's password
        from database.connection import get_db_connection
        from database.auth_models import User
        
        db = get_db_connection()
        with db.get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404

            # Verify password
            if not auth_service.verify_password(password, user.password_hash):
                return jsonify({'error': 'Invalid password'}), 401

        # Password verified - get decrypted credentials
        team_id = workspace_service.get_active_workspace(user_id)
        credentials = integration_service.get_credentials(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        if not credentials:
            return jsonify({'error': 'Integration not configured'}), 404

        # Return only sensitive fields
        sensitive_data = {}
        if integration_type == 'jira':
            sensitive_data['api_token'] = credentials.get('api_token', '')
        elif integration_type == 'azure_devops':
            sensitive_data['personal_access_token'] = credentials.get('personal_access_token', '')

        return jsonify({'credentials': sensitive_data}), 200

    except Exception as e:
        logger.error(f"View credentials error: {e}")
        return jsonify({'error': 'Failed to view credentials'}), 500

@app.route('/api/integrations/test-connection', methods=['POST'])
@token_required
def test_integration_connection(current_user):
    """Test integration connection without saving"""
    try:
        data = request.get_json()

        integration_type = data.get('integration_type')
        credentials = data.get('credentials', {}) or {}
        config = data.get('config', {}) or {}

        if not integration_type:
            return jsonify({'error': 'integration_type is required'}), 400

        # If sensitive credentials are omitted on the client (masked UI for already
        # configured integrations), fall back to stored workspace credentials.
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        stored = integration_service.get_credentials(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        ) or {}

        if integration_type == 'jira':
            credentials = {
                'api_token': credentials.get('api_token') or stored.get('api_token')
            }
            config = {
                'url': config.get('url') or stored.get('url'),
                'email': config.get('email') or stored.get('email'),
            }
        elif integration_type in ('azure_devops', 'ado', 'azure'):
            credentials = {
                'personal_access_token': credentials.get('personal_access_token') or stored.get('personal_access_token')
            }
            config = {
                'organization_url': config.get('organization_url') or stored.get('organization_url'),
                'project': config.get('project') or stored.get('project'),
            }
        elif integration_type == 'testrail':
            credentials = {
                'api_key': credentials.get('api_key') or stored.get('api_key')
            }
            config = {
                'url': config.get('url') or stored.get('url'),
                'email': config.get('email') or stored.get('email'),
                'project_id': config.get('project_id') or stored.get('project_id'),
            }

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
# TICKET SYNC ENDPOINTS
# ============================================
@app.route('/api/integrations/sync/attach-excel', methods=['POST'])
@token_required
def sync_attach_excel(current_user):
    """Attach the generated Excel file to a Jira/Azure DevOps ticket"""
    try:
        data = request.get_json()

        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')
        generation_id = data.get('generation_id')

        if not all([integration_type, ticket_id, generation_id]):
            return jsonify({'error': 'integration_type, ticket_id, and generation_id are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        # Get generation data
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        generation = generation_data['generation']

        # Verify access
        if generation['user_id'] != user_id:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(user_id, generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

        # Generate Excel in-memory
        meta = generation.get('generation_metadata', {})
        state = {
            'ticket_info': {
                'ticket_id': generation['ticket_id'],
                'title': generation['ticket_title'],
                'ticket_type': generation['ticket_type'],
                'description': generation.get('ticket_description', ''),
                'acceptance_criteria': generation.get('ticket_acceptance_criteria', ''),
                'priority': meta.get('priority', 'N/A'),
                'status': meta.get('status', 'N/A'),
            },
            'test_cases': generation_data.get('test_cases', []),
            'coverage_gaps': generation_data.get('coverage_gaps', []),
            'qa_roadmap': generation_data.get('qa_roadmap', {}),
            'extracted_requirements': generation_data.get('extracted_requirements', []),
            'acceptance_criteria_gaps': generation_data.get('acceptance_criteria_gaps', []),
            'risk_areas': generation_data.get('risk_areas', []),
            'clarification_questions': generation_data.get('clarification_questions', []),
            'impacted_modules': generation_data.get('impacted_modules', []),
            'dependencies': generation_data.get('dependencies', []),
            'processing_time': meta.get('processing_time', 0),
        }

        excel_buffer = export_to_excel_bytes(state)
        filename = get_excel_filename(state)

        success, error = integration_service.attach_excel_to_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            excel_buffer=excel_buffer,
            filename=filename,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'message': f'Excel file attached to {ticket_id} successfully'}), 200

    except Exception as e:
        logger.error(f"Sync attach Excel error: {e}")
        return jsonify({'error': f'Failed to attach Excel: {str(e)}'}), 500


@app.route('/api/integrations/sync/add-comment', methods=['POST'])
@token_required
def sync_add_comment(current_user):
    """Add a test summary comment to a Jira/Azure DevOps ticket"""
    try:
        data = request.get_json()

        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')
        generation_id = data.get('generation_id')
        comment_text = data.get('comment')  # Optional custom comment

        if not all([integration_type, ticket_id, generation_id]):
            return jsonify({'error': 'integration_type, ticket_id, and generation_id are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        # Get generation data
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        generation = generation_data['generation']

        # Verify access
        if generation['user_id'] != user_id:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(user_id, generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

        # Build comment from generation data if not provided
        if not comment_text:
            test_cases = generation_data.get('test_cases', [])
            coverage_gaps = generation_data.get('coverage_gaps', [])
            risk_areas = generation_data.get('risk_areas', [])
            meta = generation.get('generation_metadata', {})

            # Priority breakdown
            priority_counts = {}
            for tc in test_cases:
                p = tc.get('priority', 'P2')
                priority_counts[p] = priority_counts.get(p, 0) + 1

            # Category breakdown
            category_counts = {}
            for tc in test_cases:
                c = tc.get('category', 'General')
                category_counts[c] = category_counts.get(c, 0) + 1

            if integration_type == 'jira':
                # Jira uses wiki markup
                comment_text = f"h3. \U0001f9ea Test Cases Generated by TicketToTest AI\n\n"
                comment_text += f"*Total Test Cases:* {len(test_cases)}\n"
                comment_text += f"*Coverage Gaps:* {len(coverage_gaps)}\n"
                comment_text += f"*Risk Areas:* {len(risk_areas)}\n\n"

                if priority_counts:
                    comment_text += "h4. Priority Distribution\n"
                    comment_text += "||Priority||Count||\n"
                    for p in sorted(priority_counts.keys()):
                        comment_text += f"|{p}|{priority_counts[p]}|\n"
                    comment_text += "\n"

                if category_counts:
                    comment_text += "h4. Test Categories\n"
                    comment_text += "||Category||Count||\n"
                    for c in sorted(category_counts.keys()):
                        comment_text += f"|{c}|{category_counts[c]}|\n"
                    comment_text += "\n"

                if test_cases:
                    comment_text += "h4. Test Case Summary\n"
                    comment_text += "||ID||Priority||Category||Title||\n"
                    for tc in test_cases[:20]:  # Limit to first 20
                        tc_id = tc.get('id', tc.get('title', '')[:8])
                        comment_text += f"|{tc_id}|{tc.get('priority', 'P2')}|{tc.get('category', '')}|{tc.get('title', '')}|\n"
                    if len(test_cases) > 20:
                        comment_text += f"\n_...and {len(test_cases) - 20} more test cases. See attached Excel for full details._\n"

                if coverage_gaps:
                    comment_text += "\nh4. Coverage Gaps\n"
                    for gap in coverage_gaps[:10]:
                        comment_text += f"* {gap}\n"

                if risk_areas:
                    comment_text += "\nh4. Risk Areas\n"
                    for risk in risk_areas[:10]:
                        comment_text += f"* (!)\u00a0{risk}\n"

                comment_text += f"\n----\n_Generated on {generation.get('timestamp', 'N/A')} by TicketToTest AI_"
            else:
                # Azure DevOps uses HTML
                comment_text = f"<h3>\U0001f9ea Test Cases Generated by TicketToTest AI</h3>"
                comment_text += f"<p><strong>Total Test Cases:</strong> {len(test_cases)}<br>"
                comment_text += f"<strong>Coverage Gaps:</strong> {len(coverage_gaps)}<br>"
                comment_text += f"<strong>Risk Areas:</strong> {len(risk_areas)}</p>"

                if priority_counts:
                    comment_text += "<h4>Priority Distribution</h4><table><tr><th>Priority</th><th>Count</th></tr>"
                    for p in sorted(priority_counts.keys()):
                        comment_text += f"<tr><td>{p}</td><td>{priority_counts[p]}</td></tr>"
                    comment_text += "</table>"

                if category_counts:
                    comment_text += "<h4>Test Categories</h4><table><tr><th>Category</th><th>Count</th></tr>"
                    for c in sorted(category_counts.keys()):
                        comment_text += f"<tr><td>{c}</td><td>{category_counts[c]}</td></tr>"
                    comment_text += "</table>"

                if test_cases:
                    comment_text += "<h4>Test Case Summary</h4><table><tr><th>ID</th><th>Priority</th><th>Category</th><th>Title</th></tr>"
                    for tc in test_cases[:20]:
                        tc_id = tc.get('id', tc.get('title', '')[:8])
                        comment_text += f"<tr><td>{tc_id}</td><td>{tc.get('priority', 'P2')}</td><td>{tc.get('category', '')}</td><td>{tc.get('title', '')}</td></tr>"
                    comment_text += "</table>"
                    if len(test_cases) > 20:
                        comment_text += f"<p><em>...and {len(test_cases) - 20} more test cases. See attached Excel for full details.</em></p>"

                if coverage_gaps:
                    comment_text += "<h4>Coverage Gaps</h4><ul>"
                    for gap in coverage_gaps[:10]:
                        comment_text += f"<li>{gap}</li>"
                    comment_text += "</ul>"

                if risk_areas:
                    comment_text += "<h4>Risk Areas</h4><ul>"
                    for risk in risk_areas[:10]:
                        comment_text += f"<li>\u26a0\ufe0f {risk}</li>"
                    comment_text += "</ul>"

                comment_text += f"<hr><p><em>Generated on {generation.get('timestamp', 'N/A')} by TicketToTest AI</em></p>"

        success, error = integration_service.post_comment_to_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            comment=comment_text,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'message': f'Comment added to {ticket_id} successfully'}), 200

    except Exception as e:
        logger.error(f"Sync add comment error: {e}")
        return jsonify({'error': f'Failed to add comment: {str(e)}'}), 500



# New: Async job-based sync_full
@app.route('/api/integrations/sync/full-sync', methods=['POST'])
@token_required
def sync_full_job(current_user):
    """Start a full sync job and return job_id"""
    data = request.get_json()
    integration_type = data.get('integration_type')
    ticket_id = data.get('ticket_id')
    generation_id = data.get('generation_id')
    if not all([integration_type, ticket_id, generation_id]):
        return jsonify({'error': 'integration_type, ticket_id, and generation_id are required'}), 400
    user_id = current_user['user_id']
    team_id = workspace_service.get_active_workspace(user_id)

    def sync_full_job_logic(job_id):
        results = {'attach_excel': False, 'add_comment': False, 'errors': []}
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')
        generation = generation_data['generation']
        # Verify access
        if generation['user_id'] != user_id:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(user_id, generation['team_id']):
                    raise Exception('Access denied')
            else:
                raise Exception('Access denied')
        # 1. Attach Excel
        meta = generation.get('generation_metadata', {})
        state = {
            'ticket_info': {
                'ticket_id': generation['ticket_id'],
                'title': generation['ticket_title'],
                'ticket_type': generation['ticket_type'],
                'description': generation.get('ticket_description', ''),
                'acceptance_criteria': generation.get('ticket_acceptance_criteria', ''),
                'priority': meta.get('priority', 'N/A'),
                'status': meta.get('status', 'N/A'),
            },
            'test_cases': generation_data.get('test_cases', []),
            'coverage_gaps': generation_data.get('coverage_gaps', []),
            'qa_roadmap': generation_data.get('qa_roadmap', {}),
            'extracted_requirements': generation_data.get('extracted_requirements', []),
            'acceptance_criteria_gaps': generation_data.get('acceptance_criteria_gaps', []),
            'risk_areas': generation_data.get('risk_areas', []),
            'clarification_questions': generation_data.get('clarification_questions', []),
            'impacted_modules': generation_data.get('impacted_modules', []),
            'dependencies': generation_data.get('dependencies', []),
            'processing_time': meta.get('processing_time', 0),
        }
        # Check for cancellation
        if is_sync_job_cancelled(job_id):
            raise Exception('Sync cancelled by user')
        excel_buffer = export_to_excel_bytes(state)
        filename = get_excel_filename(state)
        success, error = integration_service.attach_excel_to_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            excel_buffer=excel_buffer,
            filename=filename,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        results['attach_excel'] = success
        if error:
            results['errors'].append(f"Attach Excel: {error}")
        # Check for cancellation
        if is_sync_job_cancelled(job_id):
            raise Exception('Sync cancelled by user')
        # 2. Add comment
        test_cases = generation_data.get('test_cases', [])
        total = len(test_cases)
        gaps = len(generation_data.get('coverage_gaps', []))
        risks = len(generation_data.get('risk_areas', []))
        if integration_type == 'jira':
            comment = f"h3. \U0001f9ea TicketToTest AI - Test Generation Complete\n\n"
            comment += f"*{total}* test cases generated | *{gaps}* coverage gaps | *{risks}* risk areas\n\n"
            comment += f"_Full test case Excel report has been attached to this ticket._\n"
            comment += f"----\n_Generated on {generation.get('timestamp', 'N/A')}_"
        else:
            comment = f"<h3>\U0001f9ea TicketToTest AI - Test Generation Complete</h3>"
            comment += f"<p><strong>{total}</strong> test cases generated | <strong>{gaps}</strong> coverage gaps | <strong>{risks}</strong> risk areas</p>"
            comment += f"<p><em>Full test case Excel report has been attached to this ticket.</em></p>"
            comment += f"<hr><p><em>Generated on {generation.get('timestamp', 'N/A')}</em></p>"
        success2, error2 = integration_service.post_comment_to_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            comment=comment,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        results['add_comment'] = success2
        if error2:
            results['errors'].append(f"Add comment: {error2}")
        return results

    job_id = start_sync_job(sync_full_job_logic)
    return jsonify({'job_id': job_id}), 202


# ============================================
# TEST MANAGEMENT TOOL EXPORTS
# ============================================
@app.route('/api/test-management/export-xray', methods=['POST'])
@token_required
@workspace_aware
def export_to_xray(current_user, active_team_id, is_personal_workspace):
    """Export generated test cases to Xray for Jira"""
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        suite_name = data.get('suite_name')
        ticket_id = data.get('ticket_id')

        if not generation_id:
            return jsonify({'error': 'generation_id is required'}), 400

        # Get user and team IDs
        user_id = current_user['user_id']
        team_id = active_team_id

        # Get the generation with test cases
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        test_cases = generation_data.get('test_cases', [])
        
        # Export to Xray
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_xray(
            test_cases=test_cases,
            user_id=user_id,
            team_id=team_id,
            suite_name=suite_name,
            ticket_id=ticket_id
        )
        
        if export_result['success']:
            return jsonify({
                'message': 'Successfully exported to Xray',
                'result': export_result
            }), 200
        else:
            return jsonify({
                'error': export_result.get('error', 'Export to Xray failed'),
                'result': export_result
            }), 400

    except Exception as e:
        logger.error(f"Xray export error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export to Xray. Please try again.'}), 500


@app.route('/api/test-management/export-xray-job', methods=['POST'])
@token_required
@workspace_aware
def export_to_xray_job(current_user, active_team_id, is_personal_workspace):
    """Start an async Xray export job and return job_id"""
    data = request.get_json()
    generation_id = data.get('generation_id')
    suite_name = data.get('suite_name')
    ticket_id = data.get('ticket_id')

    if not generation_id:
        return jsonify({'error': 'generation_id is required'}), 400

    user_id = current_user['user_id']
    team_id = active_team_id

    def export_xray_job_logic(job_id):
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')

        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_xray(
            test_cases=test_cases,
            user_id=user_id,
            team_id=team_id,
            suite_name=suite_name,
            ticket_id=ticket_id
        )

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')

        if not export_result.get('success'):
            raise Exception(export_result.get('error', 'Export to Xray failed'))
        return export_result

    job_id = start_sync_job(export_xray_job_logic)
    return jsonify({'job_id': job_id}), 202


@app.route('/api/test-management/export-zephyr', methods=['POST'])
@token_required
@workspace_aware
def export_to_zephyr(current_user, active_team_id, is_personal_workspace):
    """Export generated test cases to Zephyr Scale"""
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        cycle_name = data.get('cycle_name')
        ticket_id = data.get('ticket_id')

        if not generation_id:
            return jsonify({'error': 'generation_id is required'}), 400

        # Get user and team IDs
        user_id = current_user['user_id']
        team_id = active_team_id

        # Get the generation with test cases
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        test_cases = generation_data.get('test_cases', [])
        
        # Export to Zephyr
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_zephyr(
            test_cases=test_cases,
            user_id=user_id,
            team_id=team_id,
            suite_name=cycle_name,
            ticket_id=ticket_id
        )
        
        if export_result['success']:
            return jsonify({
                'message': 'Successfully exported to Zephyr Scale',
                'result': export_result
            }), 200
        else:
            return jsonify({
                'error': export_result.get('error', 'Export to Zephyr Scale failed'),
                'result': export_result
            }), 400

    except Exception as e:
        logger.error(f"Zephyr export error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export to Zephyr Scale. Please try again.'}), 500


@app.route('/api/test-management/export-zephyr-job', methods=['POST'])
@token_required
@workspace_aware
def export_to_zephyr_job(current_user, active_team_id, is_personal_workspace):
    """Start an async Zephyr export job and return job_id"""
    data = request.get_json()
    generation_id = data.get('generation_id')
    cycle_name = data.get('cycle_name')
    ticket_id = data.get('ticket_id')

    if not generation_id:
        return jsonify({'error': 'generation_id is required'}), 400

    user_id = current_user['user_id']
    team_id = active_team_id

    def export_zephyr_job_logic(job_id):
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')

        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_zephyr(
            test_cases=test_cases,
            user_id=user_id,
            team_id=team_id,
            suite_name=cycle_name,
            ticket_id=ticket_id
        )

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')

        if not export_result.get('success'):
            raise Exception(export_result.get('error', 'Export to Zephyr Scale failed'))
        return export_result

    job_id = start_sync_job(export_zephyr_job_logic)
    return jsonify({'job_id': job_id}), 202


@app.route('/api/test-management/export-testrail', methods=['POST'])
@token_required
@workspace_aware
def export_to_testrail(current_user, active_team_id, is_personal_workspace):
    """Export generated test cases to TestRail"""
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        suite_name = data.get('suite_name')
        ticket_id = data.get('ticket_id')

        if not generation_id:
            return jsonify({'error': 'generation_id is required'}), 400

        if not suite_name:
            return jsonify({'error': 'suite_name is required for TestRail'}), 400

        # Get user and team IDs
        user_id = current_user['user_id']
        team_id = active_team_id

        # Get the generation with test cases
        generation_data = db_manager.get_generation_by_id(generation_id)
        
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404
        
        test_cases = generation_data.get('test_cases', [])
        
        # Export to TestRail
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_testrail(
            test_cases=test_cases,
            user_id=user_id,
            team_id=team_id,
            suite_name=suite_name,
            ticket_id=ticket_id
        )
        
        if export_result['success']:
            return jsonify({
                'message': 'Successfully exported to TestRail',
                'result': export_result
            }), 200
        else:
            return jsonify({
                'error': export_result.get('error', 'Export to TestRail failed'),
                'result': export_result
            }), 400

    except Exception as e:
        logger.error(f"TestRail export error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export to TestRail. Please try again.'}), 500


@app.route('/api/test-management/export-testrail-job', methods=['POST'])
@token_required
@workspace_aware
def export_to_testrail_job(current_user, active_team_id, is_personal_workspace):
    """Start an async TestRail export job and return job_id"""
    data = request.get_json()
    generation_id = data.get('generation_id')
    suite_name = data.get('suite_name')
    ticket_id = data.get('ticket_id')

    if not generation_id:
        return jsonify({'error': 'generation_id is required'}), 400

    if not suite_name:
        return jsonify({'error': 'suite_name is required for TestRail'}), 400

    user_id = current_user['user_id']
    team_id = active_team_id

    def export_testrail_job_logic(job_id):
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')

        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_testrail(
            test_cases=test_cases,
            user_id=user_id,
            team_id=team_id,
            suite_name=suite_name,
            ticket_id=ticket_id
        )

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')

        if not export_result.get('success'):
            raise Exception(export_result.get('error', 'Export to TestRail failed'))
        return export_result

    job_id = start_sync_job(export_testrail_job_logic)
    return jsonify({'job_id': job_id}), 202


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


def _get_sync_job_status_payload(job_id):
    with sync_job_lock:
        job = sync_job_store.get(job_id)
        if not job:
            return {'error': 'Job not found'}, 404
        return {
            'status': job['status'],
            'result': job.get('result'),
            'error': job.get('error'),
        }, 200

# Endpoint to poll sync/export job status
@app.route('/api/integrations/sync/job-status/<job_id>', methods=['GET'])
@token_required
def sync_job_status(current_user, job_id):
    payload, status_code = _get_sync_job_status_payload(job_id)
    return jsonify(payload), status_code

@app.route('/api/test-management/export/job-status/<job_id>', methods=['GET'])
@token_required
def export_job_status(current_user, job_id):
    """Alias endpoint for export job status polling"""
    payload, status_code = _get_sync_job_status_payload(job_id)
    return jsonify(payload), status_code

# ========== SYNC/EXPORT JOB MANAGEMENT ===========
sync_job_store = {}
sync_job_lock = threading.Lock()

import uuid as uuid_lib

class SyncJobCancelledError(Exception):
    """Raised when a sync/export job is cancelled by the user."""

def start_sync_job(target, *args, **kwargs):
    job_id = str(uuid_lib.uuid4())
    with sync_job_lock:
        sync_job_store[job_id] = {
            'status': 'running',
            'cancelled': False,
            'result': None,
            'error': None,
        }
    def job_wrapper():
        try:
            result = target(job_id, *args, **kwargs)
            with sync_job_lock:
                if sync_job_store.get(job_id, {}).get('cancelled'):
                    return
                sync_job_store[job_id]['result'] = result
                sync_job_store[job_id]['status'] = 'completed'
        except SyncJobCancelledError:
            with sync_job_lock:
                if job_id in sync_job_store:
                    sync_job_store[job_id]['cancelled'] = True
                    sync_job_store[job_id]['status'] = 'cancelled'
        except Exception as e:
            with sync_job_lock:
                if sync_job_store.get(job_id, {}).get('cancelled'):
                    sync_job_store[job_id]['status'] = 'cancelled'
                    sync_job_store[job_id]['error'] = 'Cancelled by user'
                    return
                sync_job_store[job_id]['error'] = str(e)
                sync_job_store[job_id]['status'] = 'error'
    t = threading.Thread(target=job_wrapper)
    t.start()
    return job_id

def cancel_sync_job(job_id):
    with sync_job_lock:
        if job_id in sync_job_store:
            sync_job_store[job_id]['cancelled'] = True
            sync_job_store[job_id]['status'] = 'cancelled'
            return True
    return False

def is_sync_job_cancelled(job_id):
    with sync_job_lock:
        return sync_job_store.get(job_id, {}).get('cancelled', False)

@app.route('/api/integrations/sync/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_sync_job_endpoint(current_user, job_id):
    if cancel_sync_job(job_id):
        return jsonify({'message': 'Sync/export job cancelled'}), 200
    return jsonify({'error': 'Job not found'}), 404

@app.route('/api/test-management/export/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_export_job_endpoint(current_user, job_id):
    """Alias endpoint for cancelling export jobs"""
    if cancel_sync_job(job_id):
        return jsonify({'message': 'Sync/export job cancelled'}), 200
    return jsonify({'error': 'Job not found'}), 404


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
    logger.info("Note: Using development server. For production, use: gunicorn -w 4 -b 0.0.0.0:5000 api.server:app")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
