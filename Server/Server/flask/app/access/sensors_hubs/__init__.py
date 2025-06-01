###################################
# __init__.py of api access folder
# Version v0.91
###################################
from flask import Blueprint
from app.dep_lib import limiter

sensorhubs_bp = Blueprint('sensorhubs', __name__, url_prefix='/sensors_hubs')
limiter.limit('10/second')(sensorhubs_bp)

from . import routes


