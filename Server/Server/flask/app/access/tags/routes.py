# app/tags/routes.py
import logging
import re # For generating IDs if needed, although frontend sends it

from flask import jsonify, abort, request
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from flask_jwt_extended import jwt_required
from sqlalchemy import select

# Import the blueprint object
from . import tags_bp

# Import necessary model
from app.db_man.pqsql.models import Tag

# Import the request-scoped session factory
from app import DbRequestSession

from werkzeug.exceptions import HTTPException, BadRequest, NotFound, Conflict 






# --- Helper Function (Optional: Server-side ID generation if needed) ---
def _generate_tag_id(name: str) -> str:
    """Generates a likely unique ID from a tag name."""
    # Convert to lowercase
    s = name.lower()
    # Remove non-alphanumeric characters (allow hyphens)
    s = re.sub(r'[^\w\-]+', '', s)
    # Replace whitespace with hyphens
    s = re.sub(r'\s+', '-', s)
    # Remove leading/trailing hyphens
    s = s.strip('-')
    # Handle empty strings
    if not s:
        return f"tag-{hash(name)}" # Fallback using hash
    return s

def _check_if_allocated(tag_id: str) -> bool:
    """Checks if tag_id is in allocated ids, (0-255)"""
    try:
        # Attempt to convert the string to an integer.
        logging.debug(f"tag_id: {tag_id}")
        parts = tag_id.split('-', 1)  # Split only on the first hyphen
        if len(parts) > 1 and parts[0].isdigit():
            id_int = int(parts[0])
        else:
            logging.debug(f"Tag is not allocated")
            return False
    
        # Check if the integer is within the range 0 to 100.
        if 0 <= id_int <= 255:
            return True
        else:
            return False
    except ValueError:
        # If conversion to int fails (e.g., id_string is "abc" or "12.3"),
        # it's not a valid integer ID in the desired format.
        return False
    except TypeError:
        # If id_string is not a string-like object (e.g., None)
        return False



# --- Tag CRUD Routes ---

@tags_bp.route('/list', methods=['POST'])
@jwt_required() # Assuming tag management requires user login
def list_tags():
    """
    Lists tags, optionally filtering by type based on request body.
    Frontend uses POST to send filter object.
    """
    logging.info(f"Request received for POST {tags_bp.name}.list")
    db = DbRequestSession()
    req_data = request.get_json() or {} # Handle potential empty body
    filter_data = req_data.get('filter', {})
    filter_type = filter_data.get('type') if filter_data else None

    try:
        query = db.query(Tag)

        # Apply filter if provided and not 'all'
        if filter_type and filter_type.lower() != 'all':
            query = query.filter(Tag.type == filter_type)

        tags_orm = query.order_by(Tag.type, Tag.name).all()

        tags_list = [
            {
                "id": tag.id,
                "name": tag.name,
                "type": tag.type,
                "description": tag.description or "", # Ensure description is string
            }
            for tag in tags_orm
        ]
        logging.info(f"Returning {len(tags_list)} tags via {tags_bp.name} blueprint.")
        return jsonify(tags_list), 200

    except SQLAlchemyError as e:
        logging.error(f"Database error listing tags: {e}", exc_info=True)
        abort(500, description="Failed to retrieve tags due to database error.")
    except Exception as e:
        logging.error(f"Unexpected error listing tags: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving tags.")


@tags_bp.route('/create', methods=['POST'])
@jwt_required()
def create_tag():
    """Creates a new tag."""
    logging.info(f"Request received for POST {tags_bp.name}.create")
    db = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('name') or not data.get('type'):
         abort(400, description="Missing required fields: 'name' and 'type'.")

    # Frontend sends the ID, derived from name. Use it directly.
    tag_id = data.get('id')
    if not tag_id:
        # Fallback or validation error if ID is crucial and must be sent
        abort(400, description="Missing required field: 'id'.")
        # Alternatively, generate server-side if needed:
        # tag_id = _generate_tag_id(data['name'])

    name = data['name']
    tag_type = data['type']
    description = data.get('description')

    # Check if tag ID already exists
    existing_tag = db.get(Tag, tag_id)
    if existing_tag:
        logging.warning(f"Attempted to create tag with existing ID: {tag_id}")
        abort(409, description=f"Tag with ID '{tag_id}' already exists.") # 409 Conflict
    
    

    if _check_if_allocated(tag_id):
        logging.warning(f"Attempted to create tag with allocated ID: {tag_id}")
        abort(409, description=f"Tag with ID '{tag_id}' already is allocated by a system.")

    stmt = select(Tag.id).where(Tag.name == str(name))
    result = db.execute(stmt).scalar_one_or_none()
    if result is not None:
        logging.warning(f"Tag name is already exists")
        abort(409, description=f"Tag with name '{name}' already exists.")
    try:
        new_tag = Tag(
            id=tag_id,
            name=name,
            type=tag_type,
            description=description
        )
        db.add(new_tag)
        db.commit()
        db.refresh(new_tag) # Ensure the object has latest data after commit

        logging.info(f"Successfully created tag: ID='{new_tag.id}', Name='{new_tag.name}'")
        # Return the created tag object
        return jsonify({
            "id": new_tag.id,
            "name": new_tag.name,
            "type": new_tag.type,
            "description": new_tag.description or "",
        }), 201 # 201 Created

    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error creating tag '{tag_id}': {e}", exc_info=True)
        # This might happen in a race condition if the ID check passed but another request created it just before commit
        abort(409, description=f"Could not create tag. ID '{tag_id}' might already exist.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error creating tag '{tag_id}': {e}", exc_info=True)
        abort(500, description="Failed to create tag due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error creating tag '{tag_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while creating the tag.")


@tags_bp.route('/update', methods=['PUT'])
@jwt_required()
def update_tag():
    """Updates an existing tag."""
    logging.info(f"Request received for PUT {tags_bp.name}.update")
    db = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('id') or not data.get('name') or not data.get('type'):
        abort(400, description="Missing required fields: 'id', 'name', 'type'.")

    tag_id = data['id']
    name = data['name']
    tag_type = data['type']
    description = data.get('description') # Can be None or empty

    try:
        existing_tag = db.get(Tag, tag_id)

        if not existing_tag:
            logging.warning(f"Attempted to update non-existent tag: {tag_id}")
            abort(404, description=f"Tag with ID '{tag_id}' not found.")

        # Update attributes
        if not (existing_tag.name == name):
            logging.info("New name detected")
            stmt = select(Tag.id).where(Tag.name == str(name))
            result = db.execute(stmt).scalar_one_or_none()
            if result is not None:
                logging.warning(f"Tag name is already exists")
                abort(409, description=f"Tag with name '{name}' already exists.")
        existing_tag.name = name
        existing_tag.type = tag_type
        existing_tag.description = description

        db.commit()
        db.refresh(existing_tag) # Refresh to get potentially updated state
        logging.info(f"Successfully updated tag: ID='{existing_tag.id}', Name='{existing_tag.name}'")

        # Return the updated tag object
        return jsonify({
            "id": existing_tag.id,
            "name": existing_tag.name,
            "type": existing_tag.type,
            "description": existing_tag.description or "",
        }), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error updating tag '{tag_id}': {e}", exc_info=True)
        abort(500, description="Failed to update tag due to database error.")
    except Conflict as e:
        logging.error("Error 409")
        abort(409, description=f"Tag with name '{name}' already exists.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating tag '{tag_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while updating the tag.")


@tags_bp.route('/delete', methods=['DELETE'])
@jwt_required()
def delete_tag():
    """Deletes an existing tag."""
    logging.info(f"Request received for DELETE {tags_bp.name}.delete")
    db = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('id'):
        abort(400, description="Missing required field: 'id'.")

    tag_id = data['id']

    try:
        existing_tag = db.get(Tag, tag_id)

        if not existing_tag:
            logging.warning(f"Attempted to delete non-existent tag: {tag_id}")
            # Return success=False or 404? Frontend expects success: true/false
            # Let's return 404 as the resource wasn't found to delete.
            abort(404, description=f"Tag with ID '{tag_id}' not found.")
        if _check_if_allocated(tag_id):
            logging.warning(f"System allocated tag '{tag_id}' is not allowed to be deleted")
            abort(401, description=f"System allocated tag '{tag_id}' is not allowed to be deleted" )

        db.delete(existing_tag)
        db.commit()
        logging.info(f"Successfully deleted tag: ID='{tag_id}'")

        # Return success confirmation as expected by frontend
        return jsonify({"success": True, "id": tag_id}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error deleting tag '{tag_id}': {e}", exc_info=True)
        # Check for potential foreign key constraint errors if cascade isn't working
        if "violates foreign key constraint" in str(e).lower():
             abort(409, description=f"Cannot delete tag '{tag_id}' because it is still associated with other items (groups, rules, etc.).")
        abort(500, description="Failed to delete tag due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error deleting tag '{tag_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while deleting the tag.")