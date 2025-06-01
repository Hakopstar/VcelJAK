# app/groups/__init__.py
from flask import Blueprint

# Define the blueprint object
rules_bp = Blueprint('rules', __name__)

# Import routes after blueprint definition
from . import routes