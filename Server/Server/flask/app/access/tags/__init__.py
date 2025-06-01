# app/tags/__init__.py
from flask import Blueprint

# Define the blueprint object
tags_bp = Blueprint('tags', __name__)

# Import routes after blueprint definition
from . import routes