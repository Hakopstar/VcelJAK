###################################
# InfluxDB Writing file
# Last version of update: v0.81

###################################
import os, logging, influxdb_client

from app.db_man.influxdb.engine import *
from app.db_man.influxdb.read import read_all_sensor_data

def write_to_database(record):
    """
    Connects to database and writes into database

    Args:
        record (Object): InfluxDB Record Point
        org (Enviroment Variable): Organization Name
        bucket (Enviroment Variable): Initiating Access Bucket
        token (Enviroment Variable): Secret_key Admin Token
        url (Enviroment Variable): InfluxDB connection URL

    Using:
        os, logging, json, influxdb

    Returns:
        bool: Status of function
    """
    # Declare Write API
    write_api = client.write_api(write_options=SYNCHRONOUS)
    # Connecting to Database and then writing into it
    try:
        writing = write_api.write(bucket=bucket, org=org, record=record)
    except Exception as error:
        logging.error("Writing Failed")
        logging.error(f'Writing Error: {error}')
        return False
    logging.info("Record Sended!")
    return True

def changing_beehive(sensor_id, to_bid):
    try:
        logging.warning(f"CHANGING INFLUXDB DATA POINTS FOR SENSOR: {sensor_id}, to bid: {to_bid}")
        points = []
        result = read_all_sensor_data(sensor_id)
        write_api = client.write_api(write_options=SYNCHRONOUS)
        logging.debug(f"result: {result}")
        count = 0
        for table in result:
            for record in table.records:
                point = Point(record["_measurement"])  # Preserve measurement_id
                # Preserve tags and change only bid=2 to bid=1
                point.tag("id", record["id"])  # Keep the same id
                point.tag("bid", int(to_bid))  # Change bid=2 to bid=1
                point.tag("unit", record["unit"])  # Keep the same unit
                # Preserve field value
                point.field("value", record["_value"])
                # Preserve timestamp
                point.time(record["_time"])
                # Write updated point
                points.append(point)
        logging.info("Writing New points!")
        write_api.write(bucket=bucket, org=org, record=points)
        logging.info("Success")
        return True
    except Exception as err:
        logging.error(f"CHANGING DATA POINTS FAILED: {err}")
        return False

def delete_records(bid, sensor_id):
    try:
        logging.debug(f"Sensor ID to delete: {sensor_id}, from bid: {bid}")
        delete_api = client.delete_api()
        delete_api.delete(
        start="1970-01-01T00:00:00Z",
        stop="2100-01-01T00:00:00Z",
        predicate=f'bid={bid} AND id="{sensor_id}"',
        bucket=bucket,
        org=org)
        return True
    except Exception as err:
        logging.error(f"DELETING INFLUXDB FAILED: {err}")
        return False



def writing_point(measurement_id: str, sensor: dict, sensor_beehive: int, unit: str, value: float) -> object:
    """
    Writes a influxdb point

    Args:
        measurement_id (str): measurement creation id
        sensor (dict): Organization Name
        unit (str): Unit name
        value (int): Actual Value

    Using:
        os, logging, json, influxdb

    Returns:
        object: InfluxDB Point
    """

    logging.debug("Starting creating point")
    point = Point(measurement_id)
    point.time(sensor['time'])
    point.tag("id", sensor['id'])
    point.tag("bid", sensor_beehive)
    point.tag("unit", unit)
    point.field("value", value)
    logging.debug(f"Time: {sensor['time']}, id: {sensor['id']}, value: {value}, unit: {unit}")
    logging.info("Point created!")
    return point