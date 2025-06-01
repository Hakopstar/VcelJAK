      
# app/schedules/routes.py
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal # Keep import if potentially needed elsewhere

from flask import Blueprint, jsonify, request, abort, current_app
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy import desc, or_ # Import or_ if needed

# Import the blueprint object defined in __init__.py
# Ensure app/schedules/__init__.py defines schedules_bp
from . import schedules_bp

# Import the request-scoped session factory
from app import DbRequestSession # Adjust import path if needed

# Import necessary models
from app.db_man.pqsql.models import Schedule, ScheduleCondition, Group # Adjust path if needed

# Import cache invalidation functions (if needed)
# from app.cache.database_caching import ...

from flask_jwt_extended import jwt_required #, get_jwt_identity # Not used



# --- Helper Functions ---

def _generate_schedule_id() -> str:
    """Generates a unique ID for a schedule."""
    return f"sch-{uuid.uuid4()}"

def _parse_date(date_str: str | None) -> date | None:
    """Safely parses an ISO date string (YYYY-MM-DD or with time/Z) into a date object."""
    if not date_str:
        return None
    try:
        # Attempt to parse ISO 8601 format, handling potential 'Z'
        dt_aware = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        # Return only the date part
        return dt_aware.date()
    except ValueError:
        # Fallback for simple YYYY-MM-DD
        try:
             return date.fromisoformat(date_str)
        except ValueError:
            logging.warning(f"Invalid date format received: {date_str}")
            raise ValueError(f"Invalid date format for '{date_str}'. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ).")


def _format_condition(condition: ScheduleCondition) -> dict:
    """Formats a ScheduleCondition ORM object for API responses."""
    return {
        # Consider if frontend needs condition_id; if not, could omit
        # "id": condition.condition_id,
        "type": condition.type,
        "operator": condition.operator,
        # Convert value based on type if necessary, assuming string storage covers most cases
        "value": condition.value,
        "unit": condition.unit,
        "duration": condition.duration,
        "durationUnit": condition.duration_unit,
        "groupId": condition.group_id, # Return ID
    }

def _format_schedule_detail(schedule: Schedule) -> dict:
    """Formats a Schedule ORM object into the detailed dictionary for API responses."""
    return {
        "id": schedule.id,
        "name": schedule.name,
        "description": schedule.description,
        "category": schedule.category,
        "season": schedule.season,
        "dueDate": schedule.due_date.isoformat() if schedule.due_date else None,
        "status": schedule.status,
        "progress": schedule.progress,
        "assignedGroups": [group.id for group in schedule.assigned_groups], # List of Group IDs
        "priority": schedule.priority,
        "conditions": [_format_condition(cond) for cond in schedule.conditions],
        "recommendations": schedule.recommendations or [], # Ensure list, not None
        "notes": schedule.notes,
        "completionDate": schedule.completion_date.isoformat() if schedule.completion_date else None,
        # Ensure timestamps are converted to ISO strings
        "createdAt": schedule.created_at.isoformat() if schedule.created_at else None,
        "lastModified": schedule.last_modified.isoformat() if schedule.last_modified else None,
    }

def _format_group_for_dropdown(group: Group) -> dict:
    """Formats Group for beehive/meteostation dropdowns (matches FE Beehive/MeteoStation types)."""
    return {
        "id": group.id,
        "name": group.name,
        "location": group.location # Include location for context
    }

# --- Schedule CRUD Routes ---
# Assumes blueprint registered with url_prefix='/access/schedules'

@schedules_bp.route('/schedules', methods=['GET']) # Changed from /all
@jwt_required()
def list_schedules():
    """Lists all schedules."""
    logging.info("GET /schedules requested")
    db: Session = DbRequestSession()
    try:
        schedules_orm = db.query(Schedule).options(
            selectinload(Schedule.conditions),
            selectinload(Schedule.assigned_groups)
        ).order_by(desc(Schedule.created_at)).all()

        schedules_list = [_format_schedule_detail(sch) for sch in schedules_orm]
        logging.info(f"Returning {len(schedules_list)} schedules.")
        # Frontend API service expects the list directly based on provided api.ts
        return jsonify(schedules_list)
    except SQLAlchemyError as e:
        logging.error(f"Database error listing schedules: {e}", exc_info=True)
        abort(500, description="Failed to retrieve schedules.") # Requires app-level JSON error handler
    except Exception as e:
        logging.error(f"Unexpected error listing schedules: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing schedules.") # Requires app-level JSON error handler


@schedules_bp.route('/<string:schedule_id>', methods=['GET'])
@jwt_required()
def get_schedule(schedule_id: str):
    """Gets details for a specific schedule."""
    logging.info(f"GET /schedules/{schedule_id} requested")
    db: Session = DbRequestSession()
    try:
        schedule = db.query(Schedule).options(
            selectinload(Schedule.conditions),
            selectinload(Schedule.assigned_groups)
        ).filter(Schedule.id == schedule_id).one_or_none()

        if not schedule:
            abort(404, description=f"Schedule with ID '{schedule_id}' not found.") # Requires app-level JSON error handler

        # Frontend API service expects the object directly
        return jsonify(_format_schedule_detail(schedule))
    except SQLAlchemyError as e:
        logging.error(f"Database error getting schedule '{schedule_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve schedule details.") # Requires app-level JSON error handler
    except Exception as e:
        logging.error(f"Unexpected error getting schedule '{schedule_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred retrieving schedule details.") # Requires app-level JSON error handler


@schedules_bp.route('', methods=['POST']) # Changed from /create
@jwt_required()
def create_schedule():
    """Creates a new schedule."""
    logging.info("POST /schedules requested")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data: abort(400, description="Request body is missing or not JSON.")

    # --- Validate required fields based on frontend logic & type ---
    required_fields = ['name', 'category', 'season', 'dueDate', 'priority', 'assignedGroups']
    missing_fields = [field for field in required_fields if data.get(field) is None or data.get(field) == '']
    if missing_fields:
        abort(400, description=f"Missing required fields: {', '.join(missing_fields)}")
    if not isinstance(data.get('assignedGroups'), list) or not data['assignedGroups']:
         abort(400, description="assignedGroups must be a non-empty list.")

    try:
        due_date = _parse_date(data.get('dueDate')) # Handles validation within
        # completion_date is usually set on update/completion, not creation

        # --- Fetch and Validate Assigned Groups ---
        group_ids = data.get('assignedGroups', [])
        assigned_groups_orm = db.query(Group).filter(Group.id.in_(group_ids)).all()
        if len(assigned_groups_orm) != len(set(group_ids)):
             found_ids = {g.id for g in assigned_groups_orm}
             missing_ids = set(group_ids) - found_ids
             abort(404, description=f"Assigned groups not found: {', '.join(missing_ids)}")

        new_schedule_id = _generate_schedule_id()

        # --- Create ScheduleCondition objects ---
        conditions_orm = []
        for cond_data in data.get('conditions', []):
            group_id = cond_data.get('groupId')
            if group_id == "": group_id = None # Handle empty string
            if group_id: # Validate only if provided
                 cond_group_exists = db.query(Group.id).filter(Group.id == group_id).scalar()
                 if not cond_group_exists:
                      abort(404, description=f"Condition group station group '{group_id}' not found.")

            condition = ScheduleCondition(
                type=cond_data.get('type'),
                operator=cond_data.get('operator'),
                value=str(cond_data.get('value')) if cond_data.get('value') is not None else None, # Store as string maybe?
                unit=cond_data.get('unit'),
                duration=cond_data.get('duration'),
                duration_unit=cond_data.get('durationUnit'),
                group_id=group_id,
                actual_value="0"
            )
            conditions_orm.append(condition)

        # --- Create Schedule ---
        new_schedule = Schedule(
            id=new_schedule_id,
            name=data['name'],
            description=data.get('description'),
            category=data['category'],
            season=data['season'],
            due_date=due_date,
            # Use status/progress from request if provided (e.g., "Start as In Progress")
            status=data.get('status', 'pending'),
            progress=int(data.get('progress', 0)),
            priority=data['priority'],
            recommendations=data.get('recommendations'),
            notes=data.get('notes'),
            # completion_date=None, # Set on completion
            # created_at/last_modified have defaults
            assigned_groups=assigned_groups_orm,
            conditions=conditions_orm
        )

        db.add(new_schedule)
        db.commit()

        # Fetch the created schedule with relations for the response
        created_schedule = db.query(Schedule).options(
            selectinload(Schedule.conditions),
            selectinload(Schedule.assigned_groups)
        ).get(new_schedule_id) # Use get() after commit

        if not created_schedule: # Safety check
            logging.error(f"Failed to fetch created schedule {new_schedule_id} immediately after commit.")
            abort(500, "Failed to retrieve created schedule data.")

        logging.info(f"Successfully created schedule ID: {new_schedule_id}")
         # Frontend API service expects the object directly
        return jsonify(_format_schedule_detail(created_schedule)), 201

    except ValueError as e: # Catch date parsing errors
        db.rollback()
        abort(400, description=str(e)) # Requires app-level JSON error handler
    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error creating schedule: {e}", exc_info=True)
        abort(409, description="Could not create schedule. Conflict with existing data.") # Requires app-level JSON error handler
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error creating schedule: {e}", exc_info=True)
        abort(500, description="Failed to create schedule due to database error.") # Requires app-level JSON error handler
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error creating schedule: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while creating the schedule.") # Requires app-level JSON error handler


@schedules_bp.route('/<string:schedule_id>', methods=['PUT']) # Changed from /update/{id}
@jwt_required()
def update_schedule(schedule_id: str):
    """Updates an existing schedule."""
    logging.info(f"PUT /schedules/{schedule_id} requested")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data: abort(400, description="Request body is missing or not JSON.")

    try:
        schedule = db.query(Schedule).options(
            selectinload(Schedule.conditions),
            selectinload(Schedule.assigned_groups)
        ).filter(Schedule.id == schedule_id).one_or_none()

        if not schedule:
            abort(404, description=f"Schedule with ID '{schedule_id}' not found.")

        # --- Update Basic Fields ---
        if 'name' in data: schedule.name = data['name']
        if 'description' in data: schedule.description = data['description']
        if 'category' in data: schedule.category = data['category']
        if 'season' in data: schedule.season = data['season']
        if 'dueDate' in data: schedule.due_date = _parse_date(data['dueDate'])
        if 'status' in data: schedule.status = data['status']
        if 'progress' in data: schedule.progress = int(data['progress'])
        if 'priority' in data: schedule.priority = data['priority']
        if 'recommendations' in data: schedule.recommendations = data['recommendations']
        if 'notes' in data: schedule.notes = data['notes']
        if 'completionDate' in data: schedule.completion_date = _parse_date(data['completionDate'])

        # --- Update Assigned Groups (Replace Strategy) ---
        if 'assignedGroups' in data:
            group_ids = data.get('assignedGroups', [])
            if not isinstance(group_ids, list): abort(400, description="assignedGroups must be a list.")
            # Frontend validation prevents empty list on create/edit submit
            if not group_ids: abort(400, description="assignedGroups cannot be empty for an existing schedule.")

            assigned_groups_orm = db.query(Group).filter(Group.id.in_(group_ids)).all()
            if len(assigned_groups_orm) != len(set(group_ids)):
                 found_ids = {g.id for g in assigned_groups_orm}
                 missing_ids = set(group_ids) - found_ids
                 abort(404, description=f"Assigned groups not found: {', '.join(missing_ids)}")
            schedule.assigned_groups = assigned_groups_orm

        # --- Update Conditions (Replace Strategy) ---
        if 'conditions' in data:
            # Delete existing conditions for this schedule
            db.query(ScheduleCondition).filter(ScheduleCondition.schedule_id == schedule.id).delete(synchronize_session=False)
            # db.flush() # Optional flush

            # Create new conditions from the request data
            new_conditions_orm = []
            for cond_data in data.get('conditions', []):
                group_id = cond_data.get('groupId')
                if group_id == "": group_id = None
                if group_id:
                    cond_groupid_exists = db.query(Group.id).filter(Group.id == group_id).scalar()
                    if not cond_groupid_exists:
                        abort(404, description=f"Condition group station group '{group_id}' not found.")

                condition = ScheduleCondition(
                    schedule_id=schedule.id, # Set FK explicitly
                    type=cond_data.get('type'),
                    operator=cond_data.get('operator'),
                    value=str(cond_data.get('value')) if cond_data.get('value') is not None else None,
                    unit=cond_data.get('unit'),
                    duration=cond_data.get('duration'),
                    duration_unit=cond_data.get('durationUnit'),
                    group_id=group_id
                )
                new_conditions_orm.append(condition)
                # Add to session if not relying on relationship assignment below
                # db.add(condition)

            # Assign the new list to the relationship (if cascade isn't deleting implicitly)
            # Or rely on db.add(condition) above if manually managing session adds
            schedule.conditions = new_conditions_orm

        # --- Update lastModified timestamp ---
        schedule.last_modified = datetime.now(timezone.utc)

        # --- Commit All Changes ---
        db.commit()

        # Fetch the updated schedule with relations for the response
        updated_schedule = db.query(Schedule).options(
            selectinload(Schedule.conditions),
            selectinload(Schedule.assigned_groups)
        ).get(schedule_id) # Use get()

        if not updated_schedule: # Safety check
             logging.error(f"Failed to fetch updated schedule {schedule_id} after commit.")
             abort(500, "Failed to retrieve updated schedule data.")

        logging.info(f"Successfully updated schedule ID: {schedule_id}")
        # Frontend API service expects the object directly
        return jsonify(_format_schedule_detail(updated_schedule))

    except ValueError as e: # Catch date parsing errors
        db.rollback()
        abort(400, description=str(e)) # Requires app-level JSON error handler
    except IntegrityError as e:
        db.rollback()
        logging.error(f"DB integrity error updating schedule '{schedule_id}': {e}", exc_info=True)
        abort(409, description="Could not update schedule. Conflict with existing data.") # Requires app-level JSON error handler
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error updating schedule '{schedule_id}': {e}", exc_info=True)
        abort(500, description="Failed to update schedule due to database error.") # Requires app-level JSON error handler
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating schedule '{schedule_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while updating the schedule.") # Requires app-level JSON error handler


@schedules_bp.route('/<string:schedule_id>', methods=['DELETE']) # Changed from /delete/{id}
@jwt_required()
def delete_schedule(schedule_id: str):
    """Deletes a schedule."""
    logging.info(f"DELETE /schedules/{schedule_id} requested")
    db: Session = DbRequestSession()
    try:
        schedule = db.get(Schedule, schedule_id) # Use get() for primary key lookup

        if not schedule:
            # Idempotency: If not found, it's already deleted or never existed.
            logging.warning(f"Schedule ID {schedule_id} not found for deletion, returning 204.")
            return '', 204

        # Assuming ScheduleCondition has ON DELETE CASCADE via ForeignKey setup
        db.delete(schedule)
        db.commit()

        logging.info(f"Successfully deleted schedule ID: {schedule_id}")
        # **CORRECTED Response:** Return 204 No Content
        return '', 204

    except IntegrityError as e: # Less likely if cascades are set, but possible
        db.rollback()
        logging.error(f"Database integrity error deleting schedule '{schedule_id}': {e}", exc_info=True)
        abort(409, description="Cannot delete schedule. It might be referenced elsewhere.") # Requires app-level JSON error handler
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error deleting schedule '{schedule_id}': {e}", exc_info=True)
        abort(500, description="Failed to delete schedule due to database error.") # Requires app-level JSON error handler
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error deleting schedule '{schedule_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while deleting the schedule.") # Requires app-level JSON error handler


# --- Routes for Related Data (Beehives, Meteostations) ---

@schedules_bp.route('/beehives', methods=['GET'])
@jwt_required()
def list_beehives_for_schedules():
    """Lists all groups suitable for schedule assignment."""
    logging.info("GET /schedules/beehives requested")
    db: Session = DbRequestSession()
    try:
        # --- ADJUST 'beehive', 'hive' TO YOUR ACTUAL GROUP TYPES ---
        assignable_types = ['beehive', 'hive']
        # -----------------------------------------------------------
        groups_orm = db.query(Group)\
                       .filter(Group.type.in_(assignable_types))\
                       .order_by(Group.name)\
                       .all()

        groups_list = [_format_group_for_dropdown(group) for group in groups_orm]
        logging.info(f"Returning {len(groups_list)} assignable beehives.")
        # Frontend expects a direct list
        return jsonify(groups_list)
    except SQLAlchemyError as e:
        logging.error(f"Database error listing beehives for schedules: {e}", exc_info=True)
        abort(500, description="Failed to retrieve beehives.") # Requires app-level JSON error handler
    except Exception as e:
        logging.error(f"Unexpected error listing beehives for schedules: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing beehives.") # Requires app-level JSON error handler


@schedules_bp.route('/groups', methods=['GET'])
@jwt_required()
def list_groups_for_schedules():
    """Lists all groups suitable."""
    logging.info("GET /schedules/groups requested")
    db: Session = DbRequestSession()
    try:
        # ------------------------------------------------------
        groups = db.query(Group)\
                             .order_by(Group.name)\
                             .all()

        groups_list = [_format_group_for_dropdown(group) for group in groups]
        logging.info(f"Returning {len(groups_list)} groups.")
        # Frontend expects a direct list
        return jsonify(groups_list)
    except SQLAlchemyError as e:
        logging.error(f"Database error listing groups: {e}", exc_info=True)
        abort(500, description="Failed to retrieve groups.") # Requires app-level JSON error handler
    except Exception as e:
        logging.error(f"Unexpected error listing groups: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing groups.") # Requires app-level JSON error handler

    