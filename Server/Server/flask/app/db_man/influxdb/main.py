#####################################
# InfluxDB main communication file
# Last version of update: v0.91

#############database########################

# Import
import logging

from app.db_man.multidb_func import check_sensor_exist, check_if_beehive_exist, get_beehive, add_beehive, add_sensor, get_hub_meteostation
from app.db_man.multidb_func import get_client_id, validate_writing_point, get_configs, get_all_beehives, get_all_sensors
from app.db_man.influxdb.convert import converting_units
from app.db_man.influxdb.write import writing_point, write_to_database
from app.db_man.influxdb.read import get_meteo_station_data
from app.sse import update_sse

# Sending json to database
def send_data(data: any, session_id: str):
    """
    Process and send into InfluxDB

    Args:
        data (list): Data got from request data
        session_id (str): presented from authentication

    Using:
        os, logging, json

        db_man.multidb_func: get_client_id(), get_configs(), validate_writing_point()
        db_man.influxdb.convert: converting_units()
        db_man.influxdb.write: writing_point(), write_to_database()

    Returns:
        int: Database status code
        str: Database status message
    """

    client_id = get_client_id(session_id)
    server_config, session_config = get_configs(client_id)
    logging.debug(f"Session Config: {session_config}, Server Config: {server_config}")
    points = []
    not_created_sensors = []
    unallocated_sensors = []
    logging.debug("Getting beehives")
    sensors = get_all_sensors()
    for x, sensor in enumerate(data):
        logging.debug(f"sending: sensor_num:{x+1}/{len(data)}")
        try:
            unit = sensor['unit']
            value = sensor['value']
            try:
                cvalue = converting_units(session_config, server_config, unit, value)
            except Exception as err:
                logging.warning(f"Units failed {err}")
                return 400, "units_error"
            
            if not validate_writing_point(unit, cvalue):
                logging.debug("Validating sensors values Failed")
                return 400, "calibration_required"
            #logging.debug(sensor['id'])
            sensor_quered = sensors.get(sensor['id'])
            #logging.debug(f"Sensor: {sensor_quered}")
            if sensor_quered is not None:
                if (sensor_quered['client_id'] != client_id) or (sensor_quered['measurement'] != unit):
                    logging.debug(f"sensor already in use: sensor_client: {sensor_quered['client_id']}, client_id:{client_id}, sensor_measurement: {sensor_quered['measurement']} measurement: {unit}")
                    return 400, f"sensor_used"
            else:
                
                #logging.debug("Adding to not created sensors")
                sensor_quered = {"client_id": client_id, "measurement": unit, "bid": 0}
                sensors[sensor['id']] = sensor_quered
                not_created_sensors.append([sensor['id'], client_id, unit, 0, 0])

            point = writing_point(client_id, sensor, sensor_quered['bid'], unit, cvalue)
            points.append(point)
        except Exception as err:
            logging.warning(f"Writing a point failed: {err}")
            return 400, "config_error"



    if not write_to_database(points):
        logging.debug("Point writing failed")
        return 500, "server_error"
    logging.debug("Checking if beehive 0 exists")

    if not check_if_beehive_exist(0):
        logging.debug("Beehive 0 failed to be found, creating new")
        status, beehive_id = add_beehive("system", {})
        logging.debug(f"status:{status}, beehive_id:{beehive_id}")
        if not status:
            return 500, "database_error"
        
    logging.info("Writing new sensors:")
    for x, sensor_unintiated in enumerate(not_created_sensors):
        logging.debug(f"sensor: sensor:{x+1}/{len(not_created_sensors)}")
        if not add_sensor(sensor_unintiated[0], sensor_unintiated[1], sensor_unintiated[2], sensor_unintiated[3], 0):
            return 500, "Database Error - sensor create"

    logging.info("Binding Unallocated sensors to beehive 0")
    for x, sensor_unallocated in enumerate(unallocated_sensors):
        beehive_exists, beehive_id = get_beehive(sensor_unallocated[0])
        if not beehive_exists:
            logging.error(f"EDGE Case detected, unallocated sensor: {sensor_unallocated[0]}")
            return 500, "Database Error - binding sensor to beehive failed"
    
    #beehive_sensor = get_last_sensor_beehive_data(0)
    #logging.debug(beehive_sensor[0])
    
    try:
        meteostation_bid = get_hub_meteostation()
        if meteostation_bid:
            meteostation_data = get_meteo_station_data(meteostation_bid)
            logging.debug(f"meteostation_data: {meteostation_data}")
            update_sse(meteostation_data)
    except Exception as err:
        logging.warning(f"meteostation update failed: {err}")
    logging.info("All sensor data was written!")
    logging.info("InfluxDB Updated")
    
    
    return 201, "OK"
