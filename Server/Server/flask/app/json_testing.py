########################################
# JSON Object testing
# Last version of update: v0.81
# Validating and checking json object
########################################

import json
import logging
import os
import jsonschema
import app.json_schemas as jsm

from jsonschema import validate


def check_if_blank(value: any) -> bool:
    """
    Checks if value is blank

    Args:
        value (any): Actual object
    
    Using:
        os, logging

    Returns:
        Bool - Status
    """

    if isinstance(value, str) and not value.strip():
        logging.debug("BLANK DETECTED")
        return True
    if isinstance(value, dict):

        return any(check_if_blank(v) for v in value.values())
    if isinstance(value, list):

        return any(check_if_blank(v) for v in value)
    return False


def check_api(data: dict, mtype: str):
    """
    Checks if API Version is supported

    Args:
        data (dict): Data dictionary - getting the needed key
        mtype (str): request type - called by func
    Using:
        os, logging

    Returns:
        str: Function status message
        int: Function status code
    """

    if mtype == "sensor":
        if float(data['info']['api_version']) != float(os.getenv('API_VERSION')):
            logging.debug(
                f"api_not_supported, API_JSON: {data['info']['api_version']}, API_SERVER: {os.getenv('API_VERSION')}")
            return "API_NOT_SUPPORTED", 426
    elif mtype == "session":
        if float(data['api_version']) != float(os.getenv('API_VERSION')):
            logging.debug(
                f"api_not_supported, API_JSON: {data['api_version']}, API_SERVER: {os.getenv('API_VERSION')}")
            return "API_NOT_SUPPORTED", 426
    else:
        logging.debug("Mode not supported")
    return "OK", 200
# Validate JSON object against schema


def validate_schema_of_json(json: any, data_schema: any) -> bool:
    """
    Validates if actual json is corresponding to json schema

    Args:
        json (json): POST json object
        data_schema (dict): Python Data schema corresponding to selected object
    Using:
        os, logging, json_schema

    Returns:
        bool - Status of process
    """
    
    try:
        validate(instance=json, schema=data_schema)
    except jsonschema.exceptions.ValidationError as err:
        logging.debug("JSON SCHEMA FAILED")
        logging.debug(err)
        return False
    return True


############### Main Function #################
def json_test(myjson: any, type: str) -> (str, int):
    """
    Validates if actual json is functional

    Args:
        myjson (json): POST json object
        type (str): where the json is comming from (/session, /register)
    Using:
        os, logging, json_schema

    Returns:
        str: The status message of this function
        int: The status code of this function
    """

    try:
        if type == "sensor":
            data_schema = jsm.sensor_schema
        elif type == "diagnostics":
            data_schema = jsm.diagnostics_schema
        elif type == "register":
            pass
        elif type == "session":
            data_schema = jsm.newsession_request_schema
        else:
            data_schema = {"error": {"wrong_format"}}

        if not validate_schema_of_json(myjson, data_schema) or check_if_blank(myjson):
            logging.debug("JSON TEST FAILED")
            return "WRONG_JSON_FORMAT", 400

        status, code = check_api(myjson, type)
        if code != 200:
            return status, code

        if type == "sensor":
            if not myjson['data']:
                logging.debug("Data Empty")
                return "DATA_EMPTY", 400
    except Exception as err:
        logging.debug("Exception in json_test detected!")
        logging.debug(err)
        return "EXCEPTED_JSON_FORMAT", 400
    return "OK", 200
