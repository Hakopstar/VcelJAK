# app/hub_management/routes.py
import logging
import bcrypt
import secrets
import uuid # To generate unique hub IDs

from flask import jsonify, abort, request, current_app # Import current_app
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from flask_jwt_extended import jwt_required

# Import the blueprint object
from . import hub_management_bp

# Import necessary model
from app.db_man.pqsql.models import AvailableSensorsDatabase

# Import the request-scoped session factory
from app import DbRequestSession

# --- IMPORT SERVICE & CACHE FUNCTIONS ---
# Import the service function to get formatted hub list
from app.services.inventory_service import get_hubs, invalidate_inventory_cache
# Import cache invalidation for config (when hub is deleted)
from app.cache.database_caching import invalidate_hub_config_cache
# -----------------------------------------
from app.helpers.formatters import _format_hub_details_basic

# --- Hub Management Routes ---

@hub_management_bp.route('/get_hub_info', methods=['GET'])
@jwt_required()
def get_hub_info():
    """Gets the list of all hubs with details using the inventory service."""
    logging.info(f"Request received for GET {hub_management_bp.name}.get_hub_info")
    db = DbRequestSession()
    rc = current_app.redis_client
    try:
        # Use the dedicated service function which handles formatting and caching
        hubs_list = get_hubs(db, rc)
        logging.info(f"Returning {len(hubs_list)} hubs via inventory service.")
        # Ensure the service function returns 'uuid' key
        # If get_hubs returns 'id', we need to map it here:
        hubs_list_mapped = [{**hub, 'uuid': hub.pop('id')} for hub in hubs_list if 'id' in hub]
        return jsonify(hubs_list_mapped), 200
        # Assuming get_hubs can be updated or already returns 'uuid'
        #return jsonify(hubs_list), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error calling get_hubs: {e}", exc_info=True)
        abort(500, description="Failed to retrieve hub list due to database error.")
    except Exception as e:
        logging.error(f"Unexpected error calling get_hubs: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving hub list.")

@hub_management_bp.route('/new_hub', methods=['POST'])
@jwt_required()
def add_hub():
    """Creates a new hub and generates its initial secret key."""
    logging.info(f"Request received for POST {hub_management_bp.name}.new_hub")
    db = DbRequestSession()
    rc = current_app.redis_client # Get Redis client
    data = request.get_json()

    if not data or not data.get('name'):
        abort(400, description="Missing required field: 'name'.")

    hub_name = data['name']
    # Generate unique ID (this will be the client_id in DB and uuid for frontend)
    hub_uuid = str(uuid.uuid4())
    secret_key = secrets.token_urlsafe(32)

    try:
        hashed_key_bytes = bcrypt.hashpw(secret_key.encode('utf-8'), bcrypt.gensalt())
        hashed_key_str = hashed_key_bytes.decode('utf-8')

        new_hub = AvailableSensorsDatabase(
            client_id=hub_uuid, # Use generated uuid as client_id
            client_name=hub_name,
            client_key_hash=hashed_key_str,
            client_active=True,
            client_access_key=hub_uuid # Example: Use uuid as access key too
        )
        db.add(new_hub)
        db.commit()
        # --- INVALIDATE CACHE ---
        invalidate_inventory_cache(rc) # Invalidate general hub list
        # ------------------------
        db.refresh(new_hub)
        logging.info(f"Successfully created hub: UUID='{new_hub.client_id}', Name='{new_hub.client_name}'")

        # Use the updated helper for response
        response_data = {
            "hub": _format_hub_details_basic(new_hub), # Ensures 'uuid' key is present
            "key": secret_key
        }
        return jsonify(response_data), 201

    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error creating hub '{hub_name}': {e}", exc_info=True)
        abort(409, description=f"Could not create hub. A hub with conflicting details might already exist.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error creating hub '{hub_name}': {e}", exc_info=True)
        abort(500, description="Failed to create hub due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Error during hub creation or cache invalidation for '{hub_name}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while creating the hub.")


@hub_management_bp.route('/rename_hub', methods=['POST'])
@jwt_required()
def rename_hub():
    """Renames an existing hub."""
    logging.info(f"Request received for POST {hub_management_bp.name}.rename_hub")
    db = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    # Expect 'uuid' from frontend now
    if not data or not data.get('uuid') or not data.get('name'):
        abort(400, description="Missing required fields: 'uuid', 'name'.")

    hub_uuid = data['uuid']
    new_name = data['name']

    try:
        # Lookup hub by client_id (which is the uuid)
        existing_hub = db.get(AvailableSensorsDatabase, hub_uuid)

        if not existing_hub:
            logging.warning(f"Attempted to rename non-existent hub: {hub_uuid}")
            abort(404, description=f"Hub with UUID '{hub_uuid}' not found.")

        existing_hub.client_name = new_name
        db.commit()
        # --- INVALIDATE CACHE ---
        invalidate_inventory_cache(rc) # Invalidate general hub list
        # ------------------------
        logging.info(f"Successfully renamed hub: UUID='{existing_hub.client_id}' to '{new_name}'")
        return jsonify({"msg": "Hub renamed successfully."}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error renaming hub '{hub_uuid}': {e}", exc_info=True)
        abort(500, description="Failed to rename hub due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Error during hub rename or cache invalidation for '{hub_uuid}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while renaming the hub.")


@hub_management_bp.route('/delete_hub', methods=['POST']) # Frontend uses POST
@jwt_required()
def delete_hub():
    """Deletes an existing hub."""
    logging.info(f"Request received for POST {hub_management_bp.name}.delete_hub")
    db = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    # Expect 'uuid' from frontend now
    if not data or not data.get('uuid'):
        abort(400, description="Missing required field: 'uuid'.")

    hub_uuid = data['uuid']

    try:
        # Lookup hub by client_id (which is the uuid)
        existing_hub = db.get(AvailableSensorsDatabase, hub_uuid)

        if not existing_hub:
            logging.warning(f"Attempted to delete non-existent hub: {hub_uuid}")
            abort(404, description=f"Hub with UUID '{hub_uuid}' not found.")

        db.delete(existing_hub)
        db.commit()
        # --- INVALIDATE CACHES ---
        # Use the actual client_id (hub_uuid) for invalidation
        invalidate_inventory_cache(rc, client_id=hub_uuid)
        invalidate_hub_config_cache(rc, hub_uuid)
        # -------------------------
        logging.info(f"Successfully deleted hub: UUID='{hub_uuid}'")
        return jsonify({"msg": "Hub deleted successfully."}), 200

    except IntegrityError as e:
         db.rollback()
         logging.error(f"Database integrity error deleting hub '{hub_uuid}': {e}", exc_info=True)
         if "foreign key constraint" in str(e).lower():
              abort(409, description=f"Cannot delete hub '{hub_uuid}' because it still has associated sensors. Please reassign or delete sensors first.")
         else:
              abort(500, description="Failed to delete hub due to database integrity error.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error deleting hub '{hub_uuid}': {e}", exc_info=True)
        abort(500, description="Failed to delete hub due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Error during hub deletion or cache invalidation for '{hub_uuid}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while deleting the hub.")


@hub_management_bp.route('/change_api_key', methods=['POST'])
@jwt_required()
def change_hub_key():
    """Generates and saves a new secret key for a hub."""
    logging.info(f"Request received for POST {hub_management_bp.name}.change_api_key")
    db = DbRequestSession()
    data = request.get_json()

    # Expect 'uuid' from frontend now
    if not data or not data.get('uuid'):
        abort(400, description="Missing required field: 'uuid'.")

    hub_uuid = data['uuid']

    try:
        # Lookup hub by client_id (which is the uuid)
        existing_hub = db.get(AvailableSensorsDatabase, hub_uuid)

        if not existing_hub:
            logging.warning(f"Attempted to change key for non-existent hub: {hub_uuid}")
            abort(404, description=f"Hub with UUID '{hub_uuid}' not found.")

        new_secret_key = secrets.token_urlsafe(32)
        new_hashed_key_bytes = bcrypt.hashpw(new_secret_key.encode('utf-8'), bcrypt.gensalt())
        new_hashed_key_str = new_hashed_key_bytes.decode('utf-8')

        existing_hub.client_key_hash = new_hashed_key_str
        db.commit()
        logging.info(f"Successfully generated and saved new key for hub: UUID='{existing_hub.client_id}'")
        return jsonify({"key": new_secret_key}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error changing key for hub '{hub_uuid}': {e}", exc_info=True)
        abort(500, description="Failed to change hub key due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Error changing key for hub '{hub_uuid}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while changing the hub key.")