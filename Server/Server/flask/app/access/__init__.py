###################################
# __init__.py of api access folder
# Version v0.91
###################################
from flask import Blueprint
from app.dep_lib import limiter

bp = Blueprint('access', __name__, url_prefix='/access')
limiter.limit('10/second')(bp)

from app.access import routes