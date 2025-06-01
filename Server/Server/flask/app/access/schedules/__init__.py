# app/schedules/__init__.py
from flask import Blueprint

# Define the blueprint object first
# Using url_prefix='/access/schedules' based on frontend API calls
schedules_bp = Blueprint('schedules', __name__, url_prefix='/access/schedules')

# Then import the routes module which uses this blueprint
from . import routes