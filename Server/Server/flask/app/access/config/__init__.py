###################################
# __init__.py of config access folder
# Version v0.95
###################################
from flask import Blueprint

# Define the blueprint object
server_config_bp = Blueprint('server_config', __name__)

# Import routes after blueprint definition
from . import routes