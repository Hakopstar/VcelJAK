####################################
# Default api helper
# Last version of update: v0.95
# app/helpers/api.py
####################################

import secrets
import bcrypt
import logging
from sqlalchemy.orm import Session
from app.db_man.pqsql.models import User
from sqlalchemy.exc import SQLAlchemyError

def generate_api_key() -> tuple[str, bytes]:
    """Generates a secure API key and its bcrypt hash."""
    try:
        api_key = secrets.token_hex(32)
        hashed_key = bcrypt.hashpw(api_key.encode('utf-8'), bcrypt.gensalt())
        return (api_key, hashed_key)
    except Exception as e:
        logging.error(f"Error generating API key: {e}", exc_info=True)
        return None
    

# --- User Validation Helper ---
def _validate_user_credentials(db: Session, client_id: str, client_pass: str) -> bool:
    """
    Internal helper to validate client_id and password against the DB.

    Args:
        db: SQLAlchemy Session instance.
        client_id: The user identifier (username).
        client_pass: The plain text password to check.

    Returns:
        True if credentials are valid, False otherwise.
    """
    if not client_id or not client_pass:
        return False

    logging.debug(f"Attempting to validate user: {client_id}")
    try:
        
        user = db.get(User, client_id)
    
        if not user:
            logging.warning(f"Validation failed: User '{client_id}' not found.")
            return False

        logging.debug(f"User '{client_id}' found. Checking password...")
        # Check password using bcrypt
        # Ensure stored hash is bytes (decode from DB Text) and password is bytes
        stored_hash_bytes = user.client_hash.encode('utf-8')
        password_bytes = client_pass.encode('utf-8')

        is_valid = bcrypt.checkpw(password_bytes, stored_hash_bytes)
        if is_valid:
            logging.info(f"Password validation successful for user: {client_id}")
            return True
        else:
            logging.warning(f"Password validation failed for user: {client_id}")
            return False

    except SQLAlchemyError as e:
        # Handle potential database errors during query
        logging.error(f"Database error during user validation for '{client_id}': {e}", exc_info=True)
        return False # Treat DB errors as validation failure
    except Exception as e:
        # Catch unexpected errors (e.g., bcrypt issues)
        logging.error(f"Unexpected error during user validation for '{client_id}': {e}", exc_info=True)
        return False