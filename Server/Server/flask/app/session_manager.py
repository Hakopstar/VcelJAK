
##################################
# Session manager
# Last version of update: v0.95
# app/session_manager.py
##################################


import os

import logging
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from flask import current_app, flash, jsonify, make_response, redirect, request, url_for
from typing import Optional
import redis

import bcrypt
import secrets
import uuid

import app.db_man.pqsql.read as crud_read
import app.db_man.pqsql.createupdate as crud_cr

from app.db_man.pqsql.models import Group, Tag, Sensor # Import models you might interact with
from app.db_man.pqsql.database import SessionLocal, create_db_and_tables
from app.dep_lib import available_options

def new_session_request(db: Session, data):
    """
    Check if secret_key is valid and generates new session, returns session_key, session_uuid

    Args:
        data_json (dict): data
        (dict): .system_id
                .key
        - checked via json_schemas

    Using:
        os, logging, tracemalloc, json, flask
        

    Returns:
        tuple: (session_uuid: str, session_key: str) or error_string, error_code
        int: status code
    """
    logging.info("---- New session request ----")
    hub_id = data.get("system_id")
    hub_key = data.get("key")

    # Checking stored hub_key_hash in postgres database
    logging.debug("Checking hub key with saved hash")
    
    try:
        hub_entry = crud_read.get_available_sensors_db(db, hub_id)
        if hub_entry:
            client_key_hash = hub_entry.client_key_hash 

            # Add a check if the hash is actually present
            if not client_key_hash:
                logging.error(f"Hub {hub_id} found, but client_key_hash is missing or empty.")
                return "KEY_MISSING", 500 # Or appropriate error

            check_hash = bcrypt.checkpw(hub_key.encode("utf-8"), client_key_hash.encode("utf-8"))
            if not check_hash:
                logging.warning(f"Password check failed for hub {hub_id}")
                return "KEY_INVALID", 401
            # Key is valid if we reach here
            logging.debug(f"Key hash check successful for hub {hub_id}")
        else:
            logging.warning(f"Hub entry not found for ID: {hub_id}")
            return "ENTRY_NOT_FOUND", 401

    except SQLAlchemyError as e:
        db.rollback() # Rollback on any database error during the demo
        logging.error(f"--- SQLAlchemy Error Occurred ---")
        logging.error(e)
        logging.error("Transaction rolled back.")
        return "DATABASE_ERROR", 502
    except Exception as e:
        # Catch other potential errors
        logging.error(f"\n--- An Unexpected Error Occurred ---")
        logging.error(e)
        return "DATABASE_ERROR", 502
    
    hub_config = data.get('config')
    if hub_config == 'None':
        return "INVALID_CONFIG", 401
    logging.debug("Step 2 - creating new session")
    try:
        credentials_status, session_id, session_key = create_new_session(db, hub_id, hub_config)
    except Exception as err:
        logging.warning("--- Creating New session failed ----")
        logging.error(f"error: {err}", exc_info=True)
        return "CRED", 400
    if credentials_status != "OK":
        logging.debug("Creating Failed, unhandled error")
        return "CRED", 400
    response = make_response(jsonify(
        {"session_id": session_id, "session_key": session_key}
    ), 201)
    logging.debug(f"DEBUG_OUTPUT_SESSION: {response}")
    response.headers["Content-Type"] = "application/json"
    return response
    



def create_new_session(db: Session, hub_id, hub_config):
    logging.info("---- Creating new session ----")
    session_uuid = str(uuid.uuid4())
    session_key = secrets.token_hex(64)
    available = ""
    logging.debug("Creating avilable options")
    for option in hub_config.get('available').split("-"):
        if option in available_options:
            available += f"{option}-"
    logging.debug(f"Hubs features: {available[:-1]}")


    expire_timestamp = int(time.time()) + int(os.getenv("HARDWARE_SESSION_EXPIRE"))
    session_key_salt = bcrypt.gensalt()
    session_key_hash = (bcrypt.hashpw(session_key.encode(
        'utf-8'), session_key_salt)).decode('utf-8')
    session_end_aware = datetime.fromtimestamp(expire_timestamp, tz=timezone.utc)
    logging.info(f"session aware: {session_end_aware}")
    try:
        logging.info("-- Building entries into database --")
        try:
            config = {"system_time_unit": str(hub_config['system_time_unit']),              # e.g., seconds
                        "temperature_unit": str(hub_config['temperature_unit']),
                        "pressure_unit": str(hub_config['pressure_unit']),                # Pascals
                        "voltage_unit": str(hub_config['voltage_unit']),                 # millivolts
                        "power_unit": str(hub_config['power_unit']),                    # Watts
                        "speed_unit": str(hub_config['speed_unit']),
                        "weight_unit": str(hub_config['weight_unit']),               # grams
                        "sound_pressure_level_unit": str(hub_config['sound_pressure_level_unit']),    # decibels
                        "network_strength_unit": str(hub_config['network_strength_unit']),      # Or could be "dBm"
                        "memory_unit": str(hub_config['memory_unit']) }
            
        except Exception as err:
            logging.info("--- Invalid Config ---")
            logging.debug(err)
            return None  
        
       
        try:        
            crud_cr.create_or_update_session(db, str(session_uuid), str(hub_id), str(session_key_hash), session_end_aware, str(available[:-1]), "behdata")
            crud_cr.create_or_update_config(db, hub_id, config)

        except SQLAlchemyError as e:
            db.rollback() # Rollback on any database error during the demo
            logging.error(f"--- SQLAlchemy Error Occurred ---")
            logging.error(e)
            logging.error("Transaction rolled back.")
            return None
        except Exception as e:
            # Catch other potential errors
            logging.error(f"\n--- Database proccessing Failed. For more info look into logs ---")
            logging.error(e, exc_info=True)
            return None

        return "OK", session_uuid, session_key
    
    except Exception as err:
        logging.error(f"Creating session failed, :{err}")
        return None
    

def session_entry_valid(db: Session, session_id, provided_key):
    """
    Check if session exists and returns boolean
    
    Args:
        session_id (str): searched session_id
        key (str): validated key
    
    Using:
        os, logging, bcrypt, time

        db_man.pqsql.engine:  session_clientmodifier()   
        db_man.pqsql.models: Session_auth()
    Returns:
        Bool - returns status 
    """
    logging.info("--- Checking session status ---")

    try:
        # Assuming this returns a SessionAuth object or None
        session_object = crud_read.get_valid_session(db, session_id=session_id)

        if session_object:
            logging.debug(" Session found ")

    
            hashed_key = session_object.session_key_hash # Use attribute access

            # Add check if hash exists
            if not hashed_key:
                 logging.error(f"Session {session_id} found, but session_key_hash is missing.")
                 return False

            check_status = bcrypt.checkpw(provided_key.encode("utf-8"), hashed_key.encode("utf-8"))
            if check_status:
                logging.info("--- Check successful ---")
                return True
            else:
                logging.info("--- Check Failed: Invalid Key ---")
                return False
        else:
             logging.info(f"--- Session {session_id} not found or invalid ---")
             return False
    

    except SQLAlchemyError as e:
        db.rollback() # Rollback on any database error during the demo
        logging.error(f"--- SQLAlchemy Error Occurred ---")
        logging.error(e)
        logging.error("Transaction rolled back.")
        return False
    except Exception as e:
        # Catch other potential errors
        logging.error(f"\n--- An Unexpected Error Occurred ---")
        logging.error(e)
        return False
        
