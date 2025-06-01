###################################
# __init__.py of API folder
# Version v0.91
###################################
from flask import Blueprint
from app.dep_lib import limiter

bp = Blueprint('sapi', __name__)
limiter.limit('10/second')(bp)

from app.sapi import routes