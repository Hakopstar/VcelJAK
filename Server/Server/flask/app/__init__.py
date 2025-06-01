##############################################
# MAIN FLASK __init__.py file
# Last version of update: v0.95
# Initiating all url prefixes and functions
##############################################
# Install requirements: pip install -r requirements.txt
# Update requirements:  pip freeze > requirements.txt

# Initiating Application
# START APP

import os
import logging
from datetime import timedelta


# --- Flask and Extensions ---
from flask import Flask, jsonify, current_app, g, request# g can be used for request context storage
from dotenv import load_dotenv
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# --- Gevent and Concurrency ---
import gevent # For scopefunc with scoped_session

# --- Database ---
from sqlalchemy.orm import scoped_session
from app.db_man.pqsql.database import SessionLocal, engine as db_engine, create_db_and_tables
from app.db_man.pqsql.models import Base, JwtBlocklist

# --- Redis ---
import redis


# --- Limiter ---
from .dep_lib import limiter

# --- DB SESSION ----
DbRequestSession = scoped_session(SessionLocal, scopefunc=gevent.getcurrent)
logging.debug("DbRequestSession (scoped) configured with gevent scopefunc.")

def create_app(test_config: str = None) -> object:
    """
    Creates App object

    Args:
        Test_config (str): config with additional parameters    

    Returns:
        Object: Created App object
    """

    # === 0. Init ===
    # Create and configure the app
    logging.info("Creating Application!")
    app = Flask(__name__, instance_relative_config=True)

    # Allowing CORS - Cross-origin Resource Sharing for ALL
    logging.info("Allowing CORS!")
    CORS(app, supports_credentials=True)

    logging.info("Starting limiter!")
    limiter.init_app(app)
    

    # === 1. Load Configuration ===
    logging.info("Loading configuration...")
    # Default configuration
    app.config.from_mapping(
        SECRET_KEY=os.getenv('SECRET_REGISTER_API_KEY', 'default-dev-secret-key!'), # Essential for session, etc.
        JWT_SECRET_KEY=os.getenv('JWT_SECRET_KEY', 'default-jwt-secret-key!'), # Essential for JWT
        # Redis config from env with defaults
        REDIS_HOST=os.getenv('REDIS_HOST', 'localhost'),
        REDIS_PORT=int(os.getenv('REDIS_PORT', 6379)),
        REDIS_DB=int(os.getenv('REDIS_DB', 0)),
        # Scheduler config from env with default
        SCHEDULER_INTERVAL_MINUTES=int(os.getenv("LAST_READING_UPDATE_INTERVAL_MINUTES", "5")),
        # Database URL (primarily used by database.py but can be stored here too) - somewhat needs rework, database meaning postgres
        DATABASE_URL=os.getenv('DATABASE_URL'),
        CORS_HEADERS='Content-Type',
        JWT_COOKIE_SECURE = False,
        JWT_TOKEN_LOCATION = ["cookies", "headers"],
        DENORMALIZATION_INTERVAL_MINUTES=int(os.getenv("LAST_READING_UPDATE_INTERVAL_MINUTES", "5")),
        JWT_ACCESS_TOKEN_EXPIRES= timedelta(hours=12))

    # Override with test config if provided (useful for testing)
    if test_config:
        logging.info("Applying test configuration.")
        app.config.update(test_config)

    if not app.config['DATABASE_URL']:
         logging.error("DATABASE_URL configuration is missing!")
         raise ValueError("DATABASE_URL must be set in environment or config.")
    if not app.config['JWT_SECRET_KEY'] or app.config['JWT_SECRET_KEY'] == 'default-jwt-secret-key!':
        logging.warning("JWT_SECRET_KEY is using default or is missing. Please set a strong secret key!")
    if not app.config['SECRET_KEY'] or app.config['SECRET_KEY'] == 'default-dev-secret-key!':
        logging.warning("SECRET_KEY is using default or is missing. Please set a strong secret key!")
    
    
    # === 2. Initialize Extensions ===
    logging.info("Initializing extensions...")

    # JWT Manager
    try:
        jwt = JWTManager(app)
        logging.info("Flask-JWT-Extended initialized.")
    except Exception as e:
        logging.error(f"Failed to initialize JWTManager: {e}", exc_info=True)
        raise

    # --- Define the Blocklist Callback ---
    # This function will be called by Flask-JWT-Extended automatically
    # for tokens specified in JWT_BLOCKLIST_TOKEN_CHECKS.
    @jwt.token_in_blocklist_loader
    def check_if_token_is_revoked(jwt_header, jwt_payload):
        """
        Callback function to check if a JWT exists in the database blocklist.
        Returns True if the token is revoked (blocklisted), False otherwise.
        - Short description
        """
        jti = jwt_payload['jti']
        logging.debug(f"Checking blocklist for jti: {jti}")
        db = None # Initialize db to None
        try:
            db = DbRequestSession() # Get request-scoped session
            # Query the blocklist table using the jti
            token_in_db = db.query(JwtBlocklist.id).filter_by(jti=jti).scalar() is not None
            if token_in_db:
                logging.debug(f"Token {jti} IS in blocklist.")
                return True # Token is blocklisted
            else:
                logging.debug(f"Token {jti} is NOT in blocklist.")
                return False # Token is not blocklisted
        except Exception as e:
            # --- CRITICAL: Error Handling ---
            logging.error(f"Blocklist check failed for jti {jti} due to DB error: {e}", exc_info=True)
            return True # Fail safe - assume revoked if check fails
        # finally:
             # Scoped session remove is handled by teardown context, no need here

    # Redis Client (stored on app instance), checked in the init but for good measure test in the normal system. TODO: maybe redudant function.
    try:
        app.redis_pool = redis.ConnectionPool(
            host=app.config['REDIS_HOST'], port=app.config['REDIS_PORT'], db=app.config['REDIS_DB'],
            decode_responses=True, max_connections=20 # Adjust max_connections as needed
        )
        # Store the client directly on the app context
        app.redis_client = redis.Redis(connection_pool=app.redis_pool)
        app.redis_client.ping() # Test connection
        logging.info(f"Redis client initialized and connected to {app.config['REDIS_HOST']}:{app.config['REDIS_PORT']}")
    except Exception as e:
        logging.warning(f"Could not connect to Redis: {e}. Redis features will be unavailable.")
        app.redis_pool = None
        app.redis_client = None # Ensure it's None if connection failed

    # === 3. Configure Database Session Scope (as before) ===
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        DbRequestSession.remove()

    # === 4. Register Blueprints (as before) ===
    logging.info("Registering blueprints...")
    from app.hive import bp as hive_bp
    from app.access.access import access_bp 
    from app.access.sensors_hubs import sensorhubs_bp
    from app.access.hub_management import hub_management_bp
    from app.access.sessions import hub_sessions_bp
    from app.access.config import server_config_bp
    from app.access.tags import tags_bp 
    from app.access.groups import groups_bp
    from app.access.rules import rules_bp
    from app.access.schedules import schedules_bp
    from app.sapi import bp
    from app.sse import sse_bp

    app.register_blueprint(hive_bp)
    app.register_blueprint(access_bp)
    app.register_blueprint(sensorhubs_bp, url_prefix='/access/sensors_hubs')
    app.register_blueprint(hub_management_bp, url_prefix='/access/hub_management')
    app.register_blueprint(hub_sessions_bp, url_prefix='/access/sessions')
    app.register_blueprint(server_config_bp, url_prefix='/access/config')
    app.register_blueprint(tags_bp, url_prefix='/access/tags')
    app.register_blueprint(groups_bp, url_prefix='/access/groups') 
    app.register_blueprint(rules_bp, url_prefix='/access/rules') #
    app.register_blueprint(schedules_bp)
    app.register_blueprint(bp, url_prefix='/sapi')
    
    app.register_blueprint(sse_bp)
    

    @app.errorhandler(404)
    def not_found_error(error):
        logging.warning(f"404 Not Found: {request.url}")
        return jsonify({"error": "Not Found", "message": error.description}), 404

    @app.errorhandler(500)
    def internal_error(error):
        DbRequestSession.remove()
        logging.error(f"500 Internal Server Error: {error}", exc_info=True)
        return jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred."}), 500

    return app
 