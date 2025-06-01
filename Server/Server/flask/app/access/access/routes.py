########################################################
# access/routes.py creating access calls to backend
# Last version of update: v0.95
# 
########################################################

import logging


from flask import Flask, render_template, request, json, jsonify, Response, flash, request, redirect, abort
from sqlalchemy.exc import SQLAlchemyError

from flask_jwt_extended import create_access_token
from flask_jwt_extended import get_jwt
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import jwt_required
from flask_jwt_extended import unset_jwt_cookies

from flask_jwt_extended import create_refresh_token

from app.access.access import access_bp

from app.db_man.pqsql.models import JwtBlocklist
from app.helpers.api import _validate_user_credentials
from app import DbRequestSession


@access_bp.route('/login', methods=['POST'])
def login():
    """Handles user login, validates credentials, and returns JWTs."""
    logging.info("Login request received.")
    json_data = request.get_json()
    if not json_data:
        abort(400, description="Request body must contain JSON data (client_id, password).")

    client_id = request.json.get("username", None)
    password = request.json.get("password", None)

    if not client_id or not password:
        abort(400, description="Missing 'client_id' or 'password' in request.")

    db = DbRequestSession() # Get request-scoped session
    try:
        # Call the validation helper
        if not _validate_user_credentials(db, client_id, password):
            logging.warning(f"Login attempt failed for user: {client_id}")
            abort(401, description="Invalid credentials.") # Unauthorized

        # Credentials are valid, create JWTs
        access_token = create_access_token(identity=client_id, fresh=True)
        logging.info(f"JWTs created successfully for user: {client_id}")

        response = jsonify({
            "message": "Login successful",
            "token": access_token, # Optionally return tokens in body
        })


        return response, 200

    except Exception as e:
        # Catch unexpected errors during login/token creation
        logging.error(f"Unexpected error during login for {client_id}: {e}", exc_info=True)
        abort(500, description="Internal server error during login.")


@access_bp.before_request
def log_request():
    logging.debug(f"Request to {request.path} with data: {request.data} and headers: {dict(request.headers)}")



@access_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logs out the user by adding the current token's JTI to the blocklist."""
    logging.info("Logout request received.")
    # Get the JTI (JWT ID) from the token used to make this request
    try:
        jwt_data = get_jwt()
        jti = jwt_data["jti"]
        token_type = jwt_data["type"] # 'access' or 'refresh'
        identity = get_jwt_identity() # Get user identity from token
        logging.debug(f"Attempting to revoke token: Type='{token_type}', JTI='{jti}', Identity='{identity}'")
    except Exception as e:
         logging.error(f"Error getting JWT data during logout: {e}", exc_info=True)
         abort(400, description="Invalid JWT data.")

    db = DbRequestSession()
    try:
        # Check if the token is already revoked
        existing = db.query(JwtBlocklist.id).filter_by(jti=jti).first()
        if existing:
            logging.warning(f"Logout attempt with already revoked token: JTI='{jti}'")
            # Optionally still unset cookies, but inform user token was already invalid
            response = jsonify(msg="Token already revoked.")
            unset_jwt_cookies(response)
            return response, 200 # Or maybe 400, depending on desired UX

        # Add JTI to blocklist database table
        # created_at is handled by default in the model/DB
        new_blocked_token = JwtBlocklist(jti=jti)
        db.add(new_blocked_token)
        db.commit()
        logging.info(f"Successfully added token to blocklist: JTI='{jti}'")

        response = jsonify({"msg": f"{token_type.capitalize()} token successfully revoked"})
        # Remove JWT cookies from the response
        unset_jwt_cookies(response)
        logging.debug("JWT cookies unset.")

        return response, 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error during logout for JTI '{jti}': {e}", exc_info=True)
        abort(500, description="Database error during logout process.")
    except Exception as e:
        db.rollback() # Rollback on any other unexpected error
        logging.error(f"Unexpected error during logout for JTI '{jti}': {e}", exc_info=True)
        abort(500, description="Internal server error during logout process.")
    # finally:
        # DbRequestSession.remove() # Handled by teardown context