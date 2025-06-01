      
####################################
# Dashboard API
# Last version of update: v0.95
# app/sapi/routes.py
####################################

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from collections import defaultdict # Import defaultdict

from flask import Blueprint, jsonify, abort, request, current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload, Session # Import Column
from sqlalchemy import desc # Import desc

# Import necessary models
from app.db_man.pqsql.models import Group, Sensor, GroupEvent

# Import the request-scoped session factory
from app import DbRequestSession

# --- InfluxDB Client ---
try:
    from influxdb_client import InfluxDBClient, Point, WritePrecision # type: ignore
    from influxdb_client.client.exceptions import InfluxDBError # type: ignore
    import os
    INFLUX_URL = os.getenv("INFLUXDB_URL")
    INFLUX_TOKEN = os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN")
    INFLUX_ORG = os.getenv("DOCKER_INFLUXDB_INIT_ORG")
    INFLUX_BUCKET = os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")
    INFLUX_CONFIGURED = all([INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET])
    if not INFLUX_CONFIGURED:
        logging.warning("InfluxDB environment variables not fully configured. Sensor history route will be unavailable.")
except ImportError:
    logging.warning("influxdb-client library not installed. Sensor history route will be unavailable.")
    InfluxDBClient = None # type: ignore
    InfluxDBError = None # type: ignore
    INFLUX_CONFIGURED = False
# -------------------------------------------

from . import bp

logging.info("Public API blueprint loaded.")


# --- Helper Functions for Formatting  ---
def _format_api_beehive(group: Group, latest_event_ts: datetime | None, subgroup_map: dict | None = None) -> dict:
    """Formats a Group (type 'beehive') for the /api/beehives response."""
    group_id = getattr(group, 'id', None)
    subgroup_ids = []
    if subgroup_map is not None and group_id is not None:
        subgroup_ids = subgroup_map.get(group_id, []) # Get subgroups from map

    return {
        "id": group_id,
        "name": getattr(group, 'name', 'Unknown'),
        "type": "beehive", # Explicitly set
        "location": getattr(group, 'location', ''),
        "health": getattr(group, 'health', 0),
        "sensors": [{"id": sensor.id, "value": sensor.last_reading_value, "measurement": sensor.measurement, "last_update": sensor.last_reading_time.strftime("%H:%M:%S")} for sensor in getattr(group, 'sensors', []) if hasattr(sensor, 'id')],
        "subgroups": subgroup_ids, # Use IDs fetched separately
        "tags": [{"tag_id": tag.id, "tag_name": tag.name, "tag_type": tag.type} for tag in getattr(group, 'tags', [])],
        "timestamp": latest_event_ts.isoformat() if latest_event_ts else datetime.now(timezone.utc).isoformat()

    }

def _format_api_hive(group: Group) -> dict:
    """Formats a Group (type 'hive') for the /api/beehives response."""
    return {
        "id": getattr(group, 'id', None),
        "name": getattr(group, 'name', 'Unknown'),
        "type": "hive", # Explicitly set
        "parentId": getattr(group, 'parent_id', None),
        "description": getattr(group, 'description', ''),
        # Safely access sensors relationship
        "sensors": [sensor.id for sensor in getattr(group, 'sensors', []) if hasattr(sensor, 'id')]
    }

# --- API Routes ---

@bp.route('/beehives', methods=['GET'])
def get_public_beehives():
    """
    Provides a list of beehive groups and hive (subgroup) groups
    for the public schematic view.
    Workaround: Fetches subgroup IDs separately due to lazy='dynamic'.
    """
    logging.info(f"GET Request received for {bp.name}.get_public_beehives")
    db: Session = DbRequestSession()
    beehives_list_formatted = []
    hives_list_formatted = []

    try:
        # 1. Query main groups (beehives and hives)
        groups_orm = db.query(Group).options(
            selectinload(Group.sensors), 
            selectinload(Group.tags)# Need sensor IDs
        ).filter(
            Group.type.in_(['beehive', 'hive'])
        ).order_by(Group.name).all()

        if not groups_orm:
            return jsonify({"beehives": [], "hives": []}), 200

        potential_parent_ids = set()
        beehives = []
        hives = []
        for group in groups_orm:
            if group.type == 'beehive':
                beehives.append(group)
                potential_parent_ids.add(group.id)
            elif group.type == 'hive':
                hives.append(group)

        # 2. Fetch subgroup links where parent is one of the beehives
        subgroup_map = defaultdict(list)
        if potential_parent_ids:
            subgroup_links = db.query(Group.id, Group.parent_id).filter(
                Group.parent_id.in_(potential_parent_ids)
            ).all()
            # 3. Build the map: parent_id -> list[child_id]
            for child_id, parent_id in subgroup_links:
                if parent_id: # Ensure parent_id is not None
                    subgroup_map[parent_id].append(child_id)

        # 4. Format beehives, PASSING THE SUBGROUP MAP
        for group in beehives:
             # Simplified latest event fetching for now
             latest_event = db.query(GroupEvent.event_date) \
                              .filter(GroupEvent.group_id == group.id) \
                              .order_by(desc(GroupEvent.event_date)) \
                              .first()
             latest_event_ts = latest_event[0] if latest_event else None
             beehives_list_formatted.append(_format_api_beehive(group, latest_event_ts, subgroup_map))

        # 5. Format hives (they don't need the map for *their* children in this view)
        for group in hives:
            hives_list_formatted.append(_format_api_hive(group))


        logging.info(f"Returning {len(beehives_list_formatted)} beehives and {len(hives_list_formatted)} hives.")
        logging.debug(({
            "beehives": beehives_list_formatted,
            "hives": hives_list_formatted}))
        return jsonify({
            "beehives": beehives_list_formatted,
            "hives": hives_list_formatted
        }), 200

    except SQLAlchemyError as e:
        logging.error(f"Database error listing public beehives/hives: {e}", exc_info=True)
        abort(500, description="Failed to retrieve schematic data.")
    except Exception as e:
        logging.error(f"Unexpected error listing public beehives/hives: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while retrieving schematic data.")


# --- Sensor History Route (Remains the same) ---
@bp.route('/sensor-history', methods=['GET'])
def get_public_sensor_history():
    logging.info(f"GET Request received for {bp.name}.get_public_sensor_history")
    if not INFLUX_CONFIGURED or InfluxDBClient is None:
         logging.error("InfluxDB is not configured or influxdb-client is not installed for public API.")
         abort(503, description="Sensor history feature is temporarily unavailable.")

    sensor_id = request.args.get('sensorId')
    time_range_input = request.args.get('timeRange', 'day').lower().strip()

    if not sensor_id:
        abort(400, description="Missing required query parameter: 'sensorId'.")

    influx_time_range: str | None = None
    allowed_ranges = {"hour": "-1h", "day": "-24h", "week": "-7d", "month": "-30d"}
    if time_range_input in allowed_ranges: influx_time_range = allowed_ranges[time_range_input]
    elif re.match(r'^-\d+[mhdw]$', time_range_input): influx_time_range = time_range_input
    else: abort(400, description=f"Invalid timeRange format: '{time_range_input}'. Use 'hour', 'day', 'week', 'month' or Influx format (e.g., -1h, -7d).")

    logging.info(f"Public API query: sensor '{sensor_id}' history for input range '{time_range_input}', using Influx range '{influx_time_range}'")

    history_data = []
    
    try:
        with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG, timeout=20_000) as client:
            query_api = client.query_api()
            flux_query = f'''
                from(bucket: "{INFLUX_BUCKET}")
                |> range(start: {influx_time_range})
                |> filter(fn: (r) => r._measurement == "sensor_measurement" and r.sensor_id == "{sensor_id}" and r._field == "value")
                |> keep(columns: ["_time", "_value", "measurement_type"])
                |> sort(columns: ["_time"], desc: false)
                |> limit(n: 500)
            '''
            logging.debug(f"Executing public InfluxDB query:\n{flux_query}")
            tables = query_api.query(query=flux_query, org=INFLUX_ORG)
            for table in tables:
                for record in table.records:
                    timestamp = record.get_time(); value = record.get_value(); type = record.values.get('measurement_type')
                    if timestamp is not None and isinstance(value, (int, float, Decimal)):
                         history_data.append({"timestamp": timestamp.isoformat(), f'{str(type)}' : float(value)})
        logging.debug(history_data)
        logging.info(f"Public API: Returning {len(history_data)} history points for sensor '{sensor_id}'.")
        return jsonify({"history": history_data}), 200

    except InfluxDBError as e:
        error_code = None; message = str(e);
        if e.response and e.response.headers: error_code = e.response.headers.get('X-Platform-Error-Code')
        log_message = f"Public API InfluxDB query failed fetching history for sensor '{sensor_id}' (Code: {error_code}): {message}"
        logging.error(log_message, exc_info=True)
        abort(502, description="Failed to retrieve sensor history from data store.")
    except Exception as e:
        logging.error(f"Public API unexpected error fetching sensor history '{sensor_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred fetching sensor history.")