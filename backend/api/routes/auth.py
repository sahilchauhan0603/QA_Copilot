"""
Authentication routes — /api/auth/*
"""
from flask import Blueprint, request, jsonify
import logging

from api.decorators import token_required
from api.shared import auth_service, workspace_service

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api')


# ── Health & public ──────────────────────────────────────────────────

@auth_bp.route('/health', methods=['GET'])
def health_check():
    from datetime import datetime
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'QA Copilot API'
    }), 200


@auth_bp.route('/public/stats', methods=['GET'])
def public_stats():
    try:
        from database.connection import get_db_connection
        from database.auth_models import User, UserSession, Team
        from database.models import Generation
        from sqlalchemy import func, distinct
        from datetime import datetime, timedelta, timezone

        db = get_db_connection()
        now_utc = datetime.now(timezone.utc)
        thirty_days_ago = now_utc - timedelta(days=30)

        with db.get_session() as session:
            total_users = session.query(func.count(User.id)).scalar() or 0
            active_users_30d = session.query(
                func.count(distinct(UserSession.user_id))
            ).filter(UserSession.created_at >= thirty_days_ago).scalar() or 0
            total_teams = session.query(func.count(Team.id)).scalar() or 0
            total_generations = session.query(func.count(Generation.id)).scalar() or 0
            active_users_today = session.query(
                func.count(distinct(UserSession.user_id))
            ).filter(UserSession.expires_at > now_utc).scalar() or 0

        return jsonify({
            'total_users': total_users,
            'active_users_30d': active_users_30d,
            'total_teams': total_teams,
            'total_generations': total_generations,
            'active_users_today': active_users_today,
        }), 200

    except Exception as e:
        logger.error(f"Error fetching public stats: {e}")
        return jsonify({
            'total_users': 0, 'active_users_30d': 0, 'total_teams': 0,
            'total_generations': 0, 'active_users_today': 0,
        }), 200


# ── Auth endpoints ──────────────────────────────────────────────────

@auth_bp.route('/auth/check-availability', methods=['POST'])
def check_availability():
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


@auth_bp.route('/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        required_fields = ['email', 'username', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        if not auth_service.is_valid_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        password_ok, password_error = auth_service.validate_password_strength(data['password'])
        if not password_ok:
            return jsonify({'error': password_error}), 400

        user, error = auth_service.create_user(
            email=data['email'], username=data['username'],
            password=data['password'], full_name=data.get('full_name')
        )
        if error:
            return jsonify({'error': error}), 400

        workspace_service.ensure_workspace_context(user.id)

        verification_token, token_error = auth_service.create_email_verification_token(
            user.id, ip_address=request.remote_addr
        )
        if token_error:
            logger.error(f"Email verification token creation failed for user {user.id}: {token_error}")
            return jsonify({'error': 'Registration failed. Please try again.'}), 500

        from utils.email_service import email_service
        email_sent = email_service.send_email_verification_email(
            to_email=user.email, username=user.username, verification_token=verification_token
        )
        if not email_sent:
            logger.error(f"Failed to send verification email to {user.email}")
            return jsonify({'message': 'Account created, but verification email could not be sent. Please request a new verification email.', 'email_sent': False}), 201

        return jsonify({'message': 'Signup successful. Please verify your email before logging in.', 'email_sent': True}), 201
    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Username and password required'}), 400

        user, error = auth_service.authenticate_user(
            username_or_email=data['username'], password=data['password']
        )
        if error:
            return jsonify({'error': error}), 401

        token = auth_service.generate_jwt_token(
            user, ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        workspaces = workspace_service.get_user_workspaces(user.id)

        return jsonify({
            'message': 'Login successful', 'token': token,
            'user': {
                'id': user.id, 'user_id': user.public_user_id,
                'username': user.username, 'email': user.email,
                'full_name': user.full_name
            },
            'workspaces': workspaces
        }), 200
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500


@auth_bp.route('/auth/google', methods=['POST'])
def google_auth():
    try:
        data = request.get_json() or {}
        access_token = (data.get('access_token') or '').strip()
        username = (data.get('username') or '').strip() or None
        if not access_token:
            return jsonify({'error': 'access_token is required'}), 400

        result = auth_service.google_authenticate(access_token, username=username)
        if 'error' in result:
            return jsonify({'error': result['error']}), 400

        if result.get('needs_username'):
            return jsonify({
                'needs_username': True, 'email': result['email'],
                'full_name': result.get('full_name', ''), 'oauth_sub': result['oauth_sub'],
            }), 200

        user = result['user']
        token = auth_service.generate_jwt_token(
            user, ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        workspaces = workspace_service.get_user_workspaces(user.id)

        return jsonify({
            'message': 'Login successful', 'token': token,
            'user': {
                'id': user.id, 'user_id': user.public_user_id,
                'username': user.username, 'email': user.email,
                'full_name': user.full_name,
            },
            'workspaces': workspaces
        }), 200
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return jsonify({'error': 'Google sign-in failed'}), 500


@auth_bp.route('/auth/verify-email', methods=['GET'])
def verify_email():
    try:
        token = request.args.get('token', '').strip()
        if not token:
            return jsonify({'error': 'Verification token is required'}), 400
        success, error = auth_service.verify_email_token(token)
        if not success:
            return jsonify({'error': error}), 400
        return jsonify({'message': 'Email verified successfully. You can now log in.'}), 200
    except Exception as e:
        logger.error(f"Verify email error: {e}")
        return jsonify({'error': 'Failed to verify email'}), 500


@auth_bp.route('/auth/resend-verification', methods=['POST'])
def resend_verification():
    try:
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        token, error = auth_service.request_email_verification(email, ip_address=request.remote_addr)
        if error:
            if error == "Email is already verified":
                return jsonify({'message': 'Email is already verified. You can log in.'}), 200
            return jsonify({'error': error}), 500

        if token:
            from utils.email_service import email_service
            username = auth_service.get_username_by_email(email) or email.split('@')[0]
            sent = email_service.send_email_verification_email(email, username, token)
            if not sent:
                logger.error(f"Failed to resend verification email to {email}")

        return jsonify({'message': 'If an account with that email exists and is not verified, a verification link has been sent.'}), 200
    except Exception as e:
        logger.error(f"Resend verification error: {e}")
        return jsonify({'error': 'Failed to resend verification email'}), 500


@auth_bp.route('/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    try:
        token = request.headers['Authorization'].split(' ')[1]
        auth_service.revoke_token(token)
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500


@auth_bp.route('/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    try:
        user_profile = auth_service.get_user_profile(current_user['user_id'])
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        workspaces = workspace_service.get_user_workspaces(current_user['user_id'])
        return jsonify({'user': user_profile, 'workspaces': workspaces}), 200
    except Exception as e:
        logger.error(f"Get user error: {e}")
        return jsonify({'error': 'Failed to get user information'}), 500


@auth_bp.route('/auth/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    try:
        data = request.get_json() or {}
        full_name = data.get('full_name', '').strip() or None
        username = data.get('username', '').strip() or None
        if not full_name and not username:
            return jsonify({'error': 'At least one of full_name or username is required'}), 400
        if full_name:
            ok, err = auth_service.update_user_name(current_user['user_id'], full_name)
            if not ok:
                return jsonify({'error': err}), 400
        if username:
            ok, err = auth_service.update_user_username(current_user['user_id'], username)
            if not ok:
                return jsonify({'error': err}), 400
        profile = auth_service.get_user_profile(current_user['user_id'])
        return jsonify({'user': profile}), 200
    except Exception as e:
        logger.error(f"Update profile error: {e}")
        return jsonify({'error': 'Failed to update profile'}), 500


@auth_bp.route('/auth/avatar', methods=['POST'])
@token_required
def update_avatar(current_user):
    try:
        data = request.get_json()
        avatar_data_url = (data or {}).get('avatar_data_url', '').strip()
        if not avatar_data_url:
            return jsonify({'error': 'avatar_data_url is required'}), 400
        ok, err = auth_service.update_user_avatar(current_user['user_id'], avatar_data_url)
        if not ok:
            return jsonify({'error': err}), 400
        profile = auth_service.get_user_profile(current_user['user_id'])
        return jsonify({'user': profile}), 200
    except Exception as e:
        logger.error(f"Update avatar error: {e}")
        return jsonify({'error': 'Failed to save avatar'}), 500


@auth_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        if 'email' not in data:
            return jsonify({'error': 'Email is required'}), 400

        email = data['email'].strip()
        reset_token, error = auth_service.request_password_reset(email, request.remote_addr)
        if error:
            return jsonify({'error': error}), 500

        if reset_token:
            from utils.email_service import email_service
            username = auth_service.get_username_by_email(email)
            if not username:
                username = email.split('@')[0]
            email_sent = email_service.send_password_reset_email(email, username, reset_token)
            if not email_sent:
                logger.error(f"Failed to send password reset email to {email}")

        return jsonify({'message': 'If an account with that email exists, a password reset link has been sent.'}), 200
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return jsonify({'error': 'Failed to process password reset request'}), 500


@auth_bp.route('/auth/verify-reset-token/<token>', methods=['GET'])
def verify_reset_token(token):
    try:
        user_id, error = auth_service.verify_reset_token(token)
        if error:
            return jsonify({'valid': False, 'error': error}), 400
        return jsonify({'valid': True}), 200
    except Exception as e:
        logger.error(f"Verify reset token error: {e}")
        return jsonify({'valid': False, 'error': 'Failed to verify token'}), 500


@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        required_fields = ['token', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Token and password are required'}), 400

        password_ok, password_error = auth_service.validate_password_strength(data['password'])
        if not password_ok:
            return jsonify({'error': password_error}), 400

        success, error = auth_service.reset_password(data['token'], data['password'])
        if not success:
            return jsonify({'error': error}), 400
        return jsonify({'message': 'Password has been reset successfully'}), 200
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return jsonify({'error': 'Failed to reset password'}), 500
