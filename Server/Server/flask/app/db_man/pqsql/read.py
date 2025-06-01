####################################################
# read functions, - historic archive, but some works now
# Last version of update: v0.95
# app/db_man/pqsql/read.py
####################################################

from typing import List, Optional
from sqlalchemy.orm import Session, joinedload, selectinload
from app.db_man.pqsql.models import (
    User, Tag, Group, Schedule, RuleSet, Rule, RuleInitiator, RuleAction,
    Sensor, ScheduleCondition, GroupEvent, AvailableSensorsDatabase, SessionAuth,
    Config, ServerConfig, JwtBlocklist
)
from datetime import datetime, timezone
import logging

# --- User Reading (Web User) ---
def get_user(db: Session, client_id: str) -> Optional[User]:
    """Gets a web application user by their identifier."""
    return db.get(User, client_id)

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Gets a list of web application users."""
    return db.query(User).offset(skip).limit(limit).all()

# --- Sensor Client System Reading ---
def get_available_sensors_db(db: Session, client_id: str) -> Optional[AvailableSensorsDatabase]:
    """Gets a sensor client system definition by its ID."""
    return db.get(AvailableSensorsDatabase, client_id)

def get_available_sensors_db_with_details(db: Session, client_id: str) -> Optional[AvailableSensorsDatabase]:
    """Gets a sensor client system definition, eagerly loading related entities."""
    return db.query(AvailableSensorsDatabase).options(
        selectinload(AvailableSensorsDatabase.sessions),
        joinedload(AvailableSensorsDatabase.config), # Use joinedload for one-to-one
        selectinload(AvailableSensorsDatabase.sensors).selectinload(Sensor.group) # Load sensors and their groups
    ).get(client_id)

def get_all_available_sensors_db(db: Session, skip: int = 0, limit: int = 100) -> List[AvailableSensorsDatabase]:
    """Gets a list of all sensor client system definitions."""
    return db.query(AvailableSensorsDatabase).offset(skip).limit(limit).all()

# --- Sensor Client Session Reading ---
def get_session(db: Session, session_id: str) -> Optional[SessionAuth]:
    """Gets a sensor client session by id, regardless of expiry or availability."""
    return db.get(SessionAuth, session_id)

def get_valid_session(db: Session, session_id: str) -> Optional[SessionAuth]:
    """Gets a sensor client session by id only if  and not expired."""
    now = datetime.now(timezone.utc)
    return db.query(SessionAuth).filter(
        SessionAuth.session_id == session_id,
        SessionAuth.session_end > now
    ).first()

def get_sessions_by_client_system(db: Session, client_id: str) -> List[SessionAuth]:
    """Gets all sessions associated with a specific sensor client system."""
    return db.query(SessionAuth).filter(SessionAuth.client_id == client_id).all()


# --- Sensor Client Config Reading ---
def get_config(db: Session, client_id: str) -> Optional[Config]:
    """Gets the configuration for a specific sensor client system."""
    return db.get(Config, client_id)

# --- Sensor Reading ---
def get_sensor(db: Session, sensor_id: str) -> Optional[Sensor]:
    """Gets a sensor by id."""
    return db.get(Sensor, sensor_id)

def get_sensor_with_details(db: Session, sensor_id: str) -> Optional[Sensor]:
    """Gets a sensor by id, eagerly loading linked group and client system."""
    return db.query(Sensor).options(
        joinedload(Sensor.group),
        joinedload(Sensor.client_system)
    ).get(sensor_id)

def get_sensors(db: Session, skip: int = 0, limit: int = 100) -> List[Sensor]:
    """Gets a list of all sensors."""
    return db.query(Sensor).offset(skip).limit(limit).all()

def get_sensors_by_group(db: Session, group_id: str) -> List[Sensor]:
    """Gets all sensors assigned to a specific group."""
    return db.query(Sensor).filter(Sensor.group_id == group_id).all()

def get_sensors_by_client_system(db: Session, client_id: str) -> List[Sensor]:
    """Gets all sensors belonging to a specific sensor client system."""
    return db.query(Sensor).filter(Sensor.client_id == client_id).all()

def get_unassigned_sensors_by_client_system(db: Session, client_id: str) -> List[Sensor]:
    """Gets sensors for a client system that are not assigned to any group."""
    return db.query(Sensor).filter(Sensor.client_id == client_id, Sensor.group_id == None).all()

# --- Tag Reading ---
def get_tag(db: Session, tag_id: str) -> Optional[Tag]:
    """Gets a tag by id."""
    return db.get(Tag, tag_id)

def get_tags(db: Session, skip: int = 0, limit: int = 100) -> List[Tag]:
    """Gets a list of tags."""
    return db.query(Tag).offset(skip).limit(limit).all()

def get_tags_by_type(db: Session, tag_type: str) -> List[Tag]:
    """Gets tags filtered by type."""
    return db.query(Tag).filter(Tag.type == tag_type).all()

# --- Group Reading ---
def get_group(db: Session, group_id: str) -> Optional[Group]:
    """Gets a group by id."""
    return db.get(Group, group_id)

def get_group_with_details(db: Session, group_id: str) -> Optional[Group]:
    """Gets a group by id, eagerly loading relationships."""
    return db.query(Group).options(
        selectinload(Group.tags),
        selectinload(Group.rules),
        selectinload(Group.rule_sets),
        selectinload(Group.schedules),
        selectinload(Group.subgroups),
        joinedload(Group.parent),
        selectinload(Group.sensors) # Eager load sensors
    ).get(group_id)

def get_groups(db: Session, skip: int = 0, limit: int = 100) -> List[Group]:
    """Gets a list of groups."""
    return db.query(Group).offset(skip).limit(limit).all()

def get_subgroups(db: Session, parent_group_id: str) -> List[Group]:
    """Gets subgroups for a given parent group."""
    return db.query(Group).filter(Group.parent_id == parent_group_id).all()

# --- Schedule Reading ---
def get_schedule(db: Session, schedule_id: str) -> Optional[Schedule]:
    """Gets a schedule by id."""
    return db.get(Schedule, schedule_id)

def get_schedule_with_details(db: Session, schedule_id: str) -> Optional[Schedule]:
    """Gets a schedule by id, eagerly loading conditions and assigned groups."""
    return db.query(Schedule).options(
        selectinload(Schedule.conditions),
        selectinload(Schedule.assigned_groups),
        joinedload(Schedule.meteo_station) # if meteo_station is frequently needed
    ).get(schedule_id)

def get_schedules(db: Session, skip: int = 0, limit: int = 100) -> List[Schedule]:
    """Gets a list of schedules."""
    return db.query(Schedule).offset(skip).limit(limit).all()

def get_schedules_by_status(db: Session, status: str) -> List[Schedule]:
    """Gets schedules filtered by status."""
    return db.query(Schedule).filter(Schedule.status == status).all()

# --- RuleSet Reading ---
def get_rule_set(db: Session, rule_set_id: str) -> Optional[RuleSet]:
    """Gets a rule set by id."""
    return db.get(RuleSet, rule_set_id)

def get_rule_sets(db: Session, skip: int = 0, limit: int = 100) -> List[RuleSet]:
    """Gets a list of rule sets."""
    return db.query(RuleSet).offset(skip).limit(limit).all()

# --- Rule Reading ---
def get_rule(db: Session, rule_id: str) -> Optional[Rule]:
    """Gets a rule by id."""
    return db.get(Rule, rule_id)

def get_rule_with_details(db: Session, rule_id: str) -> Optional[Rule]:
    """Gets a rule by id, eagerly loading initiators, actions, and related tags/groups."""
    return db.query(Rule).options(
        selectinload(Rule.initiators).selectinload(RuleInitiator.tags),
        selectinload(Rule.actions),
        selectinload(Rule.specific_groups),
        selectinload(Rule.applies_to_tags),
        selectinload(Rule.directly_applied_to_groups),
        selectinload(Rule.rule_sets) # Load the sets this rule belongs to
    ).get(rule_id)

def get_rules(db: Session, skip: int = 0, limit: int = 100) -> List[Rule]:
    """Gets a list of rules."""
    return db.query(Rule).offset(skip).limit(limit).all()

# --- Server Config Reading ---
def get_server_config(db: Session, config_name: str) -> Optional[ServerConfig]:
    """Gets a server configuration item by name."""
    return db.get(ServerConfig, config_name)

def get_all_server_configs(db: Session) -> List[ServerConfig]:
    """Gets all server configuration items."""
    return db.query(ServerConfig).all()

# --- JWT Blocklist Check ---
def is_token_blocklisted(db: Session, jti: str) -> bool:
    """Checks if a JWT token identifier is in the blocklist."""
    # Use query().get() style check for potentially better performance if JTI is indexed
    return db.query(JwtBlocklist).filter(JwtBlocklist.jti == jti).first() is not None

# --- GroupEvent Reading ---
def get_group_events(db: Session, group_id: str, skip: int = 0, limit: int = 100) -> List[GroupEvent]:
    """Gets events for a specific group, ordered by date descending."""
    return db.query(GroupEvent).filter(GroupEvent.group_id == group_id)\
             .order_by(GroupEvent.event_date.desc())\
             .offset(skip).limit(limit).all()


def get_hub_id_from_session(db: Session, session_id: str) -> Optional[str]:
    """
    Retrieves the hub_id (client_id) associated with a given session_id
    from the session_auth table.

    Args:
        db: The SQLAlchemy Session instance (e.g., obtained from DbRequestSession()).
        session_id: The session ID (primary key of session_auth table) to look up.

    Returns:
        The client_id (hub_id) as a string if the session is found and valid,
        otherwise None. Returns None on database errors as well.
    """
    if not session_id:
        logging.warning("Attempted to get hub ID with empty/null session_id.")
        return None

    logging.debug(f"Querying database for hub_id associated with session_id: {session_id}")
    try:
        # Use db.get for efficient primary key lookup (SQLAlchemy 1.4+)
        session_record = db.get(SessionAuth, session_id)

        # Check if a record was found
        if session_record:
            logging.info(f"Session record found for session_id {session_id}. Associated hub_id: {session_record.client_id}")
            # You might add extra checks here if needed, e.g., checking if session_end is in the future
            # if session_record.session_end > datetime.now(timezone.utc):
            #     return session_record.client_id
            # else:
            #     log.warning(f"Session {session_id} found but has expired.")
            #     return None # Treat expired session as not found for this purpose
            return session_record.client_id # Return the client_id directly
        else:
            logging.warning(f"No session record found for session_id: {session_id}")
            return None
    except Exception as e:
        # Log any other unexpected errors
        logging.error(f"An unexpected error occurred while retrieving session {session_id}: {e}", exc_info=True)
        return None # Indicate failure