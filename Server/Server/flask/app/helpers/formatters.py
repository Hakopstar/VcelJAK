####################################
# Routes output input formatter 
# Last version of update: v0.95
# app/helpers/formatters.py
####################################

from app.db_man.pqsql.models import AvailableSensorsDatabase
import re
import uuid
import logging

from app.db_man.pqsql.models import Group, Sensor, Rule, RuleSet, Tag, GroupEvent, RuleInitiator
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm import selectinload, joinedload, Session, raiseload # Import Session for type hint
from sqlalchemy import desc, or_, Column

def _format_hub_details_basic(hub: AvailableSensorsDatabase) -> dict:
    """Formats a hub ORM object into the basic dictionary structure after creation."""
    # This basic version is used right after creation/rename
    # The main list comes from get_hubs() which has more details
    return {
        "uuid": hub.client_id, # Map client_id to uuid for frontend
        "name": hub.client_name,
        "connectedSensors": 0, 
        "lastUpdate": "N/A",   
    }


def _generate_group_id(name: str) -> str:
    """Generates a likely unique ID from a group name."""
    # ... (implementation remains the same) ...
    s = name.lower()
    s = re.sub(r'[^\w\-]+', '', s) # Allow alphanumeric and hyphens
    s = re.sub(r'\s+', '-', s).strip('-')
    if not s:
        return f"group-{uuid.uuid4()}" # Use UUID if name yields empty string
    # Add a short uuid hash to reduce collision probability further
    return f"{s}-{str(uuid.uuid4())[:4]}"

def _generate_id(prefix: str) -> str:
    """Generates a prefixed unique ID."""
    return f"{prefix}-{uuid.uuid4()}"

def _format_group_response(group: Group, subgroup_map: dict | None = None) -> dict:
    """
    Formats a Group ORM object into the dictionary structure for API responses.
    Accepts an OPTIONAL pre-fetched map of parent_id -> list[child_id].
    """
    logging.debug(f"-- Formatting group ID: {getattr(group, 'id', 'N/A')}")
    data = {}
    errors = []
    group_id = getattr(group, 'id', None)

    # Default subgroups list (used if map not provided or group not in map)
    default_subgroups = []

    def safe_get(attr_name, default=None, is_list=False, is_id_list=False, is_date=False):
        """Safely gets attributes and handles basic formatting/errors."""
        try:
            value = getattr(group, attr_name, default)
            if isinstance(value, Column):
                logging.error(f"!!! Formatting Error: Attribute '{attr_name}' is a Column object!")
                errors.append(attr_name)
                return default
            if value is None:
                return None

            # --- SUBGROUP HANDLING ---
            # Check specifically for the 'subgroups' attribute name
            if attr_name == "subgroups":
                 # Use the map ONLY if it's provided and the group_id is found
                if subgroup_map is not None and group_id is not None:
                    return subgroup_map.get(group_id, default_subgroups) # Use map
                else:
                    # Otherwise, return the default (empty list)
                    return default_subgroups
            # --- END SUBGROUP HANDLING ---

            # Handle other list types
            if is_id_list:
                if hasattr(value, '__iter__') and not isinstance(value, str):
                    return [item.id for item in value if hasattr(item, 'id')]
                else:
                    logging.warning(f"Attribute '{attr_name}' expected list for ID extraction, got {type(value)}. Returning [].")
                    return []
            elif is_list: # General list of IDs (kept for potential other uses)
                return [item.id for item in value] if value else []
            elif is_date:
                return value.isoformat() if value else None
            else: # Handle regular attributes
                return value
        except Exception as e:
            logging.error(f"Error accessing/formatting attribute '{attr_name}': {e}", exc_info=False)
            errors.append(attr_name)
            return default

    # Populate the data dictionary using safe_get
    data["id"] = group_id
    data["name"] = safe_get("name")
    data["type"] = safe_get("type")
    data["description"] = safe_get("description")
    data["parentId"] = safe_get("parent_id")
    data["sensors"] = safe_get("sensors", default=[], is_id_list=True)
    data["rules"] = safe_get("rules", default=[], is_id_list=True)
    data["ruleSets"] = safe_get("rule_sets", default=[], is_id_list=True)
    data["tags"] = safe_get("tags", default=[], is_id_list=True)
    data["subgroups"] = safe_get("subgroups", default=default_subgroups)
    data["inspectionDate"] = safe_get("last_inspection", is_date=True)
    data["location"] = safe_get("location")
    data["automatic_mode"] = safe_get("automatic_mode")
    data["mode"] = safe_get("mode")
    data["health"] = safe_get("health")
    data["beehive_type"] = safe_get("beehive_type")
    data["is_main"] = safe_get("is_main")

    if errors:
        logging.error(f"Formatting group ID {data.get('id', 'N/A')} encountered errors on attributes: {errors}")

    logging.debug(f"-- Formatted group data: {data}")
    return data

def _format_sensor_response(sensor: Sensor) -> dict:
    """Formats a Sensor ORM object for API responses."""
    return {
        "id": sensor.id,
        "name": f"{sensor.measurement.capitalize()} ({sensor.id}) Hub: {sensor.client_id or 'N/A'}",
        "type": sensor.measurement,
        "location": None,
        "status": None,
        "assignedGroupId": sensor.group_id,
        "value": sensor.last_reading_value
    }

def _format_action(action) -> dict:
    """Formats a RuleAction ORM object into the dictionary for API responses."""
    return {
        "id": action.action_id,
        "action_type": action.action_type,
        "action_params": action.action_params or {},
        "execution_order": action.execution_order
    }
def _format_initiator(initiator: RuleInitiator) -> dict:
    """Formats a RuleInitiator ORM object into the dictionary for API responses."""
    return {
        # Return the DB's primary key for this initiator instance
        "id": initiator.initiator_table_id,
        "ref_id": initiator.initiator_ref_id,
        "type": initiator.type,
        "operator": initiator.operator,
        "value": float(initiator.value) if initiator.value is not None else None,
        "value2": float(initiator.value2) if initiator.value2 is not None else None,
        "scheduleType": initiator.schedule_type,
        "scheduleValue": initiator.schedule_value,
        "tags": [tag.id for tag in initiator.tags] if initiator.tags else []
    }

def _format_rule_response(rule: Rule) -> dict:
    """Formats a Rule ORM object into the detailed dictionary for API responses."""
    formatted_actions = sorted(
        [_format_action(act) for act in rule.actions],
        key=lambda x: x.get('execution_order', 0)
    )

 
    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "initiators": [_format_initiator(init) for init in rule.initiators],
        "logicalOperator": rule.logical_operator,
        "actions": formatted_actions, # Full list (likely just one based on FE)
        "action": formatted_actions[0].get('action_type') if formatted_actions else None,
        "actionParams": formatted_actions[0].get('action_params') if formatted_actions else {},
        "isActive": rule.is_active,
    
        # 'tags' field name already matches FE expectation for appliesTo='tagged'
        "ruleSet": rule.rule_set_id or "none",
        "priority": rule.priority,

    }

def _format_event_response(event: GroupEvent) -> dict:
    """Formats a GroupEvent ORM object for API responses."""
    return {
        "id": event.event_table_id,
        "event_date": event.event_date.isoformat(),
        "event_type": event.event_type,
        "description": event.description or "",
        "event_ref_id": event.event_ref_id,
        "group_id": event.group_id
    }
# --- FORMATTER FOR LIST VIEW ---
def _format_group_list_item(group: Group, subgroup_map: dict | None = None) -> dict:
    """
    Formats a Group ORM object for the LIST view API response.
    Includes only IDs for relationships.
    """
    group_id = getattr(group, 'id', None)
    subgroup_ids = []
    if subgroup_map is not None and group_id is not None:
        subgroup_ids = subgroup_map.get(group_id, [])

    # Helper to safely get attribute or return default
    def safe_get_attr(attr_name, default=None):
        return getattr(group, attr_name, default)

    # Helper to get list of IDs from a relationship attribute
    def get_id_list(attr_name):
        related_items = safe_get_attr(attr_name, [])
        return [item.id for item in related_items if hasattr(item, 'id')]

    return {
        "id": group_id,
        "name": safe_get_attr("name"),
        "type": safe_get_attr("type"),
        "description": safe_get_attr("description"),
        "parentId": safe_get_attr("parent_id"),
        "sensors": get_id_list("sensors"),
        "rules": get_id_list("rules"),
        "ruleSets": get_id_list("rule_sets"),
        "tags": get_id_list("tags"),
        "subgroups": subgroup_ids, # From the map
        "inspectionDate": safe_get_attr("last_inspection").isoformat() if safe_get_attr("last_inspection") else None,
        "location": safe_get_attr("location"),
        "automatic_mode": safe_get_attr("automatic_mode", False),
        "mode": safe_get_attr("mode"),
        "health": safe_get_attr("health"),
        "beehive_type": safe_get_attr("beehive_type"),
        "is_main": safe_get_attr("is_main", False)
    }

# --- FORMATTER FOR DETAIL VIEW ---
def _format_group_detail_response(group: Group, subgroup_map: dict | None = None) -> dict:
    """
    Formats a Group ORM object for the DETAIL view API response.
    Includes detailed info (id, name) for relationships.
    """
    group_id = getattr(group, 'id', None)
    subgroup_ids = []
    if subgroup_map is not None and group_id is not None:
        subgroup_ids = subgroup_map.get(group_id, [])

    # Helper to safely get attribute or return default
    def safe_get_attr(attr_name, default=None):
        # Prevent accessing unloaded attributes if raiseload('*') was used effectively
        # Although direct getattr should be safe if attributes exist on the model
        return getattr(group, attr_name, default)

    # Helper to get list of {id, name} dicts from relationship attribute
    def get_id_list(attr_name):
        related_items = safe_get_attr(attr_name, [])
        # Ensure items are loaded and have id before accessing
        return [item.id for item in related_items if hasattr(item, 'id')]

    return {
        "id": group_id,
        "name": safe_get_attr("name"),
        "type": safe_get_attr("type"),
        "description": safe_get_attr("description"),
        "parentId": safe_get_attr("parent_id"),
        "sensors": get_id_list("sensors"),
        "rules": get_id_list("rules"),
        "ruleSets": get_id_list("rule_sets"),
        "tags": get_id_list("tags"),
        "subgroups": subgroup_ids, 
        "lastInspection": safe_get_attr("last_inspection").isoformat() if safe_get_attr("last_inspection") else None, # Rename key# Rename key (Verify FE type needs this)
        "location": safe_get_attr("location"),
        "automaticMode": safe_get_attr("automatic_mode", False), # Change key case
        "mode": safe_get_attr("mode"),
        "health": safe_get_attr("health"),
        "beehiveType": safe_get_attr("beehive_type"), # Change key case
        "isMain": safe_get_attr("is_main", False), # Change key case
    }

def _format_rule_detail(rule: Rule) -> dict:
    """Formats a Rule ORM object into the detailed dictionary for API responses."""
    formatted_actions = sorted(
        [_format_action(act) for act in rule.actions],
        key=lambda x: x.get('execution_order', 0)
    )

 
    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "initiators": [_format_initiator(init) for init in rule.initiators],
        "logicalOperator": rule.logical_operator,
        # Keep both for compatibility, assuming FE uses top-level ones mainly
        "actions": formatted_actions, # Full list (likely just one based on FE)
        "action": formatted_actions[0].get('action_type') if formatted_actions else None,
        "actionParams": formatted_actions[0].get('action_params') if formatted_actions else {},
        "isActive": rule.is_active,
    
        # 'tags' field name already matches FE expectation for appliesTo='tagged'
        "ruleSet": rule.rule_set_id or "none",
        "priority": rule.priority,

    }

def _format_ruleset_detail(ruleset: RuleSet) -> dict:
    """Formats a RuleSet ORM object into the dictionary for API responses."""
    return {
        "id": ruleset.id,
        "name": ruleset.name,
        "description": ruleset.description,
        "isActive": ruleset.is_active,
        "rules": [rule.id for rule in ruleset.rules] # Return list of rule IDs
    }

def _format_tag_for_rule_frontend(tag: Tag) -> dict:
    """Formats Tag into the 'RuleTag' structure expected by frontend."""
    # Assuming frontend 'RuleTag' matches these fields
    return {
        "id": tag.id,
        "name": tag.name,
        "type": tag.type,
        # Add color/alertLevel if they exist directly on Tag model or map from description/JSONB
        "color": tag.color if hasattr(tag, 'color') else None, # Example if 'color' exists
        "alertLevel": tag.alert_level if hasattr(tag, 'alert_level') else None # Example
    }

def _format_group_for_rule_frontend(group: Group) -> dict:
    """Formats Group into the 'RuleGroup' structure expected by frontend."""
     # Assuming frontend 'RuleGroup' matches these fields
    return {
        "id": group.id,
        "name": group.name
    }