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


from flask import Flask, render_template, request, json, jsonify, Response, flash, request, redirect
from flask_httpauth import HTTPBasicAuth

from datetime import datetime, date


from app.hive import bp
from app.db_man.influxdb.main import send_data
from app.db_man.multidb_func import check_session
from app.json_testing import json_test
from app.create_session import start_session
from app.dep_lib import limiter
from app.tips import update_tips

########################### AUTH SECTION ##########################
# HTTP BASIC SECTION
auth = HTTPBasicAuth()
# GET PASSWORD, IF USERNAME IS NOT IN DATABASE THEN get_clients_database return NONE = FAILED AUTH,
# IF USERNAME'S PASSWORD = SENDED PASSWORD ACCESS GRANTED
# TODO: Add Unit Tests
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
        start_time = time.time()
        logging.info("Session authentication in process")
        result = check_session(username, password)
        logging.debug(f"Authentication_status: {result}")
        logging.debug(f"Authenticate time: {time.time() - start_time}")
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
    code_data, value = send_data(json_data['data'], client_id)
    if code_data != 201:
        logging.debug(f"InfluxDB sending communication failed {code_data}")
        return f"{value}", code_data
    update_tips()
    return "Updated", 201


# DIAGNOSTICS HANDLER


@bp.route('/diagnostics', methods=['POST'])
@limiter.limit("1 per 10 seconds")
@auth.login_required
def handle_diangostics_request():
    """
    Handling function of incoming diagnostics request

    Args:
        request.data (any): binaries got from flask

    Using:
        os, logging, tracemalloc, json, flask
        

    Returns:
        str: Webpage status message
        int: Webpage status code
    """
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400

    content_type = request.headers.get('Content-Type')
    if not ((content_type == 'application/json') and request.is_json):
        logging.debug("Content type is not supported - 415")
        return "Content type is not supported.", 415

    logging.debug("diagnostics not functional")
    return "Diagnostics are not supported, yet", 200

"""
@bp.route('/audio', methods=['POST'])
@auth.login_required
def handle_audio_request():
    if request.method != 'POST':
        logging.debug("Method Not Allowed - 405")
        return "Method Not Allowed", 405
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    request.files['messageFile']
"""

@bp.route("/wav", methods=['POST'])
@limiter.limit("1 per 20 seconds")
def streamwav():
    logging.info("Stream Wav method was called!")

    if 'file' not in request.files:
        return "File General Error", 400
    file = request.files['file']


    if file.filename == '':
        logging.debug("Error - no selected file")
        
        return "No selected file", 400
    
    if file.filename.endswith('.wav'):
        logging.info("Correct file format")
    else:
        return "Wrong File", 400
    

    now = datetime.now()
    dt_string = now.strftime("%d-%m-%Y_%H.%M.%S")
    file_name = str(dt_string) + ".wav"
    UPLOAD_FOLDER = '/app/app/audio_storage'
    full_file_name = os.path.join(UPLOAD_FOLDER, file_name)
    file.save(full_file_name)


    return "Success", 201


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

    start_time = time.time()
    logging.debug("Session request")
    logging.debug(f"Trace malloc: {tracemalloc.get_traced_memory()}")
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    content_type = request.headers.get('Content-Type')
    if not ((content_type == 'application/json') and request.is_json):
        logging.debug("Content type is not supported - 415")
        return "Content type is not supported.", 415
    
    ## FIXX FOR FUCK SAKE REQUEST.DATA.DECODE FOR NON UTF-8 CHARACTERS FAILS

    try:
        logging.debug(request.data) #
        json_data = json.loads((request.data).decode("utf-8"))
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415

    status, code = json_test(json_data, "session")
    if status != "OK":
        logging.debug(f"{status} - {code}")
        return status, code

    newsession = start_session(json_data)
    logging.debug(f"Trace2 malloc: {tracemalloc.get_traced_memory()}")
    logging.debug(f"Session: {time.time() - start_time}")
    return newsession



@bp.route('/register', methods=['POST'])
@limiter.limit("2 per 10 seconds")
def register_system():
    """
    DOESNT WORK

    Args:
        request.data (any): binaries got from flask

    Using:
        os, logging

    Returns:
        str: Webpage status message
        int: Webpage status code
    """
    
    if request.method != 'POST':
        logging.debug("Method Not Allowed - 405")
        return "Method Not Allowed", 405
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    content_type = request.headers.get('Content-Type')
    if not ((content_type == 'application/json') and request.is_json):
        logging.debug("Content type is not supported - 415")
        return "Content type is not supported.", 415

    status = json_test(request.data, "register")
    if not status:
        logging.debug("JSON Format not supported - 400")
        return "JSON Format not supported", 400

    register_response = rg.main_register(
        json.loads((request.data).decode("utf-8")))
    return register_response

"""
@bp.route('/audio', methods=['GET', 'POST'])
@limiter.limit("2 per 1 seconds")
def audio_system():
    if request.method == 'POST':
        logging.debug(f"Requested file: {request.files}")
        data = request.files['audio_data'].read()
        logging.debug(f"Debug: {data}")
"""

@bp.route('/test', methods=['GET'])
@limiter.limit("5 per 120 seconds")
def hive_test():
    """
    TESTING FUNCTION

    Args:
        request.data (any): binaries got from flask

    Using:
        os, logging
        
    Returns:
        str: Webpage status message
        int: Webpage status code
    """

    logging.warning("Testing has been activated!")
    return "Success", "200"
