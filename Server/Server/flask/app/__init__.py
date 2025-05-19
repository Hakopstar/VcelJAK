##############################################
# MAIN FLASK __init__.py file
# Last version of update: v0.81
# Initiating all url prefixes and functions
##############################################
# Install requirements: pip install -r requirements.txt
# Update requirements:  pip freeze > requirements.txt

# Initiating Application
# START APP
from app.db_man.pqsql.models import Base, Available_sensors, Session_auth, Config, MyModelView

from .events import socketio
from flask_sqlalchemy import SQLAlchemy
from gevent import monkey
monkey.patch_all()

def create_app(test_config: str = None) -> object:
    """
    Creates App object

    Args:
        Test_config (str): config with additional parameters
    
    Using:
        os, logging, tracemalloc, flask, flask_admin, flask_sqlalchemy, sql_alchemy, limiter
        dep_lib: limiter
        db_man.pqsql.models: Base, Available_sensors, Session_auth, Config, MyModelView
        main: main_bp
        hive: hive_bp

    Returns:
        Object: Created App object
    """

    import os
    import logging
    import tracemalloc
    from datetime import timedelta

    from flask import Flask
    from flask_cors import CORS
    from flask_admin import Admin
    from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, JWTManager
    

    from .dep_lib import limiter
    from app.db_man.pqsql.models import BlocklistToken
    from app.db_man.pqsql.engine import session_clientmodifier
    

    # Create and configure the app
    logging.info("Creating Application!")
    app = Flask(__name__, instance_relative_config=True)

    # Allowing CORS - Cross-origin Resource Sharing for ALL
    logging.info("Allowing CORS!")
    CORS(app, supports_credentials=True)

    logging.info("Starting limiter!")
    limiter.init_app(app)
    logging.debug(f" ALLOCATED MEMORY: {tracemalloc.get_traced_memory()}")
    tracemalloc.reset_peak()
    # Debugging Config System
    if test_config is None:
        # load the instance config, if it exists, when not testing
        logging.info("No config passed in, loading default option: config.py")
        try:
            if os.path.exists('config.py'):
                logging.warning("Config.py found, initiating override!")
            else:
                logging.info(
                    "Config.py doesn't exists, skipping config override")
        except Exception as err:
            logging.warning(f"Errory: {err}")
            logging.info("Config.py doesn't exists, skipping config override")
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        logging.info("Loading testing config --debugging mode detected")
        try:
            if os.path.exists(test_config):
                logging.warning(f"{test_config} found, initiating override!")
            else:
                logging.info(
                    f"{test_config} doesn't exists, skipping config override")
            app.config.from_mapping(test_config)
        except:
            logging.info(
                f"{test_config} doesn't exists, skipping config override")
            
    app.config['FLASK_ADMIN_SWATCH'] = 'slate'
    app.config['CORS_HEADERS'] = 'Content-Type'
    app.config["JWT_SECRET_KEY"] = os.getenv('JWT_SECRET_KEY')
    app.config["JWT_COOKIE_SECURE"] = False #TODO: in production turn true, forcing to be send via https
    app.config["JWT_TOKEN_LOCATION"] = ["cookies", "headers"]
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)

    jwt = JWTManager(app)

    #TODO FIX

    def check_if_token_in_blocklist(jwt_header, jwt_payload):
        jti = jwt_payload["jti"]
        try:
            with session_clientmodifier() as session:
                return session.query(BlocklistToken).filter_by(jti=jti).first() is not None
        except Exception as e:
            logging.error(f"JWT CHECKING IF IN BLOCKLIST ERROR {e}")
            return False

    # Register blocklist check
    jwt.token_in_blocklist_loader(check_if_token_in_blocklist)
    # ensure the instance folder exists
    try:
        logging.debug("testing instance path")
        os.makedirs(app.instance_path)
    except OSError:
        pass

    logging.info("Loading Blueprints (0/4)")
    
    logging.info("Loading / (1/4)")
    from app.main import bp as main_bp
    app.register_blueprint(main_bp)

    logging.info("Loading /hive (2/4)")
    from app.hive import bp as hive_bp
    app.register_blueprint(hive_bp)

    logging.info("Loading /sapi (3/4)")
    from app.sapi import bp as sapi_bp
    app.register_blueprint(sapi_bp)

    logging.info("Loading /access (4/4)")
    from app.access import bp as access_bp
    app.register_blueprint(access_bp)
    from app.sse import sse_bp, update_sse
    app.register_blueprint(sse_bp)

    
    from app.tips import update_tips
    update_tips()
    db = SQLAlchemy(model_class=Base)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"postgresql+psycopg://client_modifier:{os.getenv('POSTGRES_USERS_ACCESS_PASS')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/clients_system"
    db.init_app(app)
    socketio.init_app(app)

    logging.info("Loading Admin panel")

    return app
