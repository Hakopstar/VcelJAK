###################################
# __init__.py of Database folder
# Version v0.81
###################################
from flask import Blueprint
from app.dep_lib import limiter

bp = Blueprint('hive', __name__, url_prefix='/hive')
limiter.limit('2/second')(bp)

from app.hive import routes