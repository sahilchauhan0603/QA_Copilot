"""
Flask API Server
Minimal entry-point: creates the Flask app, registers Blueprints,
and provides error handlers.
"""
import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=UserWarning, message='.*Pydantic.*')
warnings.filterwarnings('ignore', category=UserWarning, message='.*pydantic.*')

from flask import Flask, jsonify
from flask_cors import CORS
import logging
import os
from dotenv import load_dotenv

from database.connection import init_database
from api.routes import register_blueprints

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
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=False,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization", "Content-Disposition"]
)

# Register all route Blueprints
register_blueprints(app)


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
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        exit(1)

    port = int(os.getenv('API_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    logger.info(f"Starting API server on port {port}")
    logger.info("Note: Using development server. For production, use: gunicorn -w 4 -b 0.0.0.0:5000 api.server:app")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
