####################################################
# Create and Update - Session management
# Last version of update: v0.95
# app/db_man/pqsql/createupdate.py
####################################################
# 
#    
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db_man.pqsql.models import Config, AvailableSensorsDatabase, SessionAuth 
from datetime import date, datetime, timezone

# Define required keys outside the function if they are static
REQUIRED_CONFIG_UNITS = [
    'system_time_unit', 'temperature_unit', 'pressure_unit', 'voltage_unit',
    'power_unit', 'speed_unit', 'weight_unit', 'sound_pressure_level_unit',
    'network_strength_unit', 'memory_unit'
]
# Define the mapping for the column name typo if needed elsewhere
COLUMN_NAME_MAPPING = {"network_strenght_unit": "network_strength_unit"}



def create_or_update_session(db: Session, session_id: str, client_id: str, session_key_hash: str, session_end, available: str, system_privileges: str = '') -> SessionAuth:
    """Creates a new session or updates an existing one."""
    # Ensure SENSOR CLIENT SYSTEM exists

    if not db.get(AvailableSensorsDatabase, client_id):
        logging.warning(f"Client_id '{client_id}' not found in the database")
        raise ValueError(f"Sensor Client System with client_id {client_id} not found.")
    logging.debug(f"session end: {session_end}")
    # Ensure session_end is timezone-aware
    if session_end.tzinfo is None:
        session_end = session_end.replace(tzinfo=timezone.utc)

    # --- Check if session already exists ---
    existing_session = db.get(SessionAuth, session_id)

    if existing_session:
        logging.info(f"Session {session_id} already exists. Updating.")
        # --- Update existing session ---
        existing_session.client_id = client_id # Or maybe raise error if client_id changes?
        existing_session.session_key_hash = session_key_hash
        existing_session.session_end = session_end
        existing_session.available = available
        existing_session.system_privileges = system_privileges
        db_session = existing_session # Use the existing object
    else:
        # --- Create new session ---
        logging.info(f"Creating new session {session_id}.")
        db_session = SessionAuth(
            session_id=session_id,
            client_id=client_id,
            session_key_hash=session_key_hash,
            session_end=session_end,
            available=available,
            system_privileges=system_privileges
        )
        db.add(db_session)

    try:
        db.commit()
        db.refresh(db_session) # Refresh works for both added and updated objects
        return db_session
    except IntegrityError as e: # Catch potential race conditions or other integrity issues
        db.rollback()
        logging.error(f"Database integrity error during session commit for {session_id}: {e}")
        raise # Re-raise the exception after logging and rollback
    except Exception as e: # Catch other potential errors during commit/refresh
        db.rollback()
        logging.error(f"Unexpected error during session commit for {session_id}: {e}")
        raise

def create_or_update_config(db: Session, client_id: str, config_data: Dict[str, Any]) -> Config:
    """
    Creates or updates a configuration entry for a sensor client system.

    If a config for the client_id exists, it updates the fields provided
    in config_data. Otherwise, it creates a new config entry.

    Args:
        db: The SQLAlchemy Session object.
        client_id: The ID of the sensor client system.
        config_data: A dictionary containing the configuration key-value pairs.
                     Must include all required unit fields if creating.
                     Can include a subset for updating.

    Returns:
        The created or updated Config object.

    Raises:
        ValueError: If client_id is not found, or if config_data is invalid
                    (missing keys on create, extra keys).
        IntegrityError: If a database constraint occurs during commit (should be rare with checks).
        Exception: For other unexpected errors during commit/refresh.
    """
    # --- 1. Ensure SENSOR CLIENT SYSTEM exists ---
    if not db.get(AvailableSensorsDatabase, client_id):
        logging.warning(f"Attempted config operation for non-existent client_id: {client_id}")
        raise ValueError(f"Sensor Client System with client_id {client_id} not found.")

    # --- 2. Pre-process and Validate config_data ---
    processed_config_data = config_data.copy() # Work on a copy

    # Handle potential input typo - map to correct model attribute name
    for incoming_key, correct_key in COLUMN_NAME_MAPPING.items():
        if incoming_key in processed_config_data and correct_key not in processed_config_data:
             processed_config_data[correct_key] = processed_config_data.pop(incoming_key)
             logging.debug(f"Mapped input key '{incoming_key}' to '{correct_key}' for {client_id}")

    allowed_keys = set(REQUIRED_CONFIG_UNITS)
    provided_keys = set(processed_config_data.keys())

    # Check for unexpected keys
    extra_keys = provided_keys - allowed_keys
    if extra_keys:
         logging.warning(f"Unexpected config keys provided for {client_id}: {extra_keys}")
         raise ValueError(f"Unexpected config keys provided: {', '.join(extra_keys)}")

    # --- 3. Check if Config already exists ---
    existing_config = db.get(Config, client_id)

    if existing_config:
        # --- 4a. Update Existing Config ---
        logging.info(f"Config for client_id {client_id} exists. Updating.")
        updated = False
        for key, value in processed_config_data.items():
            if getattr(existing_config, key) != value:
                setattr(existing_config, key, value)
                updated = True
                logging.debug(f"Updating config field '{key}' for {client_id}")
        if not updated:
             logging.info(f"No changes detected for existing config {client_id}.")
        db_config = existing_config # Use the existing object

    else:
        # --- 4b. Create New Config ---
        logging.info(f"Config for client_id {client_id} not found. Creating new entry.")
        # Ensure all required keys are present for creation
        missing_keys = allowed_keys - provided_keys
        if missing_keys:
            logging.warning(f"Missing required config keys for new config {client_id}: {missing_keys}")
            raise ValueError(f"Missing required config keys for creation: {', '.join(missing_keys)}")

        db_config = Config(client_id=client_id, **processed_config_data)
        db.add(db_config)

    # --- 5. Commit, Refresh, Return ---
    try:
        db.commit()
        logging.info(f"Successfully committed config for client_id {client_id}.")
        db.refresh(db_config)
        return db_config
    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error during config commit for {client_id}: {e}", exc_info=True)
        # This might happen in a race condition if another process created the config
        # between the db.get() check and db.commit()
        raise # Re-raise the original error after logging and rollback
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error during config commit/refresh for {client_id}: {e}", exc_info=True)
        raise # Re-raise

    