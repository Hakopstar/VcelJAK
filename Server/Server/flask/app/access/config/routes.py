# app/server_config/routes.py
import logging
import json
import bcrypt # For password hashing
import os # Import os for path handling

from flask import jsonify, abort, request, current_app # Import current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import delete
from sqlalchemy.orm import Session # Import Session for type hint
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.dep_lib import measurement_config, system_config
from typing import List, Optional, Any, Dict

# Import the blueprint object
# Assuming you have app/config/__init__.py with:
# from flask import Blueprint
# server_config_bp = Blueprint('server_config', __name__, url_prefix='/access/config')
# from . import routes
from . import server_config_bp # Make sure this import works

# Import necessary models
from app.db_man.pqsql.models import ServerConfig, User # Adjust path if needed

# Import the request-scoped session factory
from app import DbRequestSession # Assuming DbRequestSession is in app's root __init__

# --- IMPORT CACHE INVALIDATION FUNCTION ---
from app.cache.database_caching import invalidate_server_config_cache # Adjust path if needed
# ----------------------------------------


CONFIGS_PATH = os.getenv('configs_path')
# --- Helper Functions ---

def _flatten_config(config_dict: dict) -> dict:
    """Flattens the nested config dict into key-value pairs for DB storage."""
    flat_config = {}
    # Handle measurements separately due to triple nesting
    if "measurements" in config_dict and isinstance(config_dict["measurements"], dict):
        for m_type, settings in config_dict["measurements"].items():
            if isinstance(settings, dict):
                for setting_key, value in settings.items():
                    # Store value as string for DB consistency
                    flat_config[f"measurements_{m_type}_{setting_key}"] = str(value)
            else:
                logging.warning(f"Unexpected structure for measurement {m_type}. Skipping.")

    # Handle system settings
    if "system" in config_dict and isinstance(config_dict["system"], dict):
        for key, value in config_dict["system"].items():
             # Don't save the temporary reset flag
             if key == "config_reset":
                 continue
             flat_config[f"system_{key}"] = str(value)

    return flat_config


def _parse_db_value(value_str: Optional[str]) -> Any:
    """
    Converts a string value from the DB to an appropriate Python type.
    Handles None, 'NULL', boolean strings, integers, and floats.
    """
    if value_str is None or value_str.strip().upper() == 'NULL' or value_str.strip() == '':
        return None
    
    val_lower = value_str.lower()
    if val_lower == 'true':
        return True
    if val_lower == 'false':
        return False
    
    try:
        return int(value_str)
    except ValueError:
        try:
            return float(value_str)
        except ValueError:
            return value_str # Keep as string if all conversions fail

def _reconstruct_config(flat_rows: List[Any]) -> Dict[str, Dict[str, Any]]: # Changed to List[Any] for flexibility
    """
    Reconstructs the nested config dict from flat DB rows.
    The structure is derived entirely from the data in flat_rows.
    No predefined 'expected_measurements' or 'expected_system' is used.
    Uses getattr for safer access to potentially missing optional attributes.
    """
    reconstructed: Dict[str, Dict[str, Any]] = {"measurements": {}, "system": {}}

    if not flat_rows:
        logging.info("No configuration rows provided; returning empty structure.")
        return reconstructed

    for row in flat_rows:
        try:
            config_name = getattr(row, 'config_name', None) # Required, but good practice
            if not config_name:
                logging.warning("Skipping row with missing 'config_name'. Row data: %s", getattr(row, '__dict__', str(row)))
                continue

            measurement_props = {}
            is_measurement_definition_row = False

            # Safely access optional attributes using getattr
            units_str = getattr(row, 'units', None)
            lowest_str = getattr(row, 'lowest_acceptable', None)      # CORRECTED
            highest_str = getattr(row, 'highest_acceptable', None)   # CORRECTED
            accuracy_str = getattr(row, 'accuracy', None)
            value_str = getattr(row, 'value', None)

            # Check for measurement-specific fields
            units_val = _parse_db_value(units_str)
            if units_val is not None:
                measurement_props['unit'] = units_val
                is_measurement_definition_row = True

            lowest_val = _parse_db_value(lowest_str)
            if lowest_val is not None:
                measurement_props['lowest'] = lowest_val
                is_measurement_definition_row = True

            highest_val = _parse_db_value(highest_str)
            if highest_val is not None:
                measurement_props['highest'] = highest_val
                is_measurement_definition_row = True
            
            if accuracy_str is not None and accuracy_str.strip().upper() != 'NULL' and accuracy_str.strip() != '':
                try:
                    measurement_props['decimalPlaces'] = int(accuracy_str)
                    is_measurement_definition_row = True
                except ValueError:
                    logging.warning(
                        f"Could not convert accuracy '{accuracy_str}' to int for config_name '{config_name}'. "
                    )

            # Check for a general 'value' (typically for system settings)
            system_value = _parse_db_value(value_str)

            if is_measurement_definition_row:
                if config_name not in reconstructed['measurements']:
                    reconstructed['measurements'][config_name] = {}
                reconstructed['measurements'][config_name].update(measurement_props)
                
                # If a measurement definition row ALSO has a 'value' from the DB's 'value' column,
                # and you want to store it specifically with the measurement (e.g., as a reading or default),
                # you can add it here. For example:
                # if system_value is not None:
                #     reconstructed['measurements'][config_name]['current_reading'] = system_value # Or some other meaningful key

            elif system_value is not None:
                # This row is not primarily defining measurement properties based on units/min/max/accuracy,
                # but has a specific 'value'. Treat as a system setting.
                reconstructed['system'][config_name] = system_value
            else:
                # This row has no measurement-defining properties and no 'value'.
                # It might be a config_name that's just a placeholder or an incomplete entry.
                # If it's desirable to always list any config_name found, even if empty:
                if config_name not in reconstructed['measurements'] and config_name not in reconstructed['system']:
                     reconstructed['measurements'][config_name] = {} # Add as an empty measurement entry
                     logging.debug(
                        f"Config_name '{config_name}' has no defined measurement properties or system value. "
                        "Added as an empty entry in 'measurements'."
                    )
                else:
                    logging.debug(
                        f"Config_name '{config_name}' has no new measurement properties or system value to add. "
                        "It might already exist or is truly empty."
                    )

        except AttributeError as ae: # Should be less likely with getattr, but good as a fallback
            logging.error(
                f"Unexpected AttributeError. Problematic row data: {getattr(row, '__dict__', str(row))}. Error: {ae}",
                exc_info=True
            )
        except Exception as e:
            row_config_name = getattr(row, 'config_name', 'N/A')
            logging.error(
                f"Error reconstructing config for DB row with config_name '{row_config_name}': {e}",
                exc_info=True
            )
            
    return reconstructed

# --- Default Config Loading Function ---
def _load_default_config() -> dict:
    """Loads the default configuration from a JSON file."""
    try:
        # Prioritize instance folder, fallback to app folder
        instance_path = os.path.join(CONFIGS_PATH, 'default_config.json')
        app_path = os.path.join(CONFIGS_PATH, 'default_config.json')

        config_path = instance_path if os.path.exists(instance_path) else app_path

        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Default config not found at {instance_path} or {app_path}")

        with open(config_path, 'r') as f:
            default_config = json.load(f)
            logging.info(f"Loaded default configuration from {config_path}")
            return default_config
    except FileNotFoundError as e:
         logging.error(str(e))
         raise RuntimeError("Server error: Default configuration file missing.") from e
    except json.JSONDecodeError as e:
         logging.error(f"Error decoding default configuration file {config_path}: {e}")
         raise RuntimeError("Server error: Default configuration file is invalid.") from e
    except Exception as e:
         logging.error(f"Error loading default configuration file {config_path}: {e}", exc_info=True)
         raise RuntimeError("Server error: Could not load default configuration.") from e


# --- Routes ---

# Corrected route path relative to blueprint prefix '/access/config'
@server_config_bp.route('/get_config', methods=['GET'])
@jwt_required()
def get_config():
    """Gets the current server configuration."""
    logging.info(f"Request received for GET {server_config_bp.url_prefix}/get_config")
    db: Session = DbRequestSession()
    try:
        config_rows = db.query(ServerConfig).all()
        current_config = _reconstruct_config(config_rows)
        logging.info(f"Returning current server configuration via {server_config_bp.name}.")
        return jsonify(current_config), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error fetching server config: {e}", exc_info=True)
        abort(500, description="Failed to retrieve server configuration.")
    except Exception as e:
        logging.error(f"Unexpected error fetching server config: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred retrieving server configuration.")


# Corrected route path relative to blueprint prefix '/access/config'
@server_config_bp.route('/update_config', methods=['POST'])
@jwt_required()
def update_config():
    logging.info(f"Request received for POST {server_config_bp.url_prefix}/update_config")
    db: Session = DbRequestSession()
    incoming_config = request.get_json() # This is what frontend sends {measurements: ..., system: ...}
    rc = current_app.redis_client

    if not incoming_config:
        abort(400, description="Missing JSON body in request.")

    # This map is for translating keys from incoming_config.system (frontend)
    # to database config_names for system settings.
    FE_TO_DB_SYSTEM_KEY_MAP = {
        "autoBackup": "automatic",
        "backupFrequency": "backup_interval",
        "numberPrecision": "number_precision",
        "hardwareSessionExpire": "hardware_session_expire",
        "firstInit": "first_init",
        # Add any other system key mappings here
    }

    is_reset = False
    if isinstance(incoming_config.get("system"), dict): # Check the incoming payload from frontend
        reset_flag = incoming_config["system"].get("config_reset")
        is_reset = str(reset_flag).lower() == 'true'

    try:
        if is_reset:
            logging.info("Resetting server configuration to defaults from file.")
            # DEFAULT_SERVER_CONFIG is your flat structure from the JSON file you provided
            DEFAULT_SERVER_CONFIG = _load_default_config() 
            
            logging.debug("Deleting ALL existing config rows from ServerConfig table.")
            db.execute(delete(ServerConfig)) # Clears the table

            new_config_rows_count = 0
            # Iterate through the top-level keys of your default_config.json
            for config_key, settings in DEFAULT_SERVER_CONFIG.items():
                if not isinstance(settings, dict):
                    logging.warning(f"Skipping non-dictionary item '{config_key}' in default_config.json")
                    continue

                db_row = ServerConfig(config_name=config_key)

                # Check if it's a system-style setting (has a "value" key directly)
                if "value" in settings:
                    db_row.value = str(settings["value"]) if settings["value"] is not None else None
                    # For system settings, other columns (units, lowest, etc.) are usually NULL
                # Else, assume it's a measurement-style setting
                else:
                    db_row.units = str(settings.get("units")) if settings.get("units") is not None else None
                    db_row.lowest_acceptable = str(settings.get("lowest_acceptable")) if settings.get("lowest_acceptable") is not None else None
                    db_row.highest_acceptable = str(settings.get("highest_acceptable")) if settings.get("highest_acceptable") is not None else None
                    db_row.accuracy = str(settings.get("accuracy")) if settings.get("accuracy") is not None else None
                    # db_row.value is typically NULL for these measurement definition rows

                db.add(db_row)
                new_config_rows_count += 1
            
            logging.info(f"Added {new_config_rows_count} default configuration rows after reset.")

        else: # --- Regular Update Logic ---
            logging.info("Updating server configuration.")
            
            # Process Measurements from incoming_config (frontend structure)
            if "measurements" in incoming_config and isinstance(incoming_config["measurements"], dict):
                for m_type, settings in incoming_config["measurements"].items():
                    if not isinstance(settings, dict):
                        logging.warning(f"Skipping malformed measurement settings for {m_type}")
                        continue
                    
                    db_row = db.query(ServerConfig).filter_by(config_name=m_type).first()
                    if not db_row:
                        db_row = ServerConfig(config_name=m_type)
                        db.add(db_row)
                    
                    # Frontend sends "unit", "lowest", "highest", "decimalPlaces"
                    if "unit" in settings:
                        db_row.units = str(settings["unit"]) if settings["unit"] is not None else None
                    if "lowest" in settings:
                        db_row.lowest_acceptable = str(settings["lowest"]) if settings["lowest"] is not None else None
                    if "highest" in settings:
                        db_row.highest_acceptable = str(settings["highest"]) if settings["highest"] is not None else None
                    if "decimalPlaces" in settings:
                        db_row.accuracy = str(settings["decimalPlaces"]) if settings["decimalPlaces"] is not None else None

            # Process System Settings from incoming_config (frontend structure)
            if "system" in incoming_config and isinstance(incoming_config["system"], dict):
                for fe_key, value in incoming_config["system"].items(): # fe_key is camelCase from frontend
                    if fe_key == "config_reset": continue

                    # Map frontend camelCase key to database snake_case/actual key
                    db_key = FE_TO_DB_SYSTEM_KEY_MAP.get(fe_key, fe_key) 
                    
                    db_row = db.query(ServerConfig).filter_by(config_name=db_key).first()
                    if not db_row:
                        db_row = ServerConfig(config_name=db_key)
                        db.add(db_row)
                    
                    db_row.value = str(value) if value is not None else None
        
        # Commit changes for either reset or update
        db.commit()
        if rc:
            invalidate_server_config_cache(rc)
        action_msg = "reset to defaults" if is_reset else "updated"
        logging.info(f"Server configuration successfully {action_msg}.")
        return jsonify({"msg": f"Server configuration successfully {action_msg}."}), 200

    # ... (exception handling remains the same) ...
    except RuntimeError as e: 
        db.rollback()
        logging.error(f"Runtime error processing server config: {e}", exc_info=True)
        abort(500, description=str(e))
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error updating server config: {e}", exc_info=True)
        abort(500, description="Failed to update server configuration due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating server config: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred updating server configuration.")


# Corrected route path relative to blueprint prefix '/access/config'
@server_config_bp.route('/change_password', methods=['POST'])
@jwt_required()
def change_password():
    """Changes the logged-in web user's password."""
    logging.info(f"Request received for POST {server_config_bp.url_prefix}/change_password")
    db: Session = DbRequestSession()
    data = request.get_json()

    # Frontend sends 'user', but we should use the identity from the JWT token
    # required_fields = ['old_password', 'new_password', 'user'] # Don't rely on user from FE
    required_fields = ['old_password', 'new_password']
    if not data or any(field not in data for field in required_fields):
        abort(400, description=f"Missing required fields: {', '.join(required_fields)}.")

    old_password = data['old_password']
    new_password = data['new_password']
    # username_from_fe = data.get('user') # We won't use this

    if len(new_password) < 8: # Example basic check
         abort(400, description="New password must be at least 8 characters long.")

    # --- Use JWT Identity ---
    current_user_id = get_jwt_identity()
    if not current_user_id:
        # This should ideally not happen if @jwt_required() is working
        logging.error("JWT identity missing despite @jwt_required decorator.")
        abort(401, description="Authentication token is invalid or missing user identity.")
    # -----------------------

    try:
        # Find user by ID obtained from JWT
        user = db.get(User, current_user_id)
        if not user:
            logging.error(f"User '{current_user_id}' from valid JWT not found in database!")
            abort(404, description="User associated with token not found.")

        stored_hash_bytes = user.client_hash.encode('utf-8')
        old_password_bytes = old_password.encode('utf-8')

        # Verify old password
        if not bcrypt.checkpw(old_password_bytes, stored_hash_bytes):
            logging.warning(f"Incorrect old password provided for user '{current_user_id}'.")
            abort(401, description="Incorrect old password.") # Use 401 Unauthorized

        # Hash the new password
        new_salt = bcrypt.gensalt()
        new_hash_bytes = bcrypt.hashpw(new_password.encode('utf-8'), new_salt)
        user.client_hash = new_hash_bytes.decode('utf-8') # Store new hash as string

        db.commit()
        logging.info(f"Password successfully changed for user '{current_user_id}'.")
        return jsonify({"msg": "Password changed successfully."}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error changing password for user '{current_user_id}': {e}", exc_info=True)
        abort(500, description="Failed to change password due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error changing password for user '{current_user_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while changing password.")