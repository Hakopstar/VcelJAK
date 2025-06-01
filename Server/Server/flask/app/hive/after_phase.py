####################################
# After processing file
# Last version of update: v0.95
# app/hive/after_phase.py
####################################


import os
import logging
from influxdb_client import InfluxDBClient, Point # type: ignore
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from influxdb_client.client.exceptions import InfluxDBError
from app.db_man.pqsql.database import SessionLocal, engine as db_engine # Use SessionLocal factory
from app.db_man.pqsql.models import Sensor, AvailableSensorsDatabase
from sqlalchemy.orm import sessionmaker, Session


QUERY_RANGE_MINUTES = int(os.getenv("LAST_READING_QUERY_RANGE_MINUTES", "60"))
WORKER_SLEEP_SECONDS = int(os.getenv("LAST_READING_UPDATE_INTERVAL_MINUTES", "5")) * 60 # Use seconds for sleep
POSTGRES_UPDATE_BATCH_SIZE = int(os.getenv("LAST_READING_DB_BATCH_SIZE", "100"))

INFLUX_URL = str(os.getenv("INFLUXDB_URL")) # Required
INFLUX_TOKEN = str(os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN")) # Required
INFLUX_ORG = str(os.getenv("DOCKER_INFLUXDB_INIT_ORG")) # Required
INFLUX_BUCKET = str(os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")) # Required

def fetch_latest_from_influx() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, datetime]]:
    """Queries InfluxDB for the latest reading of each sensor, ensuring numeric values."""
    sensor_latest_readings: Dict[str, Dict[str, Any]] = {}
    hub_latest_times: Dict[str, datetime] = {}
    range_start = f"-{QUERY_RANGE_MINUTES}m"
    logging.info(f"Querying InfluxDB for latest readings (range '{range_start}')...")
    logging.info(f"{INFLUX_URL}, {INFLUX_TOKEN}, {INFLUX_ORG}, {INFLUX_BUCKET}")

    # --- QUERY (Filter by Type First) ---
    flux_query_alt = f'''
        from(bucket: "{INFLUX_BUCKET}")
        |> range(start: {range_start})
        |> filter(fn: (r) => 
            r._measurement == "sensor_measurement" and
            exists r.client_id and
            exists r.sensor_id and
            r._field == "value"
            )
        |> group(columns: ["sensor_id","client_id"])
        |> last()
        |> keep(columns: ["_time", "_value", "sensor_id", "client_id", "standard_unit"])

    '''


    try:
        # Use a longer timeout and the ALTERNATIVE QUERY first as it's often more robust
        with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG, timeout=30_000) as client:
            query_api = client.query_api()
            final_query_to_run = flux_query_alt # Use the alternative query
            logging.debug(f"Executing Flux query (Alternative Version):\n{final_query_to_run}")
            tables = query_api.query(query=final_query_to_run, org=INFLUX_ORG)

            sensor_count = 0
            processed_sensor_ids = set()

            for table in tables:
                for record in table.records:
                    sensor_id=record.values.get("sensor_id"); hub_id=record.values.get("client_id"); timestamp=record.get_time()
                    value=record.get_value(); unit=record.values.get("standard_unit") # Should be float

                    if sensor_id and hub_id and timestamp is not None and value is not None and unit is not None:
                        # Value should be float now
                        sensor_latest_readings[sensor_id] = {"time": timestamp, "value": float(value), "unit": unit, "hub_id": hub_id}
                        processed_sensor_ids.add(sensor_id)

                        current_hub_latest = hub_latest_times.get(hub_id)
                        if current_hub_latest is None or timestamp > current_hub_latest: hub_latest_times[hub_id] = timestamp
                    else:
                        logging.warning(f"Skipping record with null values after processing: {record.values}")

            sensor_count = len(processed_sensor_ids)
            logging.info(f"Fetched and processed latest valid numeric data for {sensor_count} sensors across {len(hub_latest_times)} hubs.")
            return sensor_latest_readings, hub_latest_times

    except InfluxDBError as e:
        error_code = None; message = str(e);
        if e.response and e.response.headers: error_code = e.response.headers.get('X-Platform-Error-Code')
        log_message = f"InfluxDB query failed "
        if error_code: log_message += f"(Code: {error_code})"
        log_message += f": {message}"
        logging.error(log_message, exc_info=True)
        return {}, {}
    except Exception as e:
        logging.error(f"Unexpected error fetching from InfluxDB: {e}", exc_info=True)
        return {}, {}

def update_denormalized_data_in_postgres(
    sensor_readings: Dict[str, Dict[str, Any]],
    hub_times: Dict[str, datetime],
    db: Session
):

    if not sensor_readings and not hub_times: logging.info("No new data fetched to update."); return
    logging.info(f"Attempting DB update - Sensors: {len(sensor_readings)}, Hubs: {len(hub_times)}...")
    updated_sensors=0; updated_hubs=0; sensors_not_found=0; hubs_not_found=0; batch_count=0
    try:
        logging.debug("Updating Sensors...")
        for sensor_id, data in sensor_readings.items():
            sensor_orm = db.get(Sensor, sensor_id)
            if sensor_orm:
                sensor_orm.last_reading_time = data["time"] 
                sensor_orm.last_reading_value = data["value"]
                sensor_orm.last_reading_unit = data["unit"]
                updated_sensors += 1
                batch_count += 1
                if batch_count >= POSTGRES_UPDATE_BATCH_SIZE: 
                    logging.debug(f"Committing batch...")
                    db.commit()
                    batch_count = 0
            else: logging.warning(f"Sensor ID '{sensor_id}' not found. Skipping."); sensors_not_found += 1
        logging.debug("Updating Hubs...")
        for hub_id, timestamp in hub_times.items():
            hub_orm = db.get(AvailableSensorsDatabase, hub_id)
            if hub_orm:
                hub_orm.last_heard_from = timestamp; updated_hubs += 1; batch_count += 1
                if batch_count >= POSTGRES_UPDATE_BATCH_SIZE: logging.debug(f"Committing batch..."); db.commit(); batch_count = 0
            else: logging.warning(f"Hub ID '{hub_id}' not found. Skipping."); hubs_not_found += 1
        if batch_count > 0: logging.debug(f"Committing final batch..."); db.commit()
        logging.info(f"DB update finished. Sensors: {updated_sensors} (NF: {sensors_not_found}). Hubs: {updated_hubs} (NF: {hubs_not_found}).")
    except Exception as e: db.rollback(); logging.error(f"DB error during update: {e}", exc_info=True)