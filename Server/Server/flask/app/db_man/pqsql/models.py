      
####################################################
# SQLAlchemy Models
# Last version of update: v0.95
# app/db_man/pqsql/models.py
####################################################

import enum
from datetime import datetime, timezone, date
from sqlalchemy import (
    Column, String, Integer, Text, Date, DateTime, Boolean, Float, Numeric,
    ForeignKey, Table, CheckConstraint, Enum, desc # IMPORT desc if used elsewhere, not strictly needed for this snippet
)
# --- Make sure relationship and backref are imported ---
from sqlalchemy.orm import declarative_base, relationship, backref
# --------------------------------------------------------
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

Base = declarative_base()

# --- Association Tables (Many-to-Many) ---
# These define the structure but relationships are configured in models

schedule_assigned_groups = Table(
    "schedule_assigned_groups", Base.metadata,
    Column("schedule_id", Text, ForeignKey("schedules.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", Text, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)

ruleset_rules = Table(
    "ruleset_rules", Base.metadata,
    Column("ruleset_id", Text, ForeignKey("rule_sets.id", ondelete="CASCADE"), primary_key=True),
    Column("rule_id", Text, ForeignKey("rules.id", ondelete="CASCADE"), primary_key=True),
)

initiator_tags = Table(
    "initiator_tags", Base.metadata,
    Column("initiator_table_id", Integer, ForeignKey("rule_initiators.initiator_table_id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Text, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

group_rules = Table(
    "group_rules", Base.metadata,
    Column("group_id", Text, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("rule_id", Text, ForeignKey("rules.id", ondelete="CASCADE"), primary_key=True),
)

group_rule_sets = Table(
    "group_rule_sets", Base.metadata,
    Column("group_id", Text, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("ruleset_id", Text, ForeignKey("rule_sets.id", ondelete="CASCADE"), primary_key=True),
)

group_tags = Table(
    "group_tags", Base.metadata,
    Column("group_id", Text, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Text, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


# --- Model Classes ---

class Tag(Base):
    __tablename__ = 'tags'
    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    type = Column(Text, nullable=False) # e.g., 'purpose', 'mode', 'status'
    description = Column(Text)

    groups = relationship("Group", secondary=group_tags, back_populates="tags")
    initiator_conditions = relationship("RuleInitiator", secondary=initiator_tags, back_populates="tags")

    def __repr__(self):
        return f"<Tag(id='{self.id}', name='{self.name}', type='{self.type}')>"


class Group(Base):
    __tablename__ = 'groups'
    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    type = Column(Text, nullable=False) # e.g., 'beehive', 'meteostation', 'hive' (subgroup), 'generic'
    parent_id = Column(Text, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True) # Make sure nullable=True
    description = Column(Text)
    location = Column(Text)
    automatic_mode = Column(Boolean, nullable=False, default=False) # For beehive monitoring rules
    beehive_type = Column(Text) # Specific to 'beehive' type
    mode = Column(Text) # General mode, perhaps derived from tags or set directly
    health = Column(Integer, CheckConstraint('health >= 0 AND health <= 100'))
    last_inspection = Column(Date)
    is_main = Column(Boolean, default=False) # Specific to 'meteostation' type
    # Self-referential relationship for parent/subgroups
    parent = relationship(
        "Group",
        foreign_keys=[parent_id],
        remote_side=[id],
        backref=backref("subgroups", lazy="dynamic") # Use backref for group.subgroups access. lazy='dynamic' might be useful if you have many subgroups. Default 'select' is often fine.
    )

    # Group Events with default ordering
    events = relationship(
        "GroupEvent",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="desc(GroupEvent.event_date), desc(GroupEvent.event_table_id)" # Assuming GroupEvent model exists
    )

    # Relationships to other entities
    schedules = relationship("Schedule", secondary=schedule_assigned_groups, back_populates="assigned_groups")
    rules = relationship("Rule", secondary=group_rules, back_populates="directly_applied_to_groups") # Directly applied rules
    rule_sets = relationship("RuleSet", secondary=group_rule_sets, back_populates="groups")
    tags = relationship("Tag", secondary=group_tags, back_populates="groups")


    sensors = relationship(
        "Sensor",
        back_populates="group",

    )



    referenced_by_schedule_conditions = relationship("ScheduleCondition", foreign_keys="ScheduleCondition.group_id", back_populates="group") # Corrected FK reference

    def __repr__(self):
        parent_repr = f", parent_id='{self.parent_id}'" if self.parent_id else ""
        return f"<Group(id='{self.id}', name='{self.name}', type='{self.type}'{parent_repr})>"


class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Text, primary_key=True)
    # FK to the SENSOR CLIENT SYSTEM table, NO ACTION on delete at DB level
    client_id = Column(Text, ForeignKey("available_sensors_database.client_id"), nullable=True)
    measurement = Column(Text, nullable=False) # e.g., 'Temperature', 'Humidity', 'Weight'
    calibration_value = Column(Float)
    last_reading_time = Column(DateTime(timezone=True), nullable=True)
    last_reading_value = Column(Float, nullable=True)
    last_reading_unit = Column(Text, nullable=True)


    group_id = Column(Text, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)



    group = relationship("Group", back_populates="sensors")


    # Relationship to the client system (Hub)
    client_system = relationship("AvailableSensorsDatabase", back_populates="sensors")

    def __repr__(self):
        return f"<Sensor(id='{self.id}', measurement='{self.measurement}', client_id='{self.client_id}', group_id='{self.group_id}')>"




class Schedule(Base):
    __tablename__ = 'schedules'
    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    category = Column(Text)
    season = Column(Text)
    due_date = Column(Date)
    status = Column(Text, nullable=False, default='pending')
    progress = Column(Integer, CheckConstraint('progress >= 0 AND progress <= 100'), nullable=False, default=0)
    priority = Column(Text, default='medium')
    
    recommendations = Column(ARRAY(Text))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_modified = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completion_date = Column(Date)

    conditions = relationship("ScheduleCondition", back_populates="schedule", cascade="all, delete-orphan")
    assigned_groups = relationship("Group", secondary=schedule_assigned_groups, back_populates="schedules")

    def __repr__(self):
        return f"<Schedule(id='{self.id}', name='{self.name}', status='{self.status}')>"

class ScheduleCondition(Base):
    __tablename__ = 'schedule_conditions'
    condition_id = Column(Integer, primary_key=True)
    schedule_id = Column(Text, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    type = Column(Text)
    operator = Column(Text)
    value = Column(Text)
    unit = Column(Text)
    duration = Column(Integer)
    duration_unit = Column(Text)
    group_id = Column(Text, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True) # FK to the Group acting as station
    actual_value = Column(Text)
    last_update = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    schedule = relationship("Schedule", back_populates="conditions")
    group = relationship("Group", foreign_keys=[group_id], back_populates="referenced_by_schedule_conditions")

    def __repr__(self):
        return f"<ScheduleCondition(id={self.condition_id}, schedule_id='{self.schedule_id}', type='{self.type}')>"

class GroupEvent(Base):
    __tablename__ = 'group_events'
    event_table_id = Column(Integer, primary_key=True)
    group_id = Column(Text, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    event_ref_id = Column(Text)
    event_date = Column(Date, nullable=False)
    event_type = Column(Text)
    description = Column(Text)

    group = relationship("Group", back_populates="events")

    def __repr__(self):
        return f"<GroupEvent(id={self.event_table_id}, group_id='{self.group_id}', type='{self.event_type}')>"


class RuleSet(Base):
    __tablename__ = 'rule_sets'
    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)

    rules = relationship("Rule", secondary=ruleset_rules, back_populates="rule_sets")
    groups = relationship("Group", secondary=group_rule_sets, back_populates="rule_sets")

    def __repr__(self):
        return f"<RuleSet(id='{self.id}', name='{self.name}', is_active={self.is_active})>"


class Rule(Base):
    __tablename__ = 'rules'
    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False, default='')
    description = Column(Text, default='')
    logical_operator = Column(Text, nullable=False, default='and')
    is_active = Column(Boolean, nullable=False, default=True)
    applies_to = Column(Text, nullable=False, default='all') # e.g., 'all', 'specific_groups', 'tags'
    # FK to RuleSet, ON DELETE SET NULL allows rules to exist outside sets
    rule_set_id = Column(Text, ForeignKey("rule_sets.id", ondelete="SET NULL"), nullable=True)
    priority = Column(Integer, nullable=False, default=5)

    initiators = relationship("RuleInitiator", back_populates="rule", cascade="all, delete-orphan")
    actions = relationship("RuleAction", back_populates="rule", cascade="all, delete-orphan")
    # M2M relationship to RuleSet (Handles rules potentially being in multiple sets, though less common)
    rule_sets = relationship("RuleSet", secondary=ruleset_rules, back_populates="rules")

    # M2M for groups this rule is *directly* applied to (ignoring RuleSets)
    directly_applied_to_groups = relationship("Group", secondary=group_rules, back_populates="rules")

    def __repr__(self):
        return f"<Rule(id='{self.id}', name='{self.name}', is_active={self.is_active})>"


class RuleInitiator(Base):
    __tablename__ = 'rule_initiators'
    initiator_table_id = Column(Integer, primary_key=True)
    rule_id = Column(Text, ForeignKey("rules.id", ondelete="CASCADE"), nullable=False)
    initiator_ref_id = Column(Text) # Optional: Sensor ID, Tag ID, etc.
    type = Column(Text, nullable=False, default='') # e.g., measurement, schedule, tag_change
    operator = Column(Text, default='') # e.g., >, <, ==, between
    value = Column(Numeric, default=0) # Threshold 1 or schedule value
    value2 = Column(Numeric) # Threshold 2 for 'between'/'outside'
    schedule_type = Column(Text) # e.g., interval, cron, date
    schedule_value = Column(Text) # Specific value for schedule type

    rule = relationship("Rule", back_populates="initiators")
    tags = relationship("Tag", secondary=initiator_tags, back_populates="initiator_conditions") # Tags specific to this initiator condition

    def __repr__(self):
        return f"<RuleInitiator(id={self.initiator_table_id}, rule_id='{self.rule_id}', type='{self.type}')>"

class RuleAction(Base):
    __tablename__ = 'rule_actions'
    action_id = Column(Integer, primary_key=True)
    rule_id = Column(Text, ForeignKey("rules.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(Text, nullable=False) # e.g., 'send_notification', 'set_tag', 'run_script'
    action_params = Column(JSONB) # Store parameters as JSON: {"recipient": "admin", "message": "Temp high"}
    execution_order = Column(Integer, nullable=False, default=0)

    rule = relationship("Rule", back_populates="actions")

    def __repr__(self):
        return f"<RuleAction(id={self.action_id}, rule_id='{self.rule_id}', action_type='{self.action_type}')>"



class User(Base): # Web application user
    __tablename__ = 'users'
    client_id = Column(Text, primary_key=True)
    client_hash = Column(Text, nullable=False)
    # No direct relationships needed here based on current usage

    def __repr__(self):
        return f"<User(client_id='{self.client_id}')>"

class AvailableSensorsDatabase(Base): # Sensor Client System Definition
    __tablename__ = 'available_sensors_database'
    client_id = Column(Text, primary_key=True)
    client_name = Column(Text, nullable=False)
    client_key_hash = Column(Text, nullable=False)
    client_last_session = Column(Text)
    client_active = Column(Boolean, nullable=False, default=True) # Added default
    client_access_key = Column(Text, nullable=False)
    last_heard_from = Column(DateTime(timezone=True), nullable=True)

    sessions = relationship("SessionAuth", back_populates="client_system", cascade="all, delete-orphan")
    config = relationship("Config", back_populates="client_system", uselist=False, cascade="all, delete-orphan")
    sensors = relationship("Sensor", back_populates="client_system") # Relationship to sensors managed by this client

    def __repr__(self):
        return f"<AvailableSensorsDatabase(client_id='{self.client_id}', name='{self.client_name}')>"

class SessionAuth(Base): # Sensor Client System Session
    __tablename__ = 'session_auth'
    session_id = Column(Text, primary_key=True)
    client_id = Column(Text, ForeignKey("available_sensors_database.client_id", ondelete="CASCADE"), nullable=False)
    session_key_hash = Column(Text, nullable=False)
    available = Column(Text, nullable=False) # Consider Boolean if appropriate
    session_end = Column(DateTime(timezone=True), nullable=False)
    system_privileges = Column(Text)

    client_system = relationship("AvailableSensorsDatabase", back_populates="sessions")

    def __repr__(self):
        return f"<SessionAuth(session_id='{self.session_id}', client_id='{self.client_id}', available={self.available}, ends='{self.session_end}')>"

class Config(Base): # Sensor Client System Config
    __tablename__ = 'config'
    client_id = Column(Text, ForeignKey("available_sensors_database.client_id", ondelete="CASCADE"), primary_key=True)
    system_time_unit = Column(Text, nullable=False)
    temperature_unit = Column(Text, nullable=False)
    pressure_unit = Column(Text, nullable=False)
    voltage_unit = Column(Text, nullable=False)
    power_unit = Column(Text, nullable=False)
    speed_unit = Column(Text, nullable=False)
    weight_unit = Column(Text, nullable=False)
    sound_pressure_level_unit = Column(Text, nullable=False)
    network_strength_unit = Column("network_strenght_unit", Text, nullable=False) # Match SQL column name
    memory_unit = Column(Text, nullable=False)

    client_system = relationship("AvailableSensorsDatabase", back_populates="config")

    def __repr__(self):
        return f"<Config(client_id='{self.client_id}')>"


class ServerConfig(Base):
    __tablename__ = 'server_config'
    config_name = Column(Text, primary_key=True) # e.g., 'system_autoBackup', 'measurements_temperature_unit'
    units = Column(Text)
    lowest_acceptable = Column(Text)
    highest_acceptable = Column(Text)
    accuracy = Column(Text)
    value = Column(Text) # Store all config values as text

    def __repr__(self):
        return f"<ServerConfig(config_name='{self.config_name}', value='{self.value}')>"

class JwtBlocklist(Base):
    __tablename__ = 'jwt_blocklist'
    id = Column(Integer, primary_key=True)
    jti = Column(Text, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<JwtBlocklist(id={self.id}, jti='{self.jti}')>"
