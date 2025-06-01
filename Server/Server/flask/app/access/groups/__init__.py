# app/groups/__init__.py
from flask import Blueprint

# Define the blueprint object
groups_bp = Blueprint('groups', __name__)

# Import routes after blueprint definition
from . import routes