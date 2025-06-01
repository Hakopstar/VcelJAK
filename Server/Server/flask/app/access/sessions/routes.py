# app/sessions/routes.py  (or potentially app/hub_sessions/routes.py depending on your exact naming)
import logging
from datetime import datetime, timezone

from flask import jsonify, abort, request # Import request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, Session # Import Session for type hint
from flask_jwt_extended import jwt_required

import os 
# Import the blueprint object we defined in __init__.py
# Make sure this import matches your file structure (e.g., from app.sessions import hub_sessions_bp)
from . import hub_sessions_bp # Assuming the blueprint is named hub_sessions_bp

# Import necessary models from the central location
from app.db_man.pqsql.models import SessionAuth, AvailableSensorsDatabase # Adjust path if needed

# Import the request-scoped session factory from the main app
from app import DbRequestSession # Assuming DbRequestSession is in app's root __init__

# --- Hub Session Management Routes ---

@hub_sessions_bp.route('/get_sessions', methods=['GET']) # CHANGED ROUTE
@jwt_required() # Protect with JWT - assumes an admin/web user is logged in
def list_active_hub_sessions():
    """
    Lists all currently active hardware hub sessions, formatted for the frontend.
    Requires JWT authentication for a web user.
    """
    # Use blueprint name in logging for clarity
    logging.info(f"Request received for GET {hub_sessions_bp.name}/get_sessions")
    db: Session = DbRequestSession()
    active_sessions_list = []

    try:
        now_utc = datetime.now(timezone.utc)
        # Query SessionAuth joined with AvailableSensorsDatabase to get hub name
        # Filter for sessions that haven't expired yet
        active_sessions_orm = db.query(SessionAuth).options(
            joinedload(SessionAuth.client_system) # Eager load hub info
        ).filter(
            SessionAuth.session_end > now_utc
        ).order_by(
            SessionAuth.client_id, SessionAuth.session_end.desc() # Order for clarity
        ).all()

        for session in active_sessions_orm:
            hub_name = "Unknown Hub"
            # Safely access related object
            if session.client_system:
                 hub_name = session.client_system.client_name
            timestart = int((session.session_end.timestamp() - int(os.getenv("HARDWARE_SESSION_EXPIRE"))))
            logging.debug(f"start {timestart}")
            # *** MODIFIED RESPONSE FORMAT ***
            active_sessions_list.append({
                "id": session.session_id,              # Map session_id -> id
                "hubId": session.client_id,            # Map client_id -> hubId
                "hubName": hub_name,                   # Hub name from joinedload
                "startTime": (datetime.fromtimestamp(timestart, tz=timezone.utc).isoformat()),
                "endTime": session.session_end.isoformat() # Map session_end -> endTime (ISO format)
            })
            # *******************************

        logging.info(f"Returning {len(active_sessions_list)} active hub sessions via {hub_sessions_bp.name} blueprint.")
        # Frontend expects the list directly as the response
        return jsonify(active_sessions_list), 200

    except SQLAlchemyError as e:
        logging.error(f"Database error fetching active hub sessions via {hub_sessions_bp.name}: {e}", exc_info=True)
        abort(500, description="Failed to retrieve active sessions due to database error.")
    except Exception as e:
        logging.error(f"Unexpected error fetching active hub sessions via {hub_sessions_bp.name}: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving active sessions.")


# CHANGED ROUTE AND METHOD, REMOVED session_id from path param
@hub_sessions_bp.route('/terminate_session', methods=['POST'])
@jwt_required() # Protect with JWT
def terminate_hub_session():
    """
    Terminates (deletes) a specific hardware hub session by its ID provided in the JSON body.
    Requires JWT authentication for a web user.
    Expects JSON: {"sessionId": "..."}
    """
    logging.info(f"Request received for POST {hub_sessions_bp.name}/terminate_session") # Log correct path/method
    db: Session = DbRequestSession()
    data = request.get_json() # Get data from request body

    # *** VALIDATE INPUT FROM BODY ***
    if not data or not data.get('sessionId'):
        logging.warning(f"Missing 'sessionId' in request body for {hub_sessions_bp.name}/terminate_session")
        abort(400, description="Missing required field in JSON body: 'sessionId'.")

    session_id = data['sessionId'] # Extract session ID from body
    # *******************************

    try:
        # Find the session by its primary key (session_id)
        session_to_delete = db.get(SessionAuth, session_id)

        if not session_to_delete:
            logging.warning(f"Attempted to delete non-existent session: {session_id} via {hub_sessions_bp.name}")
            abort(404, description=f"Session with ID '{session_id}' not found.")

        hub_id_log = session_to_delete.client_id # Get hub_id before deleting
        # Delete the session object
        db.delete(session_to_delete)
        db.commit()
        logging.info(f"Successfully terminated session: {session_id} for hub {hub_id_log} via {hub_sessions_bp.name}")

        # Return 200 OK with a confirmation message (frontend seems to expect a successful response)
        return jsonify({"msg": f"Session '{session_id}' terminated successfully."}), 200
        # Or return 204 No Content:
        # return '', 204

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error terminating session '{session_id}' via {hub_sessions_bp.name}: {e}", exc_info=True)
        abort(500, description="Failed to terminate session due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error terminating session '{session_id}' via {hub_sessions_bp.name}: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while terminating the session.")