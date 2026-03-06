"""
Authentication Service
Handles user authentication, password hashing, and JWT token management
"""
import bcrypt
import jwt
import hashlib
import secrets
import string
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any
import os
from dotenv import load_dotenv
import logging

from database.auth_models import User, UserSession, PasswordResetToken, EmailVerificationToken
from database.connection import get_db_connection

load_dotenv()
logger = logging.getLogger(__name__)


class AuthService:
    """Authentication service for user management"""
    
    def __init__(self):
        self.db = get_db_connection()
        self.jwt_secret = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        self.jwt_algorithm = 'HS256'
        self.jwt_expiration_hours = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))
        self.email_pattern = re.compile(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')

    def _generate_public_user_id(self, session) -> str:
        """
        Generate a unique public-safe user identifier.
        Format: QC-XXXXXXXX (uppercase alphanumeric)
        """
        alphabet = string.ascii_uppercase + string.digits
        for _ in range(10):
            candidate = "QC-" + "".join(secrets.choice(alphabet) for _ in range(8))
            exists = session.query(User).filter(User.public_user_id == candidate).first()
            if not exists:
                return candidate
        raise RuntimeError("Failed to generate unique public user ID")
    
    def hash_password(self, password: str) -> str:
        """
        Hash a password using bcrypt
        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password string
        """
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, password_hash: str) -> bool:
        """
        Verify a password against its hash
        
        Args:
            password: Plain text password
            password_hash: Hashed password to compare against
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            return bcrypt.checkpw(
                password.encode('utf-8'),
                password_hash.encode('utf-8')
            )
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False
    
    def check_availability(self, email: Optional[str] = None, username: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if email and/or username are available
        
        Args:
            email: Email to check (optional)
            username: Username to check (optional)
            
        Returns:
            Dictionary with availability status for each field
        """
        try:
            with self.db.get_session() as session:
                result = {
                    'email_available': True,
                    'username_available': True
                }
                
                if email:
                    # Normalize email: trim and lowercase
                    normalized_email = email.strip().lower()
                    existing_email = session.query(User).filter(User.email == normalized_email).first()
                    result['email_available'] = existing_email is None
                
                if username:
                    # Trim username and remove spaces
                    normalized_username = username.strip()
                    existing_username = session.query(User).filter(User.username == normalized_username).first()
                    result['username_available'] = existing_username is None
                
                return result
        except Exception as e:
            logger.error(f"Error checking availability: {e}")
            return {
                'email_available': False,
                'username_available': False,
                'error': 'Failed to check availability'
            }

    def is_valid_email(self, email: str) -> bool:
        """Validate email format."""
        if not email:
            return False
        return bool(self.email_pattern.match(email.strip()))

    def validate_password_strength(self, password: str) -> Tuple[bool, Optional[str]]:
        """
        Validate password strength requirements.

        Rules:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        - No whitespace
        """
        if not password:
            return False, "Password is required"
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        if re.search(r'\s', password):
            return False, "Password must not contain spaces"
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter"
        if not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter"
        if not re.search(r'\d', password):
            return False, "Password must contain at least one digit"
        if not re.search(r'[^A-Za-z0-9]', password):
            return False, "Password must contain at least one special character"
        return True, None
    
    def create_user(
        self,
        email: str,
        username: str,
        password: str,
        full_name: Optional[str] = None
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Create a new user account
        
        Args:
            email: User email address
            username: Unique username
            password: Plain text password
            full_name: User's full name (optional)
            
        Returns:
            Tuple of (User object, error message)
            User object if successful, None otherwise
        """
        try:
            # Normalize inputs
            email = email.strip().lower()
            username = username.strip()
            if full_name:
                full_name = full_name.strip()
            
            with self.db.get_session() as session:
                # Check if email already exists
                existing_user = session.query(User).filter(
                    (User.email == email) | (User.username == username)
                ).first()
                
                if existing_user:
                    if existing_user.email == email:
                        return None, "Email already registered"
                    else:
                        return None, "Username already taken"
                
                # Create new user
                password_hash = self.hash_password(password)
                new_user = User(
                    public_user_id=self._generate_public_user_id(session),
                    email=email,
                    username=username,
                    password_hash=password_hash,
                    full_name=full_name,
                    is_active=True,
                    email_verified=False
                )
                
                session.add(new_user)
                session.flush()  # Get the user ID
                
                # Make object usable outside session by accessing all attributes
                user_id = new_user.id
                user_email = new_user.email
                user_username = new_user.username
                user_full_name = new_user.full_name
                user_is_active = new_user.is_active
                user_created_at = new_user.created_at
                
                # Detach from session so it can be used outside the context
                session.expunge(new_user)
                
                logger.info(f"User created successfully: {username} (ID: {user_id})")
                return new_user, None
                
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None, "Failed to create user. Please try again."
    
    def authenticate_user(
        self,
        username_or_email: str,
        password: str
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Authenticate a user with username/email and password
        
        Args:
            username_or_email: Username or email address
            password: Plain text password
            
        Returns:
            Tuple of (User object, error message)
        """
        try:
            # Normalize input (trim and lowercase for email comparison)
            username_or_email = username_or_email.strip().lower()
            
            with self.db.get_session() as session:
                # Find user by username or email
                user = session.query(User).filter(
                    (User.username == username_or_email) |
                    (User.email == username_or_email)
                ).first()
                
                if not user:
                    return None, "User with this username or email does not exist"
                
                if not user.is_active:
                    return None, "Account is disabled"

                if not user.email_verified:
                    return None, "Please verify your email before logging in"
                
                # Verify password
                if not self.verify_password(password, user.password_hash):
                    return None, "Invalid password"
                
                # Access attributes before session closes
                user_id = user.id
                user_username = user.username
                user_email = user.email
                
                # Detach from session
                session.expunge(user)
                
                logger.info(f"User authenticated: {user_username}")
                return user, None
                
        except Exception as e:
            logger.error(f"Error authenticating user: {e}")
            return None, "Authentication failed"
    
    def google_authenticate(
        self,
        access_token: str,
        username: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Authenticate (or create) a user via Google / Supabase OAuth.

        Flow:
          1. Verify the Supabase access_token with Supabase REST API.
          2. Look up user by oauth_sub (Supabase UUID) or email.
          3. If found  → return {'user': user_obj}.
          4. If new user and username is None → return {'needs_username': True, ...profile}.
          5. If new user and username is given → create user, return {'user': user_obj}.

        Returns a dict with either 'user' or 'needs_username' + profile keys,
        or 'error' on failure.
        """
        import requests as http_requests

        supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
        if not supabase_url:
            return {'error': 'Supabase URL not configured on the server'}

        # 1. Verify token and fetch profile from Supabase
        supabase_anon_key = os.getenv('SUPABASE_ANON_KEY', '')
        try:
            resp = http_requests.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": supabase_anon_key,
                },
                timeout=10
            )
            resp.raise_for_status()
            supabase_user = resp.json()
        except Exception as e:
            logger.error(f"Supabase token verification failed: {e}")
            return {'error': 'Invalid or expired Google session. Please try again.'}

        oauth_sub = supabase_user.get('id')          # Supabase UUID
        email = (supabase_user.get('email') or '').strip().lower()
        user_metadata = supabase_user.get('user_metadata') or {}
        full_name = (
            user_metadata.get('full_name')
            or user_metadata.get('name')
            or user_metadata.get('display_name')
            or ''
        ).strip()

        if not email or not oauth_sub:
            return {'error': 'Could not retrieve email from Google account'}

        # 2. Look up user
        try:
            with self.db.get_session() as session:
                user = session.query(User).filter(
                    (User.oauth_sub == oauth_sub) | (User.email == email)
                ).first()

                if user:
                    # Update oauth_sub if linked via email for the first time
                    if not user.oauth_sub:
                        user.oauth_sub = oauth_sub
                        user.oauth_provider = 'google'
                    if not user.email_verified:
                        user.email_verified = True
                    session.expunge(user)
                    return {'user': user}

            # 3. New user — need a username before creating
            if not username:
                return {
                    'needs_username': True,
                    'email': email,
                    'full_name': full_name,
                    'oauth_sub': oauth_sub,
                }

            # 4. Create the user
            username = username.strip()
            if not username:
                return {'error': 'Username is required'}

            with self.db.get_session() as session:
                existing = session.query(User).filter(
                    (User.email == email) | (User.username == username)
                ).first()
                if existing:
                    if existing.email == email:
                        return {'error': 'An account with this email already exists. Try logging in.'}
                    return {'error': 'Username already taken. Please choose another.'}

                new_user = User(
                    public_user_id=self._generate_public_user_id(session),
                    email=email,
                    username=username,
                    password_hash=None,
                    full_name=full_name or username,
                    is_active=True,
                    email_verified=True,
                    oauth_provider='google',
                    oauth_sub=oauth_sub,
                )
                session.add(new_user)
                session.flush()
                session.expunge(new_user)
                logger.info(f"Google OAuth user created: {username} ({email})")
                return {'user': new_user}

        except Exception as e:
            logger.error(f"google_authenticate DB error: {e}")
            return {'error': 'Authentication failed. Please try again.'}

    def generate_jwt_token(
        self,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> str:
        """
        Generate JWT token for authenticated user
        
        Args:
            user: User object
            ip_address: Client IP address
            user_agent: Client user agent string
            
        Returns:
            JWT token string
        """
        try:
            # Create token payload
            expiration = datetime.now(timezone.utc) + timedelta(hours=self.jwt_expiration_hours)
            payload = {
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'exp': expiration,
                'iat': datetime.now(timezone.utc)
            }
            
            # Generate token
            token = jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
            
            # Store session in database
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            with self.db.get_session() as session:
                user_session = UserSession(
                    user_id=user.id,
                    token_hash=token_hash,
                    expires_at=expiration,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                session.add(user_session)
            
            logger.info(f"JWT token generated for user: {user.username}")
            return token
            
        except Exception as e:
            logger.error(f"Error generating JWT token: {e}")
            raise
    
    def verify_jwt_token(self, token: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Verify and decode JWT token
        
        Args:
            token: JWT token string
            
        Returns:
            Tuple of (decoded payload, error message)
        """
        try:
            # Decode token
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            
            # Verify session exists and is not revoked
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            with self.db.get_session() as session:
                user_session = session.query(UserSession).filter(
                    UserSession.token_hash == token_hash,
                    UserSession.expires_at > datetime.now(timezone.utc)
                ).first()
                
                if not user_session:
                    return None, "Token has been revoked or expired"
            
            return payload, None
            
        except jwt.ExpiredSignatureError:
            return None, "Token has expired"
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None, "Invalid token"
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None, "Token verification failed"
    
    def revoke_token(self, token: str) -> bool:
        """
        Revoke a JWT token (logout)
        
        Args:
            token: JWT token to revoke
            
        Returns:
            True if successful, False otherwise
        """
        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            with self.db.get_session() as session:
                session.query(UserSession).filter(
                    UserSession.token_hash == token_hash
                ).delete()
                
            logger.info("Token revoked successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error revoking token: {e}")
            return False
    
    def revoke_all_user_tokens(self, user_id: int) -> bool:
        """
        Revoke all tokens for a user (logout from all devices)
        
        Args:
            user_id: User ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.db.get_session() as session:
                session.query(UserSession).filter(
                    UserSession.user_id == user_id
                ).delete()
                
            logger.info(f"All tokens revoked for user ID: {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error revoking user tokens: {e}")
            return False
    
    def request_password_reset(self, email: str, ip_address: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
        """
        Create a password reset token for a user by email
        
        Args:
            email: User's email address
            ip_address: Optional IP address of requester
            
        Returns:
            Tuple of (token, error_message). token is None if error occurred.
        """
        try:
            with self.db.get_session() as session:
                # Find user by email
                user = session.query(User).filter(
                    User.email == email,
                    User.is_active == True
                ).first()
                
                if not user:
                    # Don't reveal if email exists for security
                    logger.info(f"Password reset requested for non-existent email: {email}")
                    return None, None  # Return None/None to prevent email enumeration
                
                # Generate secure random token
                reset_token = secrets.token_urlsafe(32)
                
                # Token expires in 1 hour
                expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
                
                # Delete any existing unused tokens for this user
                session.query(PasswordResetToken).filter(
                    PasswordResetToken.user_id == user.id,
                    PasswordResetToken.used == False
                ).delete()
                
                # Create new reset token
                token_record = PasswordResetToken(
                    user_id=user.id,
                    token=reset_token,
                    expires_at=expires_at,
                    ip_address=ip_address
                )
                session.add(token_record)
                
                logger.info(f"Password reset token created for user: {user.email}")
                return reset_token, None
                
        except Exception as e:
            logger.error(f"Error creating password reset token: {e}")
            return None, "Failed to create password reset token"

    def create_email_verification_token(self, user_id: int, ip_address: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
        """
        Create a new email verification token for a user.

        Args:
            user_id: User ID
            ip_address: Optional requester IP

        Returns:
            Tuple of (token, error_message)
        """
        try:
            with self.db.get_session() as session:
                user = session.query(User).filter(User.id == user_id, User.is_active == True).first()
                if not user:
                    return None, "User not found"

                if user.email_verified:
                    return None, "Email already verified"

                verification_token = secrets.token_urlsafe(32)
                expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

                # Keep only one active verification token per user
                session.query(EmailVerificationToken).filter(
                    EmailVerificationToken.user_id == user.id,
                    EmailVerificationToken.used == False
                ).delete()

                token_record = EmailVerificationToken(
                    user_id=user.id,
                    token=verification_token,
                    expires_at=expires_at,
                    ip_address=ip_address
                )
                session.add(token_record)

                logger.info(f"Email verification token created for user: {user.email}")
                return verification_token, None
        except Exception as e:
            logger.error(f"Error creating email verification token: {e}")
            return None, "Failed to create email verification token"

    def verify_email_token(self, token: str) -> Tuple[bool, Optional[str]]:
        """
        Verify email token and mark user email as verified.

        Args:
            token: Verification token

        Returns:
            Tuple of (success, error_message)
        """
        try:
            with self.db.get_session() as session:
                token_record = session.query(EmailVerificationToken).filter(
                    EmailVerificationToken.token == token
                ).first()

                if not token_record:
                    return False, "Invalid verification token"

                # Idempotency: if token already used and user is already verified,
                # treat repeated clicks/calls as success.
                user = session.query(User).filter(User.id == token_record.user_id).first()
                if token_record.used:
                    if user and user.email_verified:
                        return True, None
                    return False, "Invalid or already used verification token"

                if token_record.expires_at < datetime.now(timezone.utc):
                    return False, "Verification token has expired"

                if not user:
                    return False, "User not found"

                user.email_verified = True
                user.email_verified_at = datetime.now(timezone.utc)
                token_record.used = True

                # Invalidate any remaining active tokens for this user
                session.query(EmailVerificationToken).filter(
                    EmailVerificationToken.user_id == user.id,
                    EmailVerificationToken.used == False
                ).update({'used': True})

                logger.info(f"Email verified successfully for user: {user.email}")
                return True, None
        except Exception as e:
            logger.error(f"Error verifying email token: {e}")
            return False, "Failed to verify email"

    def request_email_verification(self, email: str, ip_address: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
        """
        Create a verification token by email for unverified active users.

        Returns:
            Tuple of (token, error_message). Returns (None, None) for unknown emails
            to avoid revealing account existence.
        """
        try:
            normalized_email = email.strip().lower()
            with self.db.get_session() as session:
                user = session.query(User).filter(
                    User.email == normalized_email,
                    User.is_active == True
                ).first()

                if not user:
                    logger.info(f"Email verification requested for non-existent email: {normalized_email}")
                    return None, None

                if user.email_verified:
                    return None, "Email is already verified"

                verification_token = secrets.token_urlsafe(32)
                expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

                session.query(EmailVerificationToken).filter(
                    EmailVerificationToken.user_id == user.id,
                    EmailVerificationToken.used == False
                ).delete()

                token_record = EmailVerificationToken(
                    user_id=user.id,
                    token=verification_token,
                    expires_at=expires_at,
                    ip_address=ip_address
                )
                session.add(token_record)

                logger.info(f"Email verification re-issued for user: {user.email}")
                return verification_token, None
        except Exception as e:
            logger.error(f"Error requesting email verification: {e}")
            return None, "Failed to create email verification token"
    
    def verify_reset_token(self, token: str) -> Tuple[Optional[int], Optional[str]]:
        """
        Verify a password reset token and return user_id if valid
        
        Args:
            token: Reset token to verify
            
        Returns:
            Tuple of (user_id, error_message). user_id is None if invalid.
        """
        try:
            with self.db.get_session() as session:
                token_record = session.query(PasswordResetToken).filter(
                    PasswordResetToken.token == token,
                    PasswordResetToken.used == False
                ).first()
                
                if not token_record:
                    return None, "Invalid or already used reset token"
                
                # Check if token has expired
                if token_record.expires_at < datetime.now(timezone.utc):
                    return None, "Reset token has expired"
                
                return token_record.user_id, None
                
        except Exception as e:
            logger.error(f"Error verifying reset token: {e}")
            return None, "Failed to verify reset token"
    
    def reset_password(self, token: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """
        Reset a user's password using a valid reset token
        
        Args:
            token: Reset token
            new_password: New password to set
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Verify token first
            user_id, error = self.verify_reset_token(token)
            if error:
                return False, error
            
            with self.db.get_session() as session:
                # Get user
                user = session.query(User).filter(User.id == user_id).first()
                if not user:
                    return False, "User not found"
                
                # Hash new password
                new_password_hash = self.hash_password(new_password)
                
                # Update password
                user.password_hash = new_password_hash
                
                # Mark token as used
                token_record = session.query(PasswordResetToken).filter(
                    PasswordResetToken.token == token
                ).first()
                if token_record:
                    token_record.used = True
                
                # Revoke all existing sessions for security
                session.query(UserSession).filter(
                    UserSession.user_id == user.id
                ).delete()
                
                logger.info(f"Password reset successful for user: {user.email}")
                return True, None
                
        except Exception as e:
            logger.error(f"Error resetting password: {e}")
            return False, "Failed to reset password"
    
    def cleanup_expired_sessions(self) -> int:
        """
        Remove expired sessions from database
        
        Returns:
            Number of sessions removed
        """
        try:
            with self.db.get_session() as session:
                count = session.query(UserSession).filter(
                    UserSession.expires_at < datetime.now(timezone.utc)
                ).delete()
                
            logger.info(f"Cleaned up {count} expired sessions")
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {e}")
            return 0
    
    def cleanup_expired_reset_tokens(self) -> int:
        """
        Remove expired password reset tokens from database
        
        Returns:
            Number of tokens removed
        """
        try:
            with self.db.get_session() as session:
                count = session.query(PasswordResetToken).filter(
                    PasswordResetToken.expires_at < datetime.now(timezone.utc)
                ).delete()
                
            logger.info(f"Cleaned up {count} expired reset tokens")
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning up reset tokens: {e}")
            return 0

    def cleanup_expired_email_verification_tokens(self) -> int:
        """
        Remove expired email verification tokens from database.

        Returns:
            Number of tokens removed
        """
        try:
            with self.db.get_session() as session:
                count = session.query(EmailVerificationToken).filter(
                    EmailVerificationToken.expires_at < datetime.now(timezone.utc)
                ).delete()

            logger.info(f"Cleaned up {count} expired email verification tokens")
            return count
        except Exception as e:
            logger.error(f"Error cleaning up email verification tokens: {e}")
            return 0
    
    def get_username_by_email(self, email: str) -> Optional[str]:
        """
        Get username by email address
        
        Args:
            email: User's email address
            
        Returns:
            Username if found, None otherwise
        """
        try:
            normalized_email = email.strip().lower()
            with self.db.get_session() as session:
                user = session.query(User).filter(
                    User.email == normalized_email,
                    User.is_active == True
                ).first()
                
                return user.username if user else None
                
        except Exception as e:
            logger.error(f"Error getting username by email: {e}")
            return None

    def get_user_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user profile by ID.

        Args:
            user_id: User ID

        Returns:
            User profile dictionary or None if not found
        """
        try:
            with self.db.get_session() as session:
                user = session.query(User).filter(
                    User.id == user_id,
                    User.is_active == True
                ).first()

                if not user:
                    return None

                return {
                    'id': user.id,
                    'user_id': user.public_user_id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.full_name,
                    'avatar_url': user.avatar_url,
                }
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return None

    def update_user_name(self, user_id: int, full_name: str) -> Tuple[bool, Optional[str]]:
        """Update a user's full name."""
        full_name = full_name.strip()
        if not full_name or len(full_name) > 255:
            return False, "Full name must be between 1 and 255 characters"
        try:
            with self.db.get_session() as session:
                user = session.query(User).filter(User.id == user_id, User.is_active == True).first()
                if not user:
                    return False, "User not found"
                user.full_name = full_name
                session.commit()
                return True, None
        except Exception as e:
            logger.error(f"Error updating user name: {e}")
            return False, "Failed to update name"

    def update_user_username(self, user_id: int, username: str) -> Tuple[bool, Optional[str]]:
        """Update a user's username (must be unique, 3-100 chars, alphanumeric/underscores)."""
        import re
        username = username.strip()
        if not username or len(username) < 3 or len(username) > 100:
            return False, "Username must be between 3 and 100 characters"
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return False, "Username can only contain letters, numbers, and underscores"
        try:
            with self.db.get_session() as session:
                # Check uniqueness
                existing = session.query(User).filter(
                    User.username == username,
                    User.id != user_id
                ).first()
                if existing:
                    return False, "Username is already taken"
                user = session.query(User).filter(User.id == user_id, User.is_active == True).first()
                if not user:
                    return False, "User not found"
                user.username = username
                session.commit()
                return True, None
        except Exception as e:
            logger.error(f"Error updating username: {e}")
            return False, "Failed to update username"

    def update_user_avatar(self, user_id: int, avatar_data_url: str) -> Tuple[bool, Optional[str]]:
        """Store a base64 avatar data URL for the user."""
        # Sanity check: must be a data URL image
        if not avatar_data_url.startswith("data:image/"):
            return False, "Invalid image data"
        # Rough size cap: ~1 MB base64
        if len(avatar_data_url) > 1_400_000:
            return False, "Image is too large (max ~1 MB)"
        try:
            with self.db.get_session() as session:
                user = session.query(User).filter(User.id == user_id, User.is_active == True).first()
                if not user:
                    return False, "User not found"
                user.avatar_url = avatar_data_url
                session.commit()
                return True, None
        except Exception as e:
            logger.error(f"Error updating user avatar: {e}")
            return False, "Failed to save avatar"
