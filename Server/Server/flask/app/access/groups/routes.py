# app/groups/routes.py
import logging
import re
import uuid
from collections import defaultdict # Import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal
from flask import jsonify, abort, request, current_app
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm import selectinload, joinedload, Session, raiseload # Import Session for type hint
from sqlalchemy import desc, or_, Column # Import Column for checking
from flask_jwt_extended import jwt_required, get_jwt_identity

# Import the blueprint object
from . import groups_bp

# Import necessary models
from app.db_man.pqsql.models import Group, Sensor, Rule, RuleSet, Tag, GroupEvent, RuleInitiator



# Import the request-scoped session factory
from app import DbRequestSession

# Import cache invalidation & services
from app.cache.database_caching import invalidate_group_rules_cache
from app.services.inventory_service import invalidate_inventory_cache


# --- InfluxDB Client (Conditional Import) ---
try:
    from influxdb_client import InfluxDBClient, Point, WritePrecision # type: ignore
    from influxdb_client.client.exceptions import InfluxDBError # type: ignore
    import os
    INFLUX_URL = os.getenv("INFLUXDB_URL")
    INFLUX_TOKEN = os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN")
    INFLUX_ORG = os.getenv("DOCKER_INFLUXDB_INIT_ORG")
    INFLUX_BUCKET = os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")
    INFLUX_CONFIGURED = all([INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET])
    if not INFLUX_CONFIGURED:
        logging.warning("InfluxDB environment variables not fully configured. Sensor history route will be unavailable.")
except ImportError:
    logging.warning("influxdb-client library not installed. Sensor history route will be unavailable.")
    InfluxDBClient = None # type: ignore
    InfluxDBError = None # type: ignore
    INFLUX_CONFIGURED = False
# -------------------------------------------


from app.helpers.formatters import _generate_group_id, _format_group_response, _format_sensor_response, _format_action
from app.helpers.formatters import _format_initiator, _format_rule_response, _format_event_response, _format_group_list_item
from app.helpers.formatters import _format_group_detail_response



@groups_bp.before_request
def log_request():
    logging.debug(f"Request to {request.path} with data: {request.data} and headers: {dict(request.headers)}")


@groups_bp.route('/list', methods=['POST'])
@jwt_required()
def list_groups():
    """Lists all groups, including their subgroup IDs."""
    logging.info(f"Request received for POST {groups_bp.name}.list")
    db: Session = DbRequestSession()
    try:
        # Load only necessary scalar fields + FKs for relationships
        # Avoid loading full related objects for the list view
        groups_orm = db.query(Group).options(
            # Use raiseload('*') to prevent accidental loading of full relationships
            # This ensures only explicitly loaded columns/relationships are accessed
            raiseload('*', sql_only=True),
            # Selectively load only attributes needed by _format_group_list_item
            selectinload(Group.sensors).load_only(Sensor.id),
            selectinload(Group.rules).load_only(Rule.id),
            selectinload(Group.rule_sets).load_only(RuleSet.id),
            selectinload(Group.tags).load_only(Tag.id),
        ).order_by(Group.name).all()

        if not groups_orm: return jsonify({"groups": []}), 200

        group_ids = [group.id for group in groups_orm]
        subgroup_links = db.query(Group.id, Group.parent_id).filter(Group.parent_id.in_(group_ids)).all()

        subgroup_map = defaultdict(list)
        for child_id, parent_id in subgroup_links:
            if parent_id: subgroup_map[parent_id].append(child_id)

        # Use the LIST formatter here
        groups_list = [_format_group_list_item(group, subgroup_map) for group in groups_orm]

        logging.info(f"Returning {len(groups_list)} groups.")
        return jsonify({"groups": groups_list}), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error listing groups: {e}", exc_info=True)
        abort(500, description="Failed to retrieve groups.")
    except Exception as e:
        logging.error(f"Unexpected error listing groups: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing groups.")

# --- Other routes (list_sensors_for_groups, create_group, update_group, etc.) ---
# --- remain largely the same, but ensure formatters are called correctly ---
# --- if they now require the subgroup_map (only list_groups needs it here) ---

@groups_bp.route('/sensors', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def list_sensors_for_groups():
    # ... (no changes needed here) ...
    logging.info(f"Request received for POST {groups_bp.name}.sensors")
    db: Session = DbRequestSession()
    try:
        sensors_orm = db.query(
            Sensor.id,
            Sensor.measurement,
            Sensor.client_id,
            Sensor.group_id
        ).order_by(Sensor.id).all()
        sensors_list = [
             {
                "id": s.id,
                "name": f"{s.measurement.capitalize()} ({s.id}) Hub: {s.client_id or 'N/A'}",
                "type": s.measurement,
                "location": None,
                "status": None,
                "assignedGroupId": s.group_id
             } for s in sensors_orm
        ]
        logging.info(f"Returning {len(sensors_list)} sensors for group context.")
        return jsonify({"sensors": sensors_list}), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error listing sensors for groups: {e}", exc_info=True)
        abort(500, description="Failed to retrieve sensors.")
    except Exception as e:
        logging.error(f"Unexpected error listing sensors for groups: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing sensors.")

@groups_bp.route('/rules', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def list_rules_for_groups():

    logging.info(f"Request received for POST {groups_bp.name}.rules")
    db: Session = DbRequestSession()
    try:
        rules_orm = db.query(Rule).order_by(Rule.name).all()
        rules_list = [_format_rule_response(rule) for rule in rules_orm]
        logging.info(f"Returning {len(rules_list)} rules for group context.")
        return jsonify({"rules": rules_list}), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error listing rules for groups: {e}", exc_info=True)
        abort(500, description="Failed to retrieve rules.")
    except Exception as e:
        logging.error(f"Unexpected error listing rules for groups: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing rules.")

@groups_bp.route('/rulesets', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def list_rulesets_for_groups():
    # ... (no changes needed here) ...
    logging.info(f"Request received for POST {groups_bp.name}.rulesets")
    db: Session = DbRequestSession()
    try:
        rulesets_orm = db.query(RuleSet).options(
            selectinload(RuleSet.rules) # Eager load rules to get IDs
        ).order_by(RuleSet.name).all()

        rulesets_list = [
            {
                "id": rs.id,
                "name": rs.name,
                "description": rs.description or "",
                "rules": [rule.id for rule in rs.rules],
            }
            for rs in rulesets_orm
        ]
        logging.info(f"Returning {len(rulesets_list)} rulesets for group context.")
        return jsonify({"ruleSets": rulesets_list}), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error listing rulesets for groups: {e}", exc_info=True)
        abort(500, description="Failed to retrieve rule sets.")
    except Exception as e:
        logging.error(f"Unexpected error listing rulesets for groups: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing rulesets.")

@groups_bp.route('/tags', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def list_tags_for_groups():
    # ... (no changes needed here) ...
    logging.info(f"Request received for POST {groups_bp.name}.tags")
    db: Session = DbRequestSession()
    try:
        tags_orm = db.query(Tag).order_by(Tag.type, Tag.name).all()
        tags_list = [
            {
                "id": tag.id,
                "name": tag.name,
                "type": tag.type,
            }
            for tag in tags_orm
        ]
        logging.info(f"Returning {len(tags_list)} tags for group context.")
        return jsonify({"tags": tags_list}), 200
    except SQLAlchemyError as e:
        logging.error(f"Database error listing tags for groups: {e}", exc_info=True)
        abort(500, description="Failed to retrieve tags.")
    except Exception as e:
        logging.error(f"Unexpected error listing tags for groups: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing tags.")


# --- Group CRUD Routes ---

@groups_bp.route('/create', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def create_group():
    # ... (implementation remains the same, formatter doesn't need subgroup map here) ...
    logging.info(f"Request received for POST {groups_bp.name}.create")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('name') or not data.get('type'):
        abort(400, description="Missing required fields: 'name', 'type'.")

    group_id = _generate_group_id(data['name'])
    name = data['name']
    group_type = data['type']
    description = data.get('description')
    parent_id = data.get('parentId')

    sensor_ids = data.get('sensors', [])
    rule_ids = data.get('rules', [])
    ruleset_ids = data.get('ruleSets', [])
    tag_ids = data.get('tags', [])

    if parent_id and not db.get(Group, parent_id):
        abort(404, description=f"Parent group '{parent_id}' not found.")

    try:
        if db.get(Group, group_id):
             group_id = _generate_group_id(data['name']) # Regenerate on collision
             if db.get(Group, group_id):
                  abort(409, description="Group ID collision. Please try a slightly different name.")

        sensors = db.query(Sensor).filter(Sensor.id.in_(sensor_ids)).all() if sensor_ids else []
        rules = db.query(Rule).filter(Rule.id.in_(rule_ids)).all() if rule_ids else []
        rulesets = db.query(RuleSet).filter(RuleSet.id.in_(ruleset_ids)).all() if ruleset_ids else []
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all() if tag_ids else []

        inspection_date_obj = None
        inspection_date_str = data.get('inspectionDate')
        if inspection_date_str:
            try:
                inspection_date_obj = datetime.fromisoformat(inspection_date_str.replace('Z', '+00:00')).date()
            except ValueError:
                abort(400, description="Invalid format for inspectionDate.")

        new_group = Group(
            id=group_id,
            name=name,
            type=group_type,
            description=description,
            parent_id=parent_id,
            last_inspection=inspection_date_obj,
            location=data.get('location'),

        
            automatic_mode=data.get('automaticMode', False),
            # Read 'beehiveType' from JSON, assign to model's 'beehive_type'
            # Set to None if the group type isn't 'beehive'
            beehive_type=data.get('beehiveType') if group_type == 'beehive' else None,
            # --- END CORRECTION ---

            # Other fields (ensure keys match JSON or use .get() if optional)
            mode=data.get('mode'),
            health=data.get('health'),
            is_main=data.get('isMain') if group_type == 'meteostation' else None, # Read 'isMain'
          

            # Assign relationship collections
            sensors=sensors,
            rules=rules,
            rule_sets=rulesets,
            tags=tags
        )

        db.add(new_group)
        db.commit()
        db.refresh(new_group)

        created_group_orm = db.query(Group).options(
            selectinload(Group.sensors), selectinload(Group.rules),
            selectinload(Group.rule_sets), selectinload(Group.tags)
        ).filter(Group.id == group_id).one()
        subgroup_ids = db.query(Group.id).filter(Group.parent_id == created_group_orm.id).all()
        subgroup_map = {created_group_orm.id: [sg[0] for sg in subgroup_ids]}
        # Call formatter WITHOUT the map (it's optional now)
        logging.info(f"Successfully created group: ID='{new_group.id}'")
        return jsonify({"group": _format_group_detail_response(created_group_orm, subgroup_map)}), 201 # Pass empty map or fetched map

    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error creating group '{name}': {e}", exc_info=True)
        abort(409, description="Could not create group. Conflict with existing data.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error creating group '{name}': {e}", exc_info=True)
        abort(500, description="Failed to create group.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error creating group '{name}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while creating group.")

@groups_bp.route('/update', methods=['PUT'])
@jwt_required()
def update_group():
    # ... (implementation remains the same, formatter doesn't need subgroup map here) ...
    logging.info(f"Request received for PUT {groups_bp.name}.update")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('id'):
        abort(400, description="Missing required field: 'id'.")

    group_id = data['id']
    rule_cache_invalidated = False

    try:
        existing_group = db.query(Group).options(
            selectinload(Group.sensors), selectinload(Group.rules),
            selectinload(Group.rule_sets), selectinload(Group.tags)
        ).filter(Group.id == group_id).one_or_none()

        if not existing_group:
            abort(404, description=f"Group with ID '{group_id}' not found.")

        # Update basic fields
        if 'name' in data: existing_group.name = data['name']
        if 'type' in data: existing_group.type = data['type']
        if 'description' in data: existing_group.description = data['description']
        if 'parentId' in data:
             parent_id = data['parentId']
             if parent_id and not db.get(Group, parent_id): abort(404, description=f"Parent group '{parent_id}' not found.")
             if parent_id == existing_group.id: abort(400, description="Group cannot be its own parent.")
             existing_group.parent_id = parent_id
        if 'inspectionDate' in data:
             inspection_date_obj = None
             if data['inspectionDate']:
                  try: inspection_date_obj = datetime.fromisoformat(data['inspectionDate'].replace('Z', '+00:00')).date()
                  except ValueError: abort(400, description="Invalid format for inspectionDate.")
             existing_group.last_inspection = inspection_date_obj
        if 'location' in data: existing_group.location = data['location']
        if 'automatic_mode' in data: existing_group.automatic_mode = data['automatic_mode']
        if 'mode' in data: existing_group.mode = data['mode']
        if 'health' in data: existing_group.health = data['health']
        if 'beehive_type' in data: existing_group.beehive_type = data['beehive_type']
        if 'is_main' in data: existing_group.is_main = data['is_main']

        # Update Relationships
        if 'sensors' in data:
             sensor_ids = data.get('sensors', [])
             sensors = db.query(Sensor).filter(Sensor.id.in_(sensor_ids)).all() if sensor_ids else []
             existing_group.sensors = sensors
        if 'rules' in data:
             rule_ids = data.get('rules', [])
             rules = db.query(Rule).filter(Rule.id.in_(rule_ids)).all() if rule_ids else []
             existing_group.rules = rules
             invalidate_group_rules_cache(rc, group_id)
             rule_cache_invalidated = True
        if 'ruleSets' in data:
             ruleset_ids = data.get('ruleSets', [])
             rulesets = db.query(RuleSet).filter(RuleSet.id.in_(ruleset_ids)).all() if ruleset_ids else []
             existing_group.rule_sets = rulesets
             if not rule_cache_invalidated: invalidate_group_rules_cache(rc, group_id)
        if 'tags' in data:
             tag_ids = data.get('tags', [])
             tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all() if tag_ids else []
             existing_group.tags = tags

        db.commit()
        db.refresh(existing_group)

        updated_group_orm = db.query(Group).options(
            selectinload(Group.sensors), selectinload(Group.rules),
            selectinload(Group.rule_sets), selectinload(Group.tags)
        ).filter(Group.id == group_id).one()

        # Fetch subgroup info separately for the response if needed immediately
        subgroup_ids = db.query(Group.id).filter(Group.parent_id == updated_group_orm.id).all()
        subgroup_map = {updated_group_orm.id: [sg[0] for sg in subgroup_ids]}

        logging.info(f"Successfully updated group: ID='{group_id}'")
        return jsonify({"group": _format_group_detail_response(updated_group_orm, subgroup_map)}), 200 # Pass empty map or fetched map

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error updating group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to update group.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating group '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while updating group.")


@groups_bp.route('/delete', methods=['DELETE'])
@jwt_required() # Uncomment when JWT is fully integrated
def delete_group():
    # ... (no changes needed here) ...
    logging.info(f"Request received for DELETE {groups_bp.name}.delete")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('id'):
        abort(400, description="Missing required field: 'id'.")

    group_id = data['id']

    try:
        existing_group = db.get(Group, group_id)
        if not existing_group:
            abort(404, description=f"Group with ID '{group_id}' not found.")

        invalidate_group_rules_cache(rc, group_id) # Invalidate rules before deletion
        db.delete(existing_group)
        db.commit()
        invalidate_inventory_cache(rc) # Invalidate inventory after deletion

        logging.info(f"Successfully deleted group: ID='{group_id}'")
        return jsonify({"success": True}), 200

    except IntegrityError as e:
         db.rollback()
         logging.error(f"Database integrity error deleting group '{group_id}': {e}", exc_info=True)
         if "foreign key constraint" in str(e).lower():
              abort(409, description=f"Cannot delete group '{group_id}' due to existing references (e.g., subgroups). Please remove references first.")
         else:
              abort(500, description="Failed to delete group due to database integrity error.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error deleting group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to delete group.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error deleting group '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while deleting group.")

# --- Assignment Routes ---

@groups_bp.route('/assign-sensor', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def assign_sensor_to_group():
    """Assigns a sensor to a group."""
    logging.info(f"Request received for POST {groups_bp.name}.assign-sensor")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('sensorId'):
        abort(400, description="Missing required fields: 'groupId', 'sensorId'.")

    group_id = data['groupId']
    sensor_id = data['sensorId']

    try:
        group = db.get(Group, group_id)
        sensor = db.get(Sensor, sensor_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not sensor: abort(404, description=f"Sensor '{sensor_id}' not found.")

        if sensor.group_id and sensor.group_id != group_id:
            abort(409, description=f"Sensor '{sensor_id}' is already assigned to group '{sensor.group_id}'. Unassign it first.")
        elif sensor.group_id == group_id:
             return jsonify({"success": True, "msg": "Sensor already assigned to this group."}), 200

        sensor.group_id = group_id
        db.commit()

        invalidate_inventory_cache(rc)
        if sensor.client_id: # Invalidate specific hub map only if sensor has a client
             invalidate_inventory_cache(rc, client_id=sensor.client_id)

        logging.info(f"Successfully assigned sensor '{sensor_id}' to group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error assigning sensor '{sensor_id}' to group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to assign sensor.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error assigning sensor: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while assigning sensor.")


@groups_bp.route('/unassign-sensor', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def unassign_sensor_from_group():
    """Unassigns a sensor from its group."""
    logging.info(f"Request received for POST {groups_bp.name}.unassign-sensor")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('sensorId'):
        abort(400, description="Missing required fields: 'groupId', 'sensorId'.")

    group_id = data['groupId'] # Used for verification
    sensor_id = data['sensorId']

    try:
        sensor = db.get(Sensor, sensor_id)
        if not sensor: abort(404, description=f"Sensor '{sensor_id}' not found.")

        if sensor.group_id != group_id:
             abort(409, description=f"Sensor '{sensor_id}' is not assigned to group '{group_id}'.")
        if sensor.group_id is None:
             return jsonify({"success": True, "msg": "Sensor already unassigned."}), 200

        sensor_client_id = sensor.client_id # Store client_id before setting group_id to None
        sensor.group_id = None # Set FK to NULL
        db.commit()

        invalidate_inventory_cache(rc)
        if sensor_client_id:
            invalidate_inventory_cache(rc, client_id=sensor_client_id)

        logging.info(f"Successfully unassigned sensor '{sensor_id}' from group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error unassigning sensor '{sensor_id}': {e}", exc_info=True)
        abort(500, description="Failed to unassign sensor.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error unassigning sensor: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while unassigning sensor.")


@groups_bp.route('/assign-rule', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def assign_rule_to_group():
    """Assigns a rule directly to a group (M2M relationship)."""
    logging.info(f"Request received for POST {groups_bp.name}.assign-rule")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('ruleId'):
        abort(400, description="Missing required fields: 'groupId', 'ruleId'.")

    group_id = data['groupId']
    rule_id = data['ruleId']

    try:
        group = db.query(Group).options(selectinload(Group.rules)).filter(Group.id == group_id).one_or_none()
        rule = db.get(Rule, rule_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not rule: abort(404, description=f"Rule '{rule_id}' not found.")

        if rule in group.rules:
            return jsonify({"success": True, "msg": "Rule already assigned to this group."}), 200

        group.rules.append(rule)
        db.commit()
        invalidate_group_rules_cache(rc, group_id)

        logging.info(f"Successfully assigned rule '{rule_id}' to group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error assigning rule '{rule_id}' to group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to assign rule.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error assigning rule: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while assigning rule.")


@groups_bp.route('/unassign-rule', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def unassign_rule_from_group():
    """Unassigns a rule directly from a group (M2M relationship)."""
    logging.info(f"Request received for POST {groups_bp.name}.unassign-rule")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('ruleId'):
        abort(400, description="Missing required fields: 'groupId', 'ruleId'.")

    group_id = data['groupId']
    rule_id = data['ruleId']

    try:
        group = db.query(Group).options(selectinload(Group.rules)).filter(Group.id == group_id).one_or_none()
        rule = db.get(Rule, rule_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not rule: return jsonify({"success": True, "msg": "Rule not found, cannot unassign."}), 200

        if rule not in group.rules:
             return jsonify({"success": True, "msg": "Rule was not assigned to this group."}), 200

        group.rules.remove(rule)
        db.commit()
        invalidate_group_rules_cache(rc, group_id)

        logging.info(f"Successfully unassigned rule '{rule_id}' from group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error unassigning rule '{rule_id}' from group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to unassign rule.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error unassigning rule: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while unassigning rule.")


@groups_bp.route('/assign-ruleset', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def assign_ruleset_to_group():
    """Assigns a ruleset to a group (M2M relationship)."""
    logging.info(f"Request received for POST {groups_bp.name}.assign-ruleset")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('rulesetId'):
        abort(400, description="Missing required fields: 'groupId', 'rulesetId'.")

    group_id = data['groupId']
    ruleset_id = data['rulesetId']

    try:
        group = db.query(Group).options(selectinload(Group.rule_sets)).filter(Group.id == group_id).one_or_none()
        ruleset = db.get(RuleSet, ruleset_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not ruleset: abort(404, description=f"RuleSet '{ruleset_id}' not found.")

        if ruleset in group.rule_sets:
            return jsonify({"success": True, "msg": "RuleSet already assigned to this group."}), 200

        group.rule_sets.append(ruleset)
        db.commit()
        invalidate_group_rules_cache(rc, group_id)

        logging.info(f"Successfully assigned RuleSet '{ruleset_id}' to group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error assigning ruleset '{ruleset_id}' to group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to assign ruleset.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error assigning ruleset: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while assigning ruleset.")


@groups_bp.route('/unassign-ruleset', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def unassign_ruleset_from_group():
    """Unassigns a ruleset from a group (M2M relationship)."""
    logging.info(f"Request received for POST {groups_bp.name}.unassign-ruleset")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('rulesetId'):
        abort(400, description="Missing required fields: 'groupId', 'rulesetId'.")

    group_id = data['groupId']
    ruleset_id = data['rulesetId']

    try:
        group = db.query(Group).options(selectinload(Group.rule_sets)).filter(Group.id == group_id).one_or_none()
        ruleset = db.get(RuleSet, ruleset_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not ruleset: return jsonify({"success": True, "msg": "RuleSet not found, cannot unassign."}), 200

        if ruleset not in group.rule_sets:
             return jsonify({"success": True, "msg": "RuleSet was not assigned to this group."}), 200

        group.rule_sets.remove(ruleset)
        db.commit()
        invalidate_group_rules_cache(rc, group_id)

        logging.info(f"Successfully unassigned RuleSet '{ruleset_id}' from group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error unassigning ruleset '{ruleset_id}' from group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to unassign ruleset.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error unassigning ruleset: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while unassigning ruleset.")


@groups_bp.route('/assign-tag', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def assign_tag_to_group():
    """Assigns a tag to a group (M2M relationship)."""
    logging.info(f"Request received for POST {groups_bp.name}.assign-tag")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('tagId'):
        abort(400, description="Missing required fields: 'groupId', 'tagId'.")

    group_id = data['groupId']
    tag_id = data['tagId']

    try:
        group = db.query(Group).options(selectinload(Group.tags)).filter(Group.id == group_id).one_or_none()
        tag = db.get(Tag, tag_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not tag: abort(404, description=f"Tag '{tag_id}' not found.")

        if tag in group.tags:
            return jsonify({"success": True, "msg": "Tag already assigned to this group."}), 200

        group.tags.append(tag)
        db.commit()
        # No cache invalidation needed currently for tags

        logging.info(f"Successfully assigned Tag '{tag_id}' to group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error assigning tag '{tag_id}' to group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to assign tag.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error assigning tag: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while assigning tag.")


@groups_bp.route('/unassign-tag', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def unassign_tag_from_group():
    """Unassigns a tag from a group (M2M relationship)."""
    logging.info(f"Request received for POST {groups_bp.name}.unassign-tag")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('tagId'):
        abort(400, description="Missing required fields: 'groupId', 'tagId'.")

    group_id = data['groupId']
    tag_id = data['tagId']

    try:
        group = db.query(Group).options(selectinload(Group.tags)).filter(Group.id == group_id).one_or_none()
        tag = db.get(Tag, tag_id)

        if not group: abort(404, description=f"Group '{group_id}' not found.")
        if not tag: return jsonify({"success": True, "msg": "Tag not found, cannot unassign."}), 200

        if tag not in group.tags:
             return jsonify({"success": True, "msg": "Tag was not assigned to this group."}), 200

        group.tags.remove(tag)
        db.commit()
        # No cache invalidation needed currently for tags

        logging.info(f"Successfully unassigned Tag '{tag_id}' from group '{group_id}'.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error unassigning tag '{tag_id}' from group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to unassign tag.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error unassigning tag: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while unassigning tag.")

# --- Other Group Modification Routes ---

@groups_bp.route('/set-inspection', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def set_group_inspection_date():
    """Sets the last_inspection date for a group."""
    logging.info(f"Request received for POST {groups_bp.name}.set-inspection")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId') or 'date' not in data:
        abort(400, description="Missing required fields: 'groupId', 'date'.")

    group_id = data['groupId']
    date_str = data['date']
    inspection_date_obj = None

    if date_str:
        try:
            inspection_date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
        except (ValueError, TypeError):
             abort(400, description=f"Invalid date format for inspection date: '{date_str}'. Use ISO format.")

    try:
        group = db.get(Group, group_id)
        if not group: abort(404, description=f"Group '{group_id}' not found.")

        group.last_inspection = inspection_date_obj
        db.commit()

        logging.info(f"Set inspection date for group '{group_id}' to {inspection_date_obj}.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error setting inspection date for '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to set inspection date.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error setting inspection date: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while setting inspection date.")


# --- Group Detail Routes ---

@groups_bp.route('/detail', methods=['POST'])
@jwt_required()
def get_group_detail():
    """Fetches details for a specific group by ID, including subgroup IDs."""
    # ... (This function correctly calculates and passes subgroup_map for the specific group) ...
    logging.info(f"Request received for POST {groups_bp.name}.detail")
    db: Session = DbRequestSession()
    data = request.get_json()
    if not data or not data.get('id'): abort(400, description="Missing required field: 'id'.")
    group_id = data['id']
    logging.info(f"Attempting to fetch group with ID: {group_id}")
    group = None
    try:
        # 1. Fetch the target group
        group = db.query(Group).options(
            selectinload(Group.sensors), 
            selectinload(Group.rules),
            selectinload(Group.rule_sets),
            selectinload(Group.tags), 
            selectinload(Group.events).raiseload('*'),
            joinedload(Group.parent)
        ).filter(Group.id == group_id).one_or_none()
        if group is None: abort(404, description=f"Group '{group_id}' not found.")
        # 2. Fetch subgroup IDs specifically for this group
        subgroup_ids = db.query(Group.id).filter(Group.parent_id == group_id).all()
        subgroup_map = {group_id: [sg[0] for sg in subgroup_ids]} # Map for THIS group
        # 3. Format response - PASSING THE MAP
        formatted_group_data = _format_group_detail_response(group, subgroup_map) # Pass map
        logging.info(f"Returning details for group: ID='{group_id}'")
        return jsonify({"group": formatted_group_data}), 200
    except SQLAlchemyError as e:
        logging.error(f"DB error fetching group detail '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve group details.")
    except Exception as e:
        logging.error(f"Unexpected error fetching group detail '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred.")

@groups_bp.route('/group-sensors', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def get_group_sensors():
    # ... (no changes needed here) ...
    logging.info(f"Request received for POST {groups_bp.name}.group-sensors")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId'):
        abort(400, description="Missing required field: 'groupId'.")
    group_id = data['groupId']

    try:
        group_exists = db.query(Group.id).filter(Group.id == group_id).scalar() is not None
        if not group_exists:
             abort(404, description=f"Group '{group_id}' not found.")

        sensors_orm = db.query(Sensor).filter(Sensor.group_id == group_id).order_by(Sensor.id).all()
        sensors_list = [_format_sensor_response(sensor) for sensor in sensors_orm]

        logging.info(f"Returning {len(sensors_list)} sensors for group '{group_id}'.")
        return jsonify({"sensors": sensors_list}), 200

    except SQLAlchemyError as e:
        logging.error(f"DB error fetching sensors for group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve group sensors.")
    except Exception as e:
        logging.error(f"Unexpected error fetching sensors for group '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving group sensors.")


@groups_bp.route('/subgroups', methods=['POST'])
@jwt_required()
def get_subgroups():
    """Fetches direct subgroups (children) of a given parent group."""
    logging.info(f"Request received for POST {groups_bp.name}.subgroups")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('parentId'):
        abort(400, description="Missing required field: 'parentId'.")
    parent_id = data['parentId']

    try:
        # 1. Fetch subgroups (children)
        subgroups_orm = db.query(Group).options(
            selectinload(Group.sensors), selectinload(Group.rules),
            selectinload(Group.rule_sets), selectinload(Group.tags)
            # Don't load THEIR subgroups recursively here
        ).filter(Group.parent_id == parent_id).order_by(Group.name).all()

        if not subgroups_orm:
             return jsonify({"groups": []}), 200

        # 2. Fetch IDs of *these* subgroups to find *their* children (grandchildren)
        subgroup_ids = [sg.id for sg in subgroups_orm]

        # 3. Fetch grandchild links
        grandchild_links = db.query(Group.id, Group.parent_id) \
                             .filter(Group.parent_id.in_(subgroup_ids)) \
                             .all()

        # 4. Create map of subgroup_id -> list of grandchild_ids
        grandchild_map = defaultdict(list)
        for grandchild_id, sg_id in grandchild_links:
            if sg_id: grandchild_map[sg_id].append(grandchild_id)

        # 5. Format subgroups, passing the grandchild map
        groups_list = [_format_group_response(sg, grandchild_map) for sg in subgroups_orm]

        logging.info(f"Returning {len(groups_list)} subgroups for parent '{parent_id}'.")
        return jsonify({"groups": groups_list}), 200

    except SQLAlchemyError as e:
        logging.error(f"DB error fetching subgroups for parent '{parent_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve subgroups.")
    except Exception as e:
        logging.error(f"Unexpected error fetching subgroups for parent '{parent_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving subgroups.")

@groups_bp.route('/events', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def get_group_events():
    """Fetches events associated with a specific group."""
    logging.info(f"Request received for POST {groups_bp.name}.events")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId'):
        abort(400, description="Missing required field: 'groupId'.")
    group_id = data['groupId']

    try:
        events_orm = db.query(GroupEvent)\
                       .filter(GroupEvent.group_id == group_id)\
                       .order_by(desc(GroupEvent.event_date), desc(GroupEvent.event_table_id))\
                       .limit(100)\
                       .all()

        events_list = [_format_event_response(event) for event in events_orm]

        logging.info(f"Returning {len(events_list)} events for group '{group_id}'.")
        logging.debug(f"event_list: {events_list}")
        return jsonify({"events": events_list}), 200

    except SQLAlchemyError as e:
        logging.error(f"DB error fetching events for group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve group events.")
    except Exception as e:
        logging.error(f"Unexpected error fetching events for group '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving group events.")


@groups_bp.route('/group-rules', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def get_group_rules():
    """Fetches rules applicable to a specific group (direct & via rulesets)."""
    logging.info(f"Request received for POST {groups_bp.name}.group-rules")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId'):
        abort(400, description="Missing required field: 'groupId'.")
    group_id = data['groupId']

    try:
        group = db.query(Group).options(
            selectinload(Group.rules),
            selectinload(Group.rule_sets).selectinload(RuleSet.rules).selectinload(Rule.initiators).selectinload(RuleInitiator.tags)
        ).filter(Group.id == group_id).one_or_none()

        if not group:
            abort(404, description=f"Group '{group_id}' not found.")

        applicable_rules = set(group.rules)
        for rs in group.rule_sets:
            applicable_rules.update(rs.rules)

        rules_list = [_format_rule_response(rule) for rule in applicable_rules]
        rules_list.sort(key=lambda x: x['name'])

        logging.info(f"Returning {len(rules_list)} applicable rules for group '{group_id}'.")
        logging.debug(f"Rules list mocny moment: {rules_list}")
        return jsonify({"rules": rules_list}), 200

    except SQLAlchemyError as e:
        logging.error(f"DB error fetching rules for group '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve group rules.")
    except Exception as e:
        logging.error(f"Unexpected error fetching rules for group '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving group rules.")


@groups_bp.route('/sensor-history', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def get_sensor_history():
    """Fetches historical data for a specific sensor from InfluxDB."""
    logging.info(f"Request received for POST {groups_bp.name}.sensor-history")
    if not INFLUX_CONFIGURED or InfluxDBClient is None:
         logging.error("InfluxDB is not configured or influxdb-client is not installed.")
         abort(510, description="Sensor history feature is unavailable (server configuration error).")

    data = request.get_json()
    if not data or not data.get('sensorId') or not data.get('timeRange'):
        abort(400, description="Missing required fields: 'sensorId', 'timeRange'.")

    sensor_id = data['sensorId']
    time_range_input = data['timeRange'].lower().strip() # Normalize input

    # --- Convert User-Friendly Time Range to InfluxDB Format ---
    influx_time_range: str | None = None
    if time_range_input == "hour":
        influx_time_range = "-1h"
    elif time_range_input == "day":
        influx_time_range = "-24h"
    elif time_range_input == "week":
        influx_time_range = "-7d"
    elif time_range_input == "month":
        # Approximate month as 30 days for Influx range query
        # More precise handling might involve calculating start/end timestamps
        influx_time_range = "-30d"
    elif re.match(r'^-\d+[mhdw]$', time_range_input):
        # Allow direct InfluxDB format as well
        influx_time_range = time_range_input
    else:
        # Handle invalid input
        logging.warning(f"Received invalid timeRange format: '{data['timeRange']}'")
        abort(400, description=f"Invalid timeRange format: '{data['timeRange']}'. Use 'hour', 'day', 'week', 'month' or Influx format (e.g., -1h, -7d).")

    logging.info(f"Querying sensor '{sensor_id}' history for input range '{time_range_input}', using Influx range '{influx_time_range}'")

    # --- Proceed with InfluxDB query using the converted range ---
    history_data = []
    try:
        with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG, timeout=20_000) as client:
            query_api = client.query_api()

            # Construct Flux query
            flux_query = f'''
                from(bucket: "{INFLUX_BUCKET}")
                |> range(start: {influx_time_range})
                |> filter(fn: (r) => r._measurement == "sensor_measurement" and r.sensor_id == "{sensor_id}" and r._field == "value")
                |> keep(columns: ["_time", "_value"])
                |> sort(columns: ["_time"], desc: false)
            '''
            # Optional: Add aggregation based on the *InfluxDB* time range for performance
            # if influx_time_range in ["-7d", "-30d"]: # Example
            #     aggregate_interval = "1h" if influx_time_range == "-7d" else "6h" # Adjust aggregation
            #     flux_query += f'|> aggregateWindow(every: {aggregate_interval}, fn: mean, createEmpty: false)\n'

            logging.debug(f"Executing InfluxDB query:\n{flux_query}")
            tables = query_api.query(query=flux_query, org=INFLUX_ORG)

            for table in tables:
                for record in table.records:
                    timestamp = record.get_time()
                    value = record.get_value()
                    if timestamp is not None and isinstance(value, (int, float, Decimal)):
                         history_data.append({
                            "timestamp": timestamp.isoformat(),
                            "value": float(value)
                         })

        logging.info(f"Returning {len(history_data)} history points for sensor '{sensor_id}'.")
        return jsonify({"history": history_data}), 200

    except InfluxDBError as e:
        # ... (Keep existing InfluxDBError handling) ...
        error_code = None; message = str(e);
        if e.response and e.response.headers: error_code = e.response.headers.get('X-Platform-Error-Code')
        log_message = f"InfluxDB query failed fetching history for sensor '{sensor_id}' "
        if error_code: log_message += f"(Code: {error_code})"
        log_message += f": {message}"
        logging.error(log_message, exc_info=True)
        abort(502, description="Failed to retrieve sensor history from data store.")
    except Exception as e:
        logging.error(f"Unexpected error fetching sensor history '{sensor_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred fetching sensor history.")

@groups_bp.route('/connected-groups', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def get_connected_groups():
    """Fetches parent and direct children of a specific group."""
    logging.info(f"Request received for POST {groups_bp.name}.connected-groups")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId'):
        abort(400, description="Missing required field: 'groupId'.")
    group_id = data['groupId']

    try:
        target_group = db.query(Group.id, Group.parent_id).filter(Group.id == group_id).one_or_none()
        if not target_group:
            abort(404, description=f"Group '{group_id}' not found.")

        query = db.query(Group).options(
            selectinload(Group.sensors), 
            selectinload(Group.rules),
            selectinload(Group.rule_sets), 
            selectinload(Group.tags)
        ).filter(
            or_(
                Group.parent_id == group_id, # Children
                Group.id == target_group.parent_id # Parent
            )
        ).order_by(Group.name)

        connected_groups_orm = query.all()

        groups_list = [_format_group_response(group) for group in connected_groups_orm]

        logging.info(f"Returning {len(groups_list)} connected groups for group '{group_id}'.")
        return jsonify({"groups": groups_list}), 200

    except SQLAlchemyError as e:
        logging.error(f"DB error fetching connected groups for '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve connected groups.")
    except Exception as e:
        logging.error(f"Unexpected error fetching connected groups for '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving connected groups.")


@groups_bp.route('/update-health', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def update_group_health_status():
    """Update the health status of a specific group."""
    logging.info(f"Request received for POST {groups_bp.name}.update-health")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId') or 'health' not in data:
        abort(400, description="Missing required fields: 'groupId', 'health'.")

    group_id = data['groupId']
    health_value = data['health']

    if not isinstance(health_value, int) or not (0 <= health_value <= 100):
        abort(400, description="Invalid health value. Must be an integer between 0 and 100.")

    try:
        group = db.get(Group, group_id)
        if not group:
             abort(404, description=f"Group '{group_id}' not found.")

        group.health = health_value
        db.commit()

        logging.info(f"Updated health for group '{group_id}' to {health_value}.")
        return jsonify({"success": True}), 200

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error updating health for '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to update group health.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating health for '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while updating health.")


@groups_bp.route('/add-event', methods=['POST'])
@jwt_required() # Uncomment when JWT is fully integrated
def add_event_to_group():
    """Adds a new event record for a specific group."""
    logging.info(f"Request received for POST {groups_bp.name}.add-event")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data or not data.get('groupId') or not data.get('event'):
        abort(400, description="Missing required fields: 'groupId', 'event'.")

    group_id = data['groupId']
    event_data = data['event']

    if not event_data.get('event_date') or not event_data.get('event_type'):
        abort(400, description="Event data missing required fields: 'event_date', 'event_type'.")

    event_date_obj = None
    try:
        event_date_obj = datetime.fromisoformat(event_data['event_date'].replace('Z', '+00:00')).date()
    except (ValueError, TypeError):
         abort(400, description=f"Invalid date format for event_date: '{event_data['event_date']}'. Use ISO format.")

    try:
        group_exists = db.query(Group.id).filter(Group.id == group_id).scalar() is not None
        if not group_exists:
             abort(404, description=f"Group '{group_id}' not found.")

        new_event = GroupEvent(
            group_id=group_id,
            event_date=event_date_obj,
            event_type=event_data['event_type'],
            description=event_data.get('description'),
            event_ref_id=event_data.get('event_ref_id')
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)

        logging.info(f"Added event (ID: {new_event.event_table_id}) for group '{group_id}'.")
        return jsonify({"event": _format_event_response(new_event)}), 201

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"DB error adding event for '{group_id}': {e}", exc_info=True)
        abort(500, description="Failed to add group event.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error adding event for '{group_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while adding event.")