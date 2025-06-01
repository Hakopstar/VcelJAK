      
# app/sensors_hubs/routes.py
import logging
from flask import jsonify, current_app, request # Import request for force_refresh
from flask_jwt_extended import jwt_required

# Import the blueprint
# Assuming __init__.py defines:
# from flask import Blueprint
# sensorhubs_bp = Blueprint('sensors_hubs', __name__, url_prefix='/access/sensors_hubs')
# from . import routes
from . import sensorhubs_bp # Make sure this matches your __init__.py

# Import shared components
from app import DbRequestSession # Scoped session from main app factory
try:
    # Assuming inventory_service is moved to app.services
    from app.services.inventory_service import get_sensors, get_hubs
except ImportError:
    # Fallback if inventory_service is at the top level
    from inventory_service import get_sensors, get_hubs

# --- Route to List Sensors ---
# Path changed to match frontend API call: /access/sensors_hubs/get_info_sensors
@sensorhubs_bp.route('/get_info_sensors', methods=['GET']) # ROUTE PATH CHANGED
@jwt_required()
def list_sensors_endpoint():
    logging.debug(f"Request received for GET {sensorhubs_bp.url_prefix}/get_info_sensors") # Log correct path
    rc = current_app.redis_client
    db = DbRequestSession()
    try:
        # Optional: Check for force_refresh query parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        if force_refresh:
            logging.info(f"Cache refresh forced for {sensorhubs_bp.url_prefix}/get_info_sensors")

        # Call the service function (which includes caching logic)
        sensors_list = get_sensors(db=db, rc=rc, force_refresh=force_refresh)

        logging.info(f"Returning {len(sensors_list)} sensors via {sensorhubs_bp.name} blueprint.")
        logging.info(sensors_list)
        # Frontend expects a direct list
        return jsonify(sensors_list), 200
    except Exception as e:
        # Avoid leaking detailed errors in production if possible
        logging.error(f"Error fetching sensor list via {sensorhubs_bp.name}: {e}", exc_info=True)
        # Ensure session is removed in case of error
        DbRequestSession.remove()
        return jsonify({"error": "Failed to retrieve sensor list"}), 500
    # No finally needed, teardown context handles session removal

# --- Route to List Hubs ---
# Path changed to match frontend API call: /access/sensors_hubs/get_hub_info
@sensorhubs_bp.route('/get_hub_info', methods=['GET']) # ROUTE PATH CHANGED
@jwt_required()
def list_hubs_endpoint():
    logging.debug(f"Request received for GET {sensorhubs_bp.url_prefix}/get_hub_info") # Log correct path
    rc = current_app.redis_client
    db = DbRequestSession()
    try:
         # Optional: Check for force_refresh query parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        if force_refresh:
            logging.info(f"Cache refresh forced for {sensorhubs_bp.url_prefix}/get_hub_info")

        # Call the service function (which includes caching logic)
        hubs_list = get_hubs(db=db, rc=rc, force_refresh=force_refresh)

        logging.info(f"Returning {len(hubs_list)} hubs via {sensorhubs_bp.name} blueprint.")
         # Frontend expects a direct list
        
        return jsonify(hubs_list), 200
    except Exception as e:
        logging.error(f"Error fetching hub list via {sensorhubs_bp.name}: {e}", exc_info=True)
        DbRequestSession.remove() # Ensure removal on error
        return jsonify({"error": "Failed to retrieve hub list"}), 500
    # No finally needed

    