#################################
# Last version of update: v0.91
#################################
import os


from sqlalchemy import Column
from sqlalchemy.orm import declarative_base, relationship, backref
from sqlalchemy import Text, Integer, String, DateTime, Float, ForeignKey
from flask_admin.contrib.sqla import ModelView
from datetime import datetime, timezone
from sqlalchemy import Identity

Base = declarative_base()


class Session_auth(Base):
    __tablename__ = 'session_auth'
    client_id = Column(Text, nullable=False)
    session_id = Column(Text, nullable=False, primary_key=True)
    session_key_hash = Column(Text, nullable=False)
    available = Column(Text, nullable=False)
    session_end = Column(Text, nullable=False)
    system_privileges = Column(Text, nullable=False)


class Available_sensors(Base):
    __tablename__ = 'available_sensors_database'
    client_id = Column(Text, nullable=False, primary_key=True)
    client_name = Column(Text, nullable=False)
    client_key_hash = Column(Text, nullable=False)
    client_last_session = Column(Text, nullable=False)
    client_active = Column(Text, nullable=False)
    client_access_key = Column(Text, nullable=False)


class Config(Base):
    __tablename__ = 'config'
    Base.metadata,
    client_id = Column(Text, nullable=False, primary_key=True)
    system_time_unit = Column(Text, nullable=False)
    temperature_unit = Column(Text, nullable=False)
    pressure_unit = Column(Text, nullable=False)
    voltage_unit = Column(Text, nullable=False)
    power_unit = Column(Text, nullable=False)
    speed_unit = Column(Text, nullable=False)
    weight_unit = Column(Text, nullable=False)
    sound_pressure_level_unit = Column(Text, nullable=False)
    network_strenght_unit = Column(Text, nullable=False)
    memory_unit = Column(Text, nullable=False)

class Users(Base):
    __tablename__ = 'users'
    client_id = Column(Text, nullable=False, primary_key=True)
    client_hash = Column(Text, nullable=False)

class BlocklistToken(Base):
    __tablename__ = 'jwt_blocklist'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jti = Column(Text, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

class Beehive(Base):
    __tablename__ = "beehives"
    id = Column(Integer, primary_key=True, server_default=Identity(start=1, increment=1))
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    last_inspection = Column(String, nullable=False)
    sensors = relationship('Sensor', backref='beehive')

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(String, primary_key=True)  
    client_id = Column(String, nullable=False)  
    measurement = Column(String, nullable=False)  
    calibration_value = Column(Float, nullable=True)  
    beehive_id = Column(Integer, ForeignKey('beehives.id'), nullable=False)
    
class Server_Config(Base):
    __tablename__ = "server_config"
    config_name = Column(String, primary_key=True) 
    units = Column(String, nullable=True)
    lowest_acceptable = Column(String, nullable=True)
    highest_acceptable = Column(String, nullable=True)
    accuracy = Column(String, nullable=True)
    value = Column(String, nullable=True)

class Tips(Base):
    __tablename__ = "tips"
    tip_id = Column(String, primary_key=True) 
    tip_title = Column(String, nullable=True)
    tip_description = Column(String, nullable=True)
    tip_priority = Column(String, nullable=True)

class MyModelView(ModelView):
    column_display_pk = True