###################################
# InfluxDB Writing file
# Last version of update: v0.95

###################################
import os
import logging
from typing import List
from influxdb_client import InfluxDBClient, Point, WriteOptions # type: ignore
from influxdb_client.client.write_api import SYNCHRONOUS # type: ignore
from app.db_man.influxdb.engine import client, bucket, org
from dotenv import load_dotenv
load_dotenv()

# --- InfluxDB Configuration ---
INFLUX_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN")
INFLUX_ORG = os.getenv("DOCKER_INFLUXDB_INIT_ORG")
INFLUX_BUCKET = os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")

# Check essential InfluxDB config
if not all([INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET]):
    logging.error("InfluxDB environment variables (INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET) are not fully set.")
    # Depending on application structure, might raise an error or just log
    # raise ValueError("InfluxDB configuration missing in environment variables.")


def write_points_to_influxdb(points: List[Point]):
    """Writes a list of Point objects to InfluxDB using batching."""

    if not points:
        logging.info("No points provided to write to InfluxDB.")
        return

    if not all([INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET]):
         logging.error("Cannot write points: InfluxDB configuration is incomplete.")
         return # Prevent attempting to write with missing config

    logging.info(f"Attempting to write {len(points)} points to InfluxDB bucket '{INFLUX_BUCKET}' at {INFLUX_URL}...")

    try:
        # Use context manager for client and write_api to ensure resources are closed/flushed
         write_api = client.write_api(write_options=SYNCHRONOUS)
         writing = write_api.write(bucket=bucket, org=org, record=points)
    except Exception as client_error:
        # Log errors related to client connection, authentication, or initial setup
        logging.error(f"InfluxDB client error during write operation: {client_error}", exc_info=True)

