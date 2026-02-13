"""
Authentication Service
Handles user authentication, password hashing, and JWT token management
"""
import bcrypt
import jwt
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any
import os
from dotenv import load_dotenv
import logging

from database.auth_models import User, UserSession
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
                    email=email,
                    username=username,
                    password_hash=password_hash,
                    full_name=full_name,
                    is_active=True
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
            return None, f"Failed to create user: {str(e)}"
    
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
            expiration = datetime.utcnow() + timedelta(hours=self.jwt_expiration_hours)
            payload = {
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'exp': expiration,
                'iat': datetime.utcnow()
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
                    UserSession.expires_at > datetime.utcnow()
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
    
    def cleanup_expired_sessions(self) -> int:
        """
        Remove expired sessions from database
        
        Returns:
            Number of sessions removed
        """
        try:
            with self.db.get_session() as session:
                count = session.query(UserSession).filter(
                    UserSession.expires_at < datetime.utcnow()
                ).delete()
                
            logger.info(f"Cleaned up {count} expired sessions")
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {e}")
            return 0
