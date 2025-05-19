##################################
# Auth Register
# Last version of update: v0.81

##################################

import os
import time
import uuid
import logging
import tracemalloc
import bcrypt
import secrets

from flask import current_app, flash, jsonify, make_response, redirect, request, url_for
from app.dep_lib import available_options
from app.db_man.multidb_func import check_registry_key
from app.db_man.pqsql.backend_func import session


def new_session(system_id: int, data_json: any):
    """
    Creates a new session, returns generated key, uuid and writes into database

    Args:
        system_id (int): client_id bind to registered key
        data_json (dict): data

    Using:
        os, logging, tracemalloc, json, flask, bcrypt, uuid
        db_man.pqsql.backend_func: session()

    Returns:
        str / bool: Status code
        str: session_uuid - returning generated uuid
        str: session_key - returning generated key
    """

    logging.debug("New Session Credentials")
    session_uuid = str(uuid.uuid4())
    session_key = secrets.token_hex(64)
    available = ""

    for option in data_json['config']['available'].split("-"):
        if option in available_options:
            available += f"{option}-"

    logging.debug(f"Available Options: {available[:-1]}")
    expire_time = int(time.time()) + int(os.getenv("HARDWARE_SESSION_EXPIRE"))
    session_key_salt = bcrypt.gensalt()
    session_key_hash = (bcrypt.hashpw(session_key.encode(
        'utf-8'), session_key_salt)).decode('utf-8')
    try:
        logging.info("Creating new session")
        client = [str(system_id), str(session_uuid), str(
            session_key_hash), str(available[:-1]), str(expire_time), "behdata"]
        config = [str(system_id), str(data_json['config']['system_time_unit']), str(data_json['config']['temperature_unit']), str(data_json['config']['pressure_unit']), str(data_json['config']['voltage_unit']), str(data_json['config']['power_unit']), str(
            data_json['config']['speed_unit']), str(data_json['config']['weight_unit']), str(data_json['config']['sound_pressure_level_unit']), str(data_json['config']['network_strenght_unit']), str(data_json['config']['memory_unit'])]
        if session(client, config):
            logging.info("Creating new session was succesfull")
        else:
            logging.debug("Adding to the database failed")
            return False, "", ""
        return "OK", session_uuid, session_key
    except:
        logging.debug("Something went wrong")
        return False, "", ""


def start_session(data_json):
    """
    Check if secret_key is valid and generates new session, returns session_key, session_uuid

    Args:
        data_json (dict): data

    Using:
        os, logging, tracemalloc, json, flask
        
        create_session : new_session()

    Returns:
        tuple: (session_uuid: str, session_key: str)
        int: status code
    """

    logging.debug("Creating Session")
    key = data_json['key']
    system_id = data_json['system_id']
    if not check_registry_key(system_id, key):
        logging.debug("Wrong device KEY")
        return "KEY", 401

    credentials_status, session_id, session_key = new_session(
        system_id, data_json)

    if credentials_status != "OK":
        logging.debug("credentials status Failed")
        return "CRED", 400
    response = make_response(jsonify(
        {"session_id": session_id, "session_key": session_key}
    ), 201)
    logging.debug(f"DEBUG_OUTPUT_SESSION: {response}")
    response.headers["Content-Type"] = "application/json"
    return response
