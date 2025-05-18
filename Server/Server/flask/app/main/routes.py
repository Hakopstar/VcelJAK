#########################
# Views - handling requests
# Last version of update: v0.79

##########################
# Import
import logging

from flask import request, json, jsonify, render_template

from app.main import bp

# If the post method is called on main site: 127.0.0.1:5000/ then return wrong path
@bp.route("/", methods=['POST', 'GET'])
def homepage():
    if request.method == "GET":
        return render_template('main.html')
    else:
        return "Wrong path to server"


# Handling POST methods and passing to database


@bp.errorhandler(404)
def page_not_found(error):
    return render_template('./frontend/errorpage/errorpage.html'), 404
