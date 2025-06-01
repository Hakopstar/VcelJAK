####################################################
# update functions, - historic archive, but some works now
# Last version of update: v0.95
# app/db_man/pqsql/update.py
####################################################

from sqlalchemy.orm import Session
from app.db_man.pqsql.models import (
    User, Tag, Group, Schedule, RuleSet, Rule, RuleInitiator, RuleAction,
    Sensor, ScheduleCondition, GroupEvent, AvailableSensorsDatabase, SessionAuth,
    Config, ServerConfig, JwtBlocklist
)
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timezone

# --- User Update (Web User) ---
def update_user_hash(db: Session, client_id: str, new_hash: str) -> Optional[User]:
    """Updates a web user's hash."""
    db_user = db.get(User, client_id)
    if db_user:
        db_user.client_hash = new_hash
        db.commit()
        db.refresh(db_user)
        return db_user
    return None

# --- Sensor Client System Update ---
def update_available_sensors_db(db: Session, client_id: str, update_data: Dict[str, Any]) -> Optional[AvailableSensorsDatabase]:
    """Updates a sensor client system definition."""
    db_client = db.get(AvailableSensorsDatabase, client_id)
    if db_client:
        # Prevent direct update of relationship collections via setattr
        relationship_keys = ['sessions', 'config', 'sensors']
        # Prevent updating the primary key
        if 'client_id' in update_data:
            del update_data['client_id']

        for key, value in update_data.items():
            if hasattr(db_client, key) and key not in relationship_keys:
                setattr(db_client, key, value)
        db.commit()
        db.refresh(db_client)
        return db_client
    return None

# --- Sensor Client Session Update ---
def update_session(db: Session, session_id: str, update_data: Dict[str, Any]) -> Optional[SessionAuth]:
    """Updates a sensor client session's attributes."""
    db_session = db.get(SessionAuth, session_id)
    if db_session:
        # Prevent changing client_id or session_id directly
        if 'client_id' in update_data: del update_data['client_id']
        if 'session_id' in update_data: del update_data['session_id']

        for key, value in update_data.items():
            if hasattr(db_session, key):
                # Datetime/Boolean handling
                if key == 'session_end' and isinstance(value, str):
                     try: value = datetime.fromisoformat(value)
                     except ValueError: raise ValueError("Invalid session_end format")
                if key == 'session_end' and isinstance(value, datetime) and value.tzinfo is None:
                    value = value.replace(tzinfo=timezone.utc) # Assume UTC if naive
                setattr(db_session, key, value)
        db.commit()
        db.refresh(db_session)
        return db_session
    return None

# --- Sensor Client Config Update ---
def update_config(db: Session, client_id: str, update_data: Dict[str, Any]) -> Optional[Config]:
    """Updates a sensor client system's configuration."""
    db_config = db.get(Config, client_id)
    if db_config:
        # Prevent changing client_id
        if 'client_id' in update_data: del update_data['client_id']

        # Handle potential typo in input keys if needed
        if "network_strenght_unit" in update_data and "network_strength_unit" not in update_data:
            update_data["network_strength_unit"] = update_data.pop("network_strenght_unit")

        for key, value in update_data.items():
             if hasattr(db_config, key):
                setattr(db_config, key, value)
        db.commit()
        db.refresh(db_config)
        return db_config
    return None

# --- Sensor Update ---
def update_sensor(db: Session, sensor_id: str, update_data: Dict[str, Any]) -> Optional[Sensor]:
    """Updates a sensor's attributes (e.g., calibration_value, group_id, client_id)."""
    db_sensor = db.get(Sensor, sensor_id)
    if db_sensor:
        # Prevent updating id directly
        if 'id' in update_data: del update_data['id']

        for key, value in update_data.items():
            if hasattr(db_sensor, key) and key not in ['group', 'client_system']:
                # Validate foreign keys if being changed
                if key == 'group_id' and value is not None and not db.get(Group, value):
                     raise ValueError(f"Group with id {value} not found.")
                if key == 'client_id' and value is not None and not db.get(AvailableSensorsDatabase, value):
                     raise ValueError(f"Sensor Client System with id {value} not found.")
                setattr(db_sensor, key, value)
        db.commit()
        db.refresh(db_sensor)
        return db_sensor
    return None

def assign_sensor_to_group(db: Session, sensor_id: str, group_id: Optional[str]) -> Optional[Sensor]:
    """Assigns an existing sensor to a group, or removes assignment if group_id is None."""
    db_sensor = db.get(Sensor, sensor_id)
    if not db_sensor:
        return None
    # Validate group exists if group_id is provided
    if group_id and not db.get(Group, group_id):
        raise ValueError(f"Group with id {group_id} not found.")

    db_sensor.group_id = group_id
    db.commit()
    db.refresh(db_sensor)
    return db_sensor

# remove_sensor_from_group can be replaced by assign_sensor_to_group(..., group_id=None)

# --- Tag Update ---
def update_tag(db: Session, tag_id: str, update_data: Dict[str, Any]) -> Optional[Tag]:
    """Updates a tag's attributes."""
    db_tag = db.get(Tag, tag_id)
    if db_tag:
        if 'id' in update_data: del update_data['id'] # Cannot change PK
        for key, value in update_data.items():
            if hasattr(db_tag, key):
                setattr(db_tag, key, value)
        db.commit()
        db.refresh(db_tag)
        return db_tag
    return None

# --- Group Update ---
def update_group(db: Session, group_id: str, update_data: Dict[str, Any]) -> Optional[Group]:
    """Updates a group's attributes (excluding relationships handled separately)."""
    db_group = db.get(Group, group_id)
    if db_group:
        # Prevent direct update of relationship collections via setattr
        relationship_keys = ['tags', 'rules', 'schedules', 'parent', 'subgroups', 'rule_sets', 'rules_specific_to', 'sensors']
        # Prevent changing PK
        if 'id' in update_data: del update_data['id']

        for key, value in update_data.items():
            if hasattr(db_group, key) and key not in relationship_keys:
                if key == 'parent_id':
                    if value is not None and not db.get(Group, value):
                        raise ValueError(f"New parent group with id {value} not found.")
                setattr(db_group, key, value)
        db.commit()
        db.refresh(db_group)
        return db_group
    return None

def set_group_tags(db: Session, group_id: str, tag_ids: List[str]) -> Optional[Group]:
    """Replaces a group's tags with a new set."""
    db_group = db.get(Group, group_id)
    if db_group:
        new_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        db_group.tags = new_tags # Replace the list
        db.commit()
        return db_group
    return None

def add_rules_to_group(db: Session, group_id: str, rule_ids: List[str]) -> Optional[Group]:
    """Adds specific rules to a group (M2M)."""
    db_group = db.get(Group, group_id)
    if not db_group: return None
    rules_to_add = db.query(Rule).filter(Rule.id.in_(rule_ids)).all()
    if len(rules_to_add) != len(rule_ids):
        raise ValueError("One or more rule IDs not found.")
    # Avoid adding duplicates
    existing_rule_ids = {rule.id for rule in db_group.rules}
    for rule in rules_to_add:
        if rule.id not in existing_rule_ids:
            db_group.rules.append(rule)
    db.commit()
    return db_group

def remove_rules_from_group(db: Session, group_id: str, rule_ids: List[str]) -> Optional[Group]:
    """Removes specific rules from a group (M2M)."""
    db_group = db.get(Group, group_id)
    if not db_group: return None
    rules_to_remove = db.query(Rule).filter(Rule.id.in_(rule_ids)).all()
    # Check if all requested rules are actually linked before trying to remove
    linked_rule_ids = {rule.id for rule in db_group.rules}
    for rule in rules_to_remove:
        if rule.id in linked_rule_ids:
            db_group.rules.remove(rule)
        # else: Warning: rule not found on group?
    db.commit()
    return db_group


# --- Schedule Update ---
def update_schedule(db: Session, schedule_id: str, update_data: Dict[str, Any]) -> Optional[Schedule]:
    """Updates a schedule's attributes."""
    db_schedule = db.get(Schedule, schedule_id)
    if db_schedule:
        if 'id' in update_data: del update_data['id'] # Cannot change PK
        # Prevent direct update of relationship collections
        relationship_keys = ['conditions', 'assigned_groups', 'meteo_station']
        for key, value in update_data.items():
             if hasattr(db_schedule, key) and key not in relationship_keys:
                 # Handle date/datetime conversions if needed
                 setattr(db_schedule, key, value)
        # last_modified is updated automatically by onupdate
        db.commit()
        db.refresh(db_schedule)
        return db_schedule
    return None

def assign_schedule_to_groups(db: Session, schedule_id: str, group_ids: List[str]) -> Optional[Schedule]:
    """Assigns a schedule to a list of groups (replaces existing)."""
    db_schedule = db.get(Schedule, schedule_id)
    if not db_schedule: return None
    groups = db.query(Group).filter(Group.id.in_(group_ids)).all()
    if len(groups) != len(group_ids):
        raise ValueError("One or more group IDs not found.")
    db_schedule.assigned_groups = groups
    db.commit()
    return db_schedule

# --- RuleSet Update ---
def update_rule_set(db: Session, rule_set_id: str, update_data: Dict[str, Any]) -> Optional[RuleSet]:
    """Updates a RuleSet's attributes."""
    db_rule_set = db.get(RuleSet, rule_set_id)
    if db_rule_set:
        if 'id' in update_data: del update_data['id'] # Cannot change PK
        relationship_keys = ['rules', 'groups']
        for key, value in update_data.items():
            if hasattr(db_rule_set, key) and key not in relationship_keys:
                setattr(db_rule_set, key, value)
        db.commit()
        db.refresh(db_rule_set)
        return db_rule_set
    return None

# --- Rule Update ---
def update_rule(db: Session, rule_id: str, update_data: Dict[str, Any]) -> Optional[Rule]:
    """Updates a rule's attributes."""
    db_rule = db.get(Rule, rule_id)
    if db_rule:
        if 'id' in update_data: del update_data['id'] # Cannot change PK
        relationship_keys = ['initiators', 'actions', 'rule_sets', 'specific_groups', 'applies_to_tags', 'directly_applied_to_groups']
        for key, value in update_data.items():
            if hasattr(db_rule, key) and key not in relationship_keys:
                 # Handle rule_set_id change specifically if needed
                if key == 'rule_set_id' and value is not None and not db.get(RuleSet, value):
                     raise ValueError(f"RuleSet with id {value} not found.")
                setattr(db_rule, key, value)
        db.commit()
        db.refresh(db_rule)
        return db_rule
    return None

# --- Server Config Update (effectively UPSERT) ---
def set_server_config(db: Session, config_name: str, value: str = None, **kwargs) -> ServerConfig:
    """Creates or updates a server configuration item."""
    db_config = db.get(ServerConfig, config_name)
    if db_config:
        db_config.value = value
        for key, val in kwargs.items():
            if hasattr(db_config, key):
                setattr(db_config, key, val)
    else:
        db_config = ServerConfig(config_name=config_name, value=value, **kwargs)
        db.add(db_config)
    db.commit()
    # Refresh required as `db_config` might be the old or new object depending on if it existed
    db.refresh(db_config)
    return db_config