########################################################
# Multiple database functions 
# Last version of update: v0.81

########################################################

# Imports
import logging
import bcrypt
import os
import time


###############################################
# Influxdb part

from app.dep_lib import supported_units, binary_units
from app.db_man.influxdb.convert import config_repair
from app.db_man.pqsql.models import Session_auth, Available_sensors, Config, Users, Beehive, Sensor, Server_Config
from app.db_man.influxdb.write import changing_beehive, delete_records
from app.db_man.pqsql.backend_func import config_supporting_range
from app.db_man.influxdb.engine import *

def validate_writing_point(unit: str, value: int) -> bool:
    """
    Validates actual writing point if it's in range.

    Args:
        unit (str): Key of unit
        value (int): Value to check

    Using:
        os, logging, time, 

        dep_lib: supported_units[], supported_range[], binary_unit[]

    Returns:
        Bool: Status if can connect to Postgres
    """
    try:
        logging.debug(f"value: {value}, {unit}")
        
        value = int(value)
        if unit == "wind_speed":
            unit = "speed"
        elif (unit == "battery_voltage") or (unit == "solar_voltage"):
            unit = "voltage"
        elif (unit == "battery_wattage") or (unit == "solar_wattage"):
            unit = "wattage"
            
        if unit in binary_units:
            if value == 0 or value == 1:
                return True
            else:
                logging.debug(f"Value: {value} is not in binary range (1/0)!")
                return False
        elif unit in supported_units: 
            lowest = get_config(unit)['lowest_acceptable']
            highest = get_config(unit)['highest_acceptable']
            if lowest == "None":
                lowest = 0
            if highest == "None":
                highest = 0
            logging.debug(f"lowest: {lowest}, highest: {highest}")
            if (value >= int(lowest)) and (value <= int(highest)):
                return True
            else:
                logging.debug("failure")
                logging.debug(f"Value: {value} is not in range: {config_supporting_range(unit, 0)}-{config_supporting_range(unit, 1)} ")
                return False
        else:
            logging.debug(f"Value not detected in supported values! :{value}")
            return True
    except Exception as err:
        logging.debug(f"Something went wrong! err: {err}")
        return False

def get_configs(client_id):
    """
    Return session_config in normal way and server_config 

    Args:
        client_id (int): client_id which can be search in database for config
        
    Returns:
        server_config (List): Server config
        session_config (List): Session Config
    """
    
    readed_config = reading(client_id, Config)
    readed_config = {'system_time': readed_config[1], 'temperature': readed_config[2],
                     'pressure': readed_config[3], 'voltage': readed_config[4],
                     'power': readed_config[5], 'speed': readed_config[6],
                     'weight': readed_config[7], 'sound_pressure_level': readed_config[8],
                     'network_strenght': readed_config[9], 'memory': readed_config[10]}
    
    system_config = get_system_config()
    
    session_config = config_repair(readed_config)

    server_config = config_repair(system_config)
    return server_config, session_config


############################################
# Postgresql part

from app.db_man.pqsql.engine import session_clientmodifier
from app.db_man.pqsql.backend_func import reading

def get_client_id(session_id):
    """
    Return Client Id from Session id
    
    Args:
        session_id (str): session_id from database

    Using:
        os, logging

        db_man.pqsql.backend_func:  reading()
        db_man.pqsql.engine:  session_clientmodifier()   
        db_man.pqsql.models: Session_auth()

    Returns:
        Bool or List - if cannot retrieve List then returns False
    """
    
    try:
        logging.debug("getting client id")
        with session_clientmodifier() as session:
            logging.debug(session_id)
            rec = session.query(Session_auth.__table__).filter_by(
                session_id=session_id).first()
            if not rec:
                return False
            record = list(rec)
            logging.debug(f"Client_id : {str(record[0])}")
            return record[0]
    except Exception as err:
        logging.warning(f"Reading failed! {err}")
        return False

def check_sensor_exist(sensor):
    logging.debug("Checking if sensor exists")
    with session_clientmodifier() as session:
        beehive_sensor = session.query(Sensor.__table__).filter_by(id=sensor).first()
        logging.debug(f"beehive_sensor = {beehive_sensor}")
        if not beehive_sensor:
            return 0, "null", "null"
        return 1, beehive_sensor[1], beehive_sensor[2]


def get_system_config():
    with session_clientmodifier() as session:
        configs_with_units = session.query(Server_Config).filter(Server_Config.units.isnot(None)).all()

            # Convert to dictionary format
        config_dict = {}
        for config in configs_with_units:
            
            config_dict[config.config_name] = {"units": config.units}
        logging.debug(config_dict)
    return config_dict

def get_hub_name(hub_id):
    logging.debug("getting name from hub")
    with session_clientmodifier() as session:
         hub_sensor = session.query(Available_sensors.__table__).filter_by(client_id=hub_id).first()
         if hub_sensor:
            logging.debug(f"Found  : {hub_sensor}")
            if hub_sensor[1] is not None:
                
                logging.debug("Found Name")
                return hub_sensor[1]
            else:
                logging.debug("Didnt find Name")
                return None
         else:
             logging.debug(f"Getting data failed, hub: {hub_sensor}")
             return None
    


def get_beehive(sensor):
    logging.debug("Getting beehive id from sensor id")
    with session_clientmodifier() as session:
         beehive_sensor = session.query(Sensor.__table__).filter_by(id=sensor).first()
         if beehive_sensor:
            logging.debug(f"Found Sensor : {beehive_sensor}")
            if beehive_sensor[4] is not None:
                logging.debug("Found Beehive ID")
                return True, beehive_sensor[4]
            else:
                logging.debug("Didnt find beehive_id")
                return False, 0
         else:
             logging.debug(f"Getting data failed, beehive sensor: {beehive_sensor}")
             return False, 0
         
def check_if_beehive_exist(beehive):
    try:
        beehive = int(beehive)
    except:
        logging.warning("BeehiveID to int failed")
        return False
    logging.debug("Checking if beehive exists")
    with session_clientmodifier() as session:
         beehive_sensor = session.query(Beehive.__table__).filter_by(id=int(beehive)).first()
         if not beehive_sensor:
            logging.debug("Beehive not found")
            return False
    return True

def get_all_beehives():
    beehives = {}
    try:
        beehives_query = Beehive.query.all()
        for beehive in beehives_query:
            logging.debug(f"Beehive: {beehive.id}")
            beehives[beehive.id] = 0
    except Exception as err:
        logging.warning(f"Loading all beehives failed: {err}")
        return {}
    return beehives

def get_all_sensors():
    sensors = {}
    try:
        sensors_query = Sensor.query.all()
        for sensor in sensors_query:
            logging.debug(f"Sensor: ID: {sensor.id}, Client_ID: {sensor.client_id}, Measurement: {sensor.measurement}, BID: {sensor.beehive_id}")
            sensors[sensor.id] = {"client_id": sensor.client_id, "measurement": sensor.measurement, "bid": sensor.beehive_id}
    except Exception as e:
        logging.warning(f"Error with getting all sensors {e}")
        return {}
    logging.debug(f"Success : {sensors}")
    return sensors


def get_all_sessions():
    sessions = {}
    try:
        session_auth = Session_auth.query.all()
        for session in session_auth:
            logging.debug(f"session: ID: {session.session_id}, Client_ID: {session.client_id}, Time_END: {session.session_end}")
            sessions[session.session_id] = {"client_id": session.client_id, "time_end": session.session_end}
    except Exception as e:
        logging.warning(f"Error with getting all sensors {e}")
        return {}
    logging.debug(f"Success : {sessions}")
    return sessions

def get_last_sensor_data():
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
        |> range(start: -10y)  // Adjust as needed
        |> group(columns: ["bid", "id"])  // Group by sensor_id
        |> last()  // Get the last record for each sensor
    '''
    tables = query_api.query(query)
    logging.debug(f"debug moment: {tables}")
    beehive_data = {}
    for table in tables:
        for record in table.records:
            
            bid = record.values.get("bid")
            if (bid == "0") or (bid == str(get_hub_meteostation())):
                logging.debug("BID IS 0 or meteostation")
                continue
            unit = record.values.get("unit")
            value = record.get_value()
            
            if bid not in beehive_data:
                name = get_beehive_name(bid)[1]
                beehive_data[bid] = {"id": bid, "name": name}
            
            # Ensure only the last value of each unit type is kept
            beehive_data[bid][unit] = value
    
    return list(beehive_data.values())

def get_beehive_name(beehive):
    try:
        beehive = int(beehive)
    except:
        logging.warning("BeehiveID to int failed")
        return False
    logging.debug("Checking if beehive exists")
    try:
        with session_clientmodifier() as session:
            beehive_sensor = session.query(Beehive.__table__).filter_by(id=int(beehive)).first()
            if not beehive_sensor:
                logging.debug("Beehive not found")
                return False
    except Exception as err:
        logging.warning(f"Getting Beehive info failed: {err}")
        return False
    return beehive_sensor

def get_all_beehives_sensor(beehive):
    sensors_beehive = []
    try:
        beehive = int(beehive)
    except:
        logging.warning("BeehiveID to int failed")
        return False
    try:
        with session_clientmodifier() as session:
            sensor_query = session.query(Sensor.id).filter(Sensor.beehive_id == beehive).all()
            logging.debug(sensors_beehive)
        logging.debug("Well")
        for sensor in sensor_query:
            logging.debug(f"{sensor}, {len(sensors_beehive)}")
            sensors_beehive.append(str(sensor[0]))
        return sensors_beehive
    except Exception as err:
        logging.debug(f"Error: {err}")
        return False

def get_beehive_info(beehive):
    try:
        beehive = int(beehive)
    except:
        logging.warning("BeehiveID to int failed")
        return False
    logging.debug("Checking if beehive exists")
    try:
        with session_clientmodifier() as session:
            beehive_sensor = session.query(Beehive.__table__).filter_by(id=int(beehive)).first()
            if not beehive_sensor:
                logging.debug("Beehive not found")
                return False
    except Exception as e:
        logging.warning(f"Getting info failed: {e}")
        return []
    return beehive_sensor




def add_beehive(name, config):
    logging.debug("Adding database")
    beehive_id = 0
    with session_clientmodifier() as session:
        if name == "system":
            logging.debug("Creating beehive")
            new_beehive = Beehive(id=0, name=name, location="system",last_inspection="0")
            beehive_id = new_beehive.id
            
        else:
            logging.debug("Creating beehive")
            
            try:
                if (name == "meteostation") and (get_hub_meteostation()):
                    logging.debug("Found meteostation")
                    return False, 0
                new_beehive = Beehive(name=name, location=config['location'], last_inspection=config['last_inspection'])
                
            except Exception as err:
                logging.warning(f"Add behive Error: {err}")
                return False, 0
        try: 
            session.add(new_beehive)
            session.commit()
            beehive_id = new_beehive.id
            logging.debug(f"beehive after change: {beehive_id}")
        except Exception as e:
            logging.warning(f"DATABASE ADD BEEHIVE FAILED: {e}")
            session.rollback()
            return False, 0
    logging.debug(f"sometype success")

    
    if (name == "meteostation"):
        logging.debug(f"name is same {beehive_id}")
        mc.set("meteostation", str(beehive_id))
    return True, beehive_id

def string_format(string, type):
    string = str(string)
    if type == 'temperature':
        return string + f" °C" #TODO CHANGE EVERYTHING to config values
    elif type == 'humidity':
        return string + " %"
    elif type == 'pressure':
        return string + f" Pa"
    elif type == 'wind_speed':
        return string + f" m/s"
    elif type == 'wind_wane':
        return string + " °"
    elif type == 'battery_percentage':
        return string + " %"
    elif type == 'solar_wattage':
        return string + f" W"
    elif type == "weight":
        return string + f" kg"
    else: 
        return string


def add_sensor(sensor_id, client_id, measurement_type, calibration_value, beehive_id):
    try: 
        with session_clientmodifier() as session:
            new_sensor = Sensor(id=sensor_id, client_id=client_id, measurement=measurement_type, calibration_value=calibration_value, beehive_id=beehive_id)
            session.add(new_sensor)
            session.commit()
    except Exception as e:
        logging.warning(f"DATABASE ADD SENSOR FAILED: {e}")
        session.rollback()
        return False
    return True

def change_assign(beehive, sensor, override):
    try:
        logging.debug("SENSOR ASSIGN edit")
        with session_clientmodifier() as session:
            beehive_sensor = session.query(Sensor.__table__).filter_by(id=sensor).first()
            session.query(Sensor).filter(Sensor.id == sensor).update({"beehive_id": int(beehive)})
            

            session.commit()
        if override:
            logging.debug("override active")
            if not changing_beehive(str(sensor), beehive):
                return False
            logging.warning("deleting Records")
            if not delete_records(beehive_sensor[4], sensor):
                return False
            
        return True
    
    except Exception as err:
        logging.error(f"ASSINING TO DIFFERENT Beehive failed {err}")
        session.rollback()
        return False


def check_registry_key(client_id, key):
    """
    Check hash of key in database and provided key by client

    Args:
        client_id (str): client_id to retrieve from database
        key (str): provided key from client

    Using:
        os, logging, bcrypt

    Returns:
        Bool - returns status if hash is ok
    """

    try:
        record = reading(client_id, Available_sensors)
        if not record:
            logging.debug("No key detected")
            return False
        logging.debug(f"record: {record}")
        result = bcrypt.checkpw(key.encode("utf-8"), record[2].encode("utf-8"))
        logging.debug(f'result: {result}')
        logging.debug(f"client_id: {str(client_id)}")
        if result:
            logging.debug("Registry key - OK")
            return True
        return False
    except Exception as err:
        logging.warning(f"Getting information from database failed: {err}")
        return False


def check_session(session_id, key):
    """
    Check if session exists and returns boolean
    
    Args:
        session_id (str): searched session_id
        key (str): validated key
    
    Using:
        os, logging, bcrypt, time

        db_man.pqsql.engine:  session_clientmodifier()   
        db_man.pqsql.models: Session_auth()
    Returns:
        Bool - returns status 
    """

    try:
        logging.debug("getting client id")
        with session_clientmodifier() as session:
            logging.debug(session_id)
            rec = session.query(Session_auth.__table__).filter_by(
                session_id=session_id).first()
            if not rec:
                return False
        record = list(rec)
        logging.debug("Session detected")
        result = bcrypt.checkpw(key.encode("utf-8"), record[2].encode("utf-8"))
        logging.debug(f'result: {result}')
        if result:
            if int(record[4]) > int(time.time()):
                return True
            else:
                return False
        return False
    except Exception as err:
        logging.warning(f"Getting information from database failed: {err}")
        return False

def get_all_beehives():
    try:
        with session_clientmodifier() as session:
            beehive_ids = session.query(Beehive.id).distinct().all()
    except Exception as e:
        logging.warning(f"Get all beehives failed: {e}")
        return []
    return beehive_ids



def get_all_measurement():
    try:
        with session_clientmodifier() as session:
            client_ids = session.query(Available_sensors.client_id).distinct().all()
    except Exception as e:
        logging.warning(f"Get all beehives failed: {e}")
        return []
    return client_ids




def get_sensor_count(beehive_id):
    with session_clientmodifier() as session:
        count = session.query(Sensor).filter(Sensor.beehive_id == beehive_id).count()
    return count

def validate_user(client_id, client_pass):
    """
    Validates if client_id and hash is valid and returns bool
    
    Args:
        client_id (str): client_id
        client_pass (str): pass for checking with database hash
    
    Using:
        os, logging, bcrypt, time

        db_man.pqsql.engine:  session_clientmodifier()   
        db_man.pqsql.models: Session_auth()
    Returns:
        Bool - returns status 
    """
    try:
        logging.debug("Starting Validating User")
        with session_clientmodifier() as session:
            logging.debug(client_id)
            rec = session.query(Users.__table__).filter_by(
                client_id=client_id).first()
            if not rec:
                return False
        record = list(rec)
        logging.debug("Session detected")
        result = bcrypt.checkpw(client_pass.encode("utf-8"), record[1].encode("utf-8"))
        return result
    except Exception as err:
        logging.warning(f"error when validating: {err}")
        return False
    



# MEMCACHED
import copy
from app.db_man.memcache.mem_engine import *

def get_config(key):
    """
    Retrieve configuration for a specific key.
    First checks memcached for the key; if not found, loads from the database
    and caches the result individually.
    """
    mem_key = f"config:{key}"
    config = mc.get(mem_key)
    if not config:
        try:
            config_entry = Server_Config.query.get(key)
        except Exception as e:
            logging.warning("Get config query failed: {e}")
            config_entry == False
        if config_entry:
            config = {
                "units": config_entry.units,
                "lowest_acceptable": config_entry.lowest_acceptable,
                "highest_acceptable": config_entry.highest_acceptable,
                "accuracy": config_entry.accuracy,
                "value": config_entry.value
            }
            mc.set(mem_key, config, time=300)
    return config

def set_config_in_cache(key, config):
    """
    Set/update the memcached entry for a given config key.
    """
    mem_key = f"config:{key}"
    mc.set(mem_key, config, time=300)

def update_full_config(data):
    """
    Update the entire configuration with a full JSON payload.
    Each key in the JSON file is expected to have its configuration as a dictionary.
    This endpoint updates PostgreSQL for every key and then synchronizes the cache individually.
    """
    try:
        with session_clientmodifier() as session:
            for key, conf in data.get("measurements", {}).items():
                config = Server_Config(
                    config_name=key,
                    units=conf.get("unit"),
                    lowest_acceptable=str(conf.get("lowest")),
                    highest_acceptable=str(conf.get("highest")),
                    accuracy=str(conf.get("decimalPlaces")),
                    value=None
                
                )
                session.merge(config)
            for key, val in data.get("system", {}).items():
                if key == "autoBackup":
                    key = "automatic"
                logging.debug(f"{key}, {val}")
                config = Server_Config(
                    config_name=key,
                    units=None,
                    lowest_acceptable=None,
                    highest_acceptable=None,
                    accuracy=None,
                    value=str(val)  # Convert the value to a string before storing
                )
        
                session.merge(config)
            session.commit()
    except Exception as err:
        logging.warning(f"Updating config failed {err}")
        session.rollback()
        return False


    # Refresh the memcached cache for each updated key.
    for key in data.keys():
        config = get_config(key)  # Re-loads from the DB and caches it
        set_config_in_cache(key, config)

    return True



import json
def get_full_config():
    with session_clientmodifier() as session:
        config_entries = session.query(Server_Config).all()

    # Initialize our configuration structure
    initial_config = {
        "measurements": {},
        "system": {}
    }

    # Map each row to the proper section in the configuration
    for entry in config_entries:
        # Assume that the config_name tells you where the entry belongs.
        # For example, measurement configs might be "temperature", "humidity", etc.
        # and system configs might be "autoBackup", "backupFrequency", etc.
        name = entry.config_name
        # Convert string values to appropriate types if necessary.
        # Here we assume lowest_acceptable, highest_acceptable, and accuracy can be converted to numbers.
        try:
            lowest = float(entry.lowest_acceptable) if entry.lowest_acceptable else None
        except ValueError:
            lowest = None

        try:
            highest = float(entry.highest_acceptable) if entry.highest_acceptable else None
        except ValueError:
            highest = None

        try:
            # decimalPlaces could be stored as string so we convert to int.
            decimal_places = int(entry.accuracy) if entry.accuracy else None
        except ValueError:
            decimal_places = None

        # Example categorization logic (adjust the keys based on your schema)
        if name in ["temperature", "humidity", "weight", "sound", "light", "speed", "pressure", "voltage", "wattage"]:
            initial_config["measurements"][name] = {
                "unit": entry.units,
                "decimalPlaces": decimal_places,
                "lowest": lowest,
                "highest": highest
            }
        elif name in ["automatic", "backup_interval"]:
            # For system configurations, you might store the value directly or convert it appropriately
            if name == "automatic":
                # Convert to boolean if stored as string 'true'/'false'
                initial_config["system"]['autoBackup'] = entry.value.lower() == "true"
            else:
                initial_config["system"]['backupFrequency'] = entry.value

    # Optionally, convert the config dictionary to JSON for use in JavaScript
    config_json = json.dumps(initial_config, indent=2)
    return config_json

def reset_config():
    with open("app/default_config.json", "r") as file:
        config_data = json.load(file)
    logging.debug(f"default config:{config_data}")
    try:
        with session_clientmodifier() as session:
            for key, conf in config_data.items():
                config = Server_Config(
                    config_name=key,
                    units=conf.get("units"),
                    lowest_acceptable=str(conf.get("lowest_acceptable")),
                    highest_acceptable=str(conf.get("highest_acceptable")),
                    accuracy=str(conf.get("accuracy")),
                    value=str(conf.get("value"))
                )
                session.merge(config)
            session.commit()
        return True
    except Exception as err:
        logging.debug(f"Reseting config failed{err}")
        session.rollback()
        return False

def get_hub_meteostation():
    try:
        station = mc.get("meteostation")
        logging.debug(f"Cachced station: {station}")
        if station:
            if station != "None":
                logging.debug("Station founded")
                return str(station)
        logging.debug("Loading from database")
        with session_clientmodifier() as session:
            hub_sensor = session.query(Beehive.__table__).filter_by(name="meteostation").first()
            if hub_sensor:
                logging.debug(f"Found  : {hub_sensor}")
                if hub_sensor[0] is not None:
                    
                    logging.debug("Found Beehive ID")
                    logging.debug(f"Beehive ID: {hub_sensor[0]}")
                    mc.set("meteostation", str(hub_sensor[0]))
                    return str(hub_sensor[0])
                else:
                    logging.debug("Didnt find BeehiveID")
                    return None
            else:
                logging.debug(f"Getting data failed, hub: {hub_sensor}")
                return None
    except Exception as err:
        logging.warning(f"Gethub meteostation failed: {err}")
        return None