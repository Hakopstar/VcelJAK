####################################################
# influxdb engine
# Last version of update: v0.95
# app/db_man/influxdb/engine.py
####################################################

# TODO: Engine is in multiple files, get refences to this file

import os
import influxdb_client
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

org = os.getenv("DOCKER_INFLUXDB_INIT_ORG")
bucket = os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")
token = os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN")
url = os.getenv("INFLUXDB_URL")

client = influxdb_client.InfluxDBClient(url=url, token=token, org=org)