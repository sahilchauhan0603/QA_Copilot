"""
Blueprint registration module.
"""
from api.routes.auth import auth_bp
from api.routes.teams import teams_bp
from api.routes.workspaces import workspaces_bp
from api.routes.generation import generation_bp
from api.routes.integrations import integrations_bp
from api.routes.test_management import test_management_bp


def register_blueprints(app):
    """Register all API Blueprints on the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(teams_bp)
    app.register_blueprint(workspaces_bp)
    app.register_blueprint(generation_bp)
    app.register_blueprint(integrations_bp)
    app.register_blueprint(test_management_bp)
