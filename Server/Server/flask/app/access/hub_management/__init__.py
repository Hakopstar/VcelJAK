###################################
# __init__.py of api access folder
# Version v0.91
###################################
from flask import Blueprint
from app.dep_lib import limiter

hub_management_bp = Blueprint('hub_management', __name__, url_prefix='/hub_management')
limiter.limit('10/second')(hub_management_bp)

from . import routes
