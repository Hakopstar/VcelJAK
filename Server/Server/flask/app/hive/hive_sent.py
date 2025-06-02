####################################
# Hive sent system
# Last version of update: v0.95
# app/hive/hive_sent.py
####################################


from app.hive.processing import process_data_for_influx
from app.db_man.influxdb.write import write_points_to_influxdb
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import redis

from app.db_man.pqsql.read import get_hub_id_from_session
from app.hive.after_phase import fetch_latest_from_influx, update_denormalized_data_in_postgres

import logging

def run_processing_pipeline(db: Session, rc: Optional[redis.Redis], session_id: str, data: list):
    """Runs the full data processing and writing pipeline."""
    logging.info(f"Starting processing pipeline for session_id: {session_id}")
    try:
        client_id = get_hub_id_from_session(db, session_id)
        logging.info(f"Client id: {client_id}")
    except Exception as err:
        logging.error(f"Getting client id from session id failed: {err}")
        return 500, "Server-Error"

   # Get redis client (might be None)

    try:
        # Get a database session
        logging.debug("Database session created.")

        # 1. Process data (convert, validate, create points)
        points_to_write = process_data_for_influx(
            db=db,
            rc=rc,
            client_id=client_id,
            incoming_data=data
        )

        # 2. Write valid points to InfluxDB
        if points_to_write:
            write_points_to_influxdb(points_to_write)
        else:
            logging.info("No valid points generated from processing.")
        # 3. Refresh postgres entries

        logging.info("Starting update postgres")
        sensor_readings, hub_times = fetch_latest_from_influx()
        if sensor_readings or hub_times:
            logging.info("Found sensors readings")
            update_denormalized_data_in_postgres(sensor_readings, hub_times, db)
        logging.info(f"Update finished...")
    except Exception as e:
        # Catch unexpected errors during the pipeline execution
        logging.error(f"An error occurred in the processing pipeline for {client_id}: {e}", exc_info=True)
        return 500, "system_error"
    logging.info(f"Processing pipeline finished for client_id: {client_id}")
    return 201, "SUCCESS"
