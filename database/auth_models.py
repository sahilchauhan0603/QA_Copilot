"""
Authentication and Team Management Database Models
SQLAlchemy ORM models for PostgreSQL
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, 
    ForeignKey, Enum, UniqueConstraint, CheckConstraint, Float, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()


class TeamRole(str, enum.Enum):
    """Team member roles"""
    ADMIN = "admin"
    QA_LEAD = "qa_lead"
    QA_MEMBER = "qa_member"


class IntegrationType(str, enum.Enum):
    """Integration platform types"""
    JIRA = "jira"
    AZURE_DEVOPS = "azure_devops"
    XRAY = "xray"
    ZEPHYR = "zephyr"
    TESTRAIL = "testrail"


class User(Base):
    """User account model"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    personal_integrations = relationship(
        "IntegrationCredential", 
        foreign_keys="IntegrationCredential.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    test_history = relationship("TestGenerationHistory", back_populates="user", cascade="all, delete-orphan")
    workspace_context = relationship("UserWorkspaceContext", back_populates="user", uselist=False, cascade="all, delete-orphan")
    created_teams = relationship("Team", back_populates="creator", foreign_keys="Team.created_by")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


class Team(Base):
    """Team/Organization model"""
    __tablename__ = 'teams'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="created_teams", foreign_keys=[created_by])
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    integrations = relationship("IntegrationCredential", back_populates="team", cascade="all, delete-orphan")
    test_history = relationship("TestGenerationHistory", back_populates="team", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Team(id={self.id}, name='{self.name}')>"


class TeamMember(Base):
    """Team membership with roles (many-to-many relationship)"""
    __tablename__ = 'team_members'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(Enum(TeamRole, name='team_role', native_enum=True, values_callable=lambda x: [e.value for e in x]), nullable=False, default=TeamRole.QA_MEMBER)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Unique constraint: user can only be in a team once
    __table_args__ = (
        UniqueConstraint('team_id', 'user_id', name='uq_team_user'),
    )
    
    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")
    
    def __repr__(self):
        return f"<TeamMember(team_id={self.team_id}, user_id={self.user_id}, role='{self.role.value}')>"


class UserSession(Base):
    """User session tracking for JWT tokens"""
    __tablename__ = 'user_sessions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, index=True)  # Hashed JWT for revocation
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"


class IntegrationCredential(Base):
    """Integration credentials (user-specific or team-specific)"""
    __tablename__ = 'integration_credentials'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id', ondelete='CASCADE'), nullable=True, index=True)
    integration_type = Column(Enum(IntegrationType, name='integration_type', native_enum=True, values_callable=lambda x: [e.value for e in x]), nullable=False)
    encrypted_credentials = Column(Text, nullable=False)  # Fernet encrypted JSON
    config = Column(JSON)  # Additional settings (server URL, project key, etc.)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Check constraint: must be either personal OR team
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL)',
            name='check_personal_or_team'
        ),
    )
    
    # Relationships
    user = relationship("User", back_populates="personal_integrations", foreign_keys=[user_id])
    team = relationship("Team", back_populates="integrations")
    
    def __repr__(self):
        owner = f"user_id={self.user_id}" if self.user_id else f"team_id={self.team_id}"
        return f"<IntegrationCredential(id={self.id}, {owner}, type='{self.integration_type.value}')>"


class TestGenerationHistory(Base):
    """Test generation history (user or team-specific)"""
    __tablename__ = 'test_generation_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey('teams.id', ondelete='SET NULL'), nullable=True, index=True)
    ticket_id = Column(String(100), nullable=False, index=True)
    ticket_source = Column(Enum(IntegrationType, name='integration_type', native_enum=True, values_callable=lambda x: [e.value for e in x]))
    roadmap = Column(JSON)  # QA Execution Roadmap
    test_cases = Column(JSON)  # Generated test cases
    coverage_report = Column(JSON)  # Coverage auditor output
    excel_file_path = Column(String(500))  # Path to generated Excel
    generation_time = Column(Float)  # Time taken in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="test_history")
    team = relationship("Team", back_populates="test_history")
    
    def __repr__(self):
        return f"<TestGenerationHistory(id={self.id}, ticket_id='{self.ticket_id}', user_id={self.user_id})>"


class UserWorkspaceContext(Base):
    """Tracks user's active workspace (personal or team)"""
    __tablename__ = 'user_workspace_context'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    active_team_id = Column(Integer, ForeignKey('teams.id', ondelete='SET NULL'), nullable=True)  # NULL = personal workspace
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="workspace_context")
    
    def __repr__(self):
        workspace = "Personal" if self.active_team_id is None else f"Team {self.active_team_id}"
        return f"<UserWorkspaceContext(user_id={self.user_id}, workspace='{workspace}')>"


class PasswordResetToken(Base):
    """Password reset tokens for user password recovery"""
    __tablename__ = 'password_reset_tokens'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)  # Random secure token
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(45))  # IPv6 compatible
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<PasswordResetToken(id={self.id}, user_id={self.user_id}, used={self.used})>"
