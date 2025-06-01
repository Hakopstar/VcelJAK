###################################
# __init__.py of api access folder
# Version v0.95
###################################
from flask import Blueprint
from app.dep_lib import limiter

access_bp = Blueprint('access', __name__, url_prefix='/access')
limiter.limit('10/second')(access_bp)

from . import routes