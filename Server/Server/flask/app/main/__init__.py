########################################
# INIT File of main url
# Version v0.25
########################################
from flask import Flask, Blueprint

bp = Blueprint('main', __name__)
from app.main import routes


