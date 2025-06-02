########################################################
# hive/routes.py creating POST routes to database
# Last version of update: v0.81
#
########################################################


# Import
import os
import json
import logging
import tracemalloc
import time
import io


from flask import Flask, render_template, request, json, jsonify, Response, flash, request, redirect, current_app
from flask_httpauth import HTTPBasicAuth

from datetime import datetime, date


from app.hive import bp
from app.session_manager import session_entry_valid, new_session_request

from app.json_testing import json_test

from app.dep_lib import limiter
from app.helpers.tips import update_tips
from app import DbRequestSession

from app.hive.hive_sent import run_processing_pipeline


########################### AUTH SECTION ##########################
# HTTP BASIC SECTION
auth = HTTPBasicAuth()
# GET PASSWORD, IF USERNAME IS NOT IN DATABASE THEN get_clients_database return NONE = FAILED AUTH,
# IF USERNAME'S PASSWORD = SENDED PASSWORD ACCESS GRANTED
# Verify functionality


@auth.verify_password
def authenticate(username: str, password: str):
    """
    Checks if presented id can access the content

    Args:
        username (str):
        password (str):
    
    Using:

    Returns:
        Bool: Status
    """
    try:
        logging.info("Session authentication in process")
        db = DbRequestSession() 
        result = session_entry_valid(db, username, password)
        logging.debug(f"Authentication_status: {result}")
        return result
    except:
        return False

####################################################################

# WEB ROUTING

# SENSOR HANDLER

@bp.route('/sensor', methods=['POST'])
@limiter.limit("2 per 1 second")
@auth.login_required
def handle_sensor_request():
    """
    Handling function of incoming sensor request, it writes data into influxdb database

    Args:
        request.data (any): binaries got from flask

    Using:
        os, logging, json, flask
        flask_basicauth @auth, auth.current_user()
        json_testing: json_test()
        db_man.influxdb.main: send_data()

    Returns:
        str: Webpage status message
        int: Webpage status code
    """

    logging.debug("/sensor request processing")
    # IF empty post request, wrong syntax - 400 error
    if not request.data:
        logging.debug("Empty String - 400")
        return "EMPTY_STRING", 400

    # IF content type isn't JSON then raise 415 error
    content_type = request.headers.get('Content-Type')
    if not ((content_type == 'application/json') and request.is_json):
        logging.debug("Content type is not supported - 415")
        return "CONTENT_TYPE_NOT_SUPPORTED", 415
    
    # Test json file against json schema, if test is succesfull continue
    try:
        json_data = json.loads((request.data).decode("utf-8"))
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 422
    status, code = json_test(json_data, "sensor")

    if status != "OK":
        logging.debug(f"Json Test Failed: {status} - {code}")
        return status, code

    # Get hardware hub client_id and add it as measurement_id, send data to InfluxDB.
    client_id = auth.current_user()


    rc = current_app.redis_client # Get redis client from app instance
    db = DbRequestSession() 
    code_data, value = run_processing_pipeline(db, rc, client_id, json_data['data'])
    if code_data != 201:
        logging.warning(f"InfluxDB sending communication failed {code_data}")
        return f"{value}", "Server problem"
    update_tips()
    return "Updated", 201


@bp.route('/session', methods=['POST'])
@limiter.limit("2 per 1 seconds")
def handle_session_request():
    """
    Creates Session (if you have right key), Generates Session_ID, Session_KEY for system

    Args:
        request.data (any): binaries got from flask

    Using:
        os, logging, tracemalloc, json, flask
        json_testing: json_test()
        create_session: start_session()

    Returns:
        tuple: (
            json: Session_id, session_key 
            int: Webpage status code
            )
    """

    logging.debug("Session request")

    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    content_type = request.headers.get('Content-Type')
    if not ((content_type == 'application/json') and request.is_json):
        logging.debug("Content type is not supported - 415")
        return "Content type is not supported.", 415
    
    try:
        logging.debug(request.data) 
        json_data = json.loads((request.data).decode("utf-8"))
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415

    status, code = json_test(json_data, "session")
    if status != "OK":
        logging.debug(f"{status} - {code}")
        return status, code
    
    db = DbRequestSession() 
    try:
        newsession = new_session_request(db, json_data)
    except Exception as err:
        logging.error(f"New session error: {err}")
        return "SERVER_ERROR", 500
    return newsession


