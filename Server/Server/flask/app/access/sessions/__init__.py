# app/hub_sessions/__init__.py
from flask import Blueprint

# Define the blueprint object
# The first argument 'hub_sessions' is the internal name of the blueprint.
# The second argument __name__ helps Flask locate the blueprint's root path.
hub_sessions_bp = Blueprint('hub_sessions', __name__)

# Import routes after blueprint definition to avoid circular imports
from . import routes