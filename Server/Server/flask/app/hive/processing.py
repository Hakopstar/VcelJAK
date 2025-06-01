####################################
# Processing of hive measurements
# Last version of update: v0.95
# app/hive/processing.py
####################################

import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Any, Optional, List, Set, Tuple

# Unit Conversion Library
from pint import UnitRegistry, UndefinedUnitError, DimensionalityError, Quantity

# InfluxDB Point object
from influxdb_client import Point, WritePrecision  # type: ignore

# Config Loader (Hub/Server Config only)
try:
    # Adjust import path based on your structure
    from app.cache.database_caching import (
        get_hub_config_cached,
        get_server_config_cached,
    )
except ImportError:
    from config_loader import get_hub_config_cached, get_server_config_cached

# Rule Engine ENTRY POINT (for triggering based on events)
try:
    # Adjust import path based on your structure
    from app.engines.rules_engine.evaluator import check_and_trigger_rules_for_event
except ImportError:
    from rule_engine.evaluator import check_and_trigger_rules_for_event

# Inventory Service (for Sensor->Group map and Cache Invalidation)
try:
    # Adjust import path based on your structure
    from app.services.inventory_service import (
        get_sensor_group_map_cached,
        invalidate_inventory_cache,
    )
except ImportError:
    from inventory_service import (
        get_sensor_group_map_cached,
        invalidate_inventory_cache,
    )

# Database Session & Models
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

try:
    # Adjust import path based on your structure
    from app.db_man.pqsql.models import Sensor
except ImportError:
    from models import Sensor

# Redis Client (for type hinting)
import redis  # type: ignore

# --- Unit Conversion Setup ---
# Initialize Pint registry
ureg = UnitRegistry()

# Define units that might be ambiguous or not default in Pint, or custom ones
ureg.define("percent = 0.01 * count")
ureg.define("dB = decibel")  # Alias if needed
ureg.define(
    "binary_status = count"
)  # Custom dimensionless unit for binary flags
# Pint generally knows common units like degC, Pa, hPa, gram, lux, byte, kph

# --- Constants & Mappings ---

# Define measurement types that inherently have no unit
# (value is just a number/reading)
UNIT_EXPECTED_BUT_MISSING = {"humidity", "wind_vane"}

# Define types treated as binary flags (0 or 1)
BINARY_TYPES = {"storm", "charging"}  # Add others as needed

# Map incoming measurement type names to keys used in
# ServerConfig/HubConfig if different
MEASUREMENT_CONFIG_MAP = {
    "wind_speed": "speed",
    "battery_voltage": "voltage",
    "solar_wattage": "wattage",
    # Add other mappings if measurement type != config key
}

# Map measurement types to the specific Column attribute name in HubConfig
# (models.Config) Use this ONLY if the attribute name is unusual.
MEASUREMENT_HUB_UNIT_KEY_MAP = {
    # Handles the typo network_strenght_unit -> network_strength_unit
    "network_strength": "network_strength_unit"
    # Add others only if HubConfig attribute name != '{config_key}_unit'
}

# Map common abbreviations/variations to Pint-compatible canonical unit names
# Use lowercase keys for case-insensitive matching
UNIT_ALIASES = {
    "c": "degC",
    "cel": "degC",
    "celsius": "degC",
    "degc": "degC",
    "f": "degF",
    "far": "degF",
    "fahrenheit": "degF",
    "degf": "degF",
    "k": "kelvin",
    "pa": "pascal",
    "hpa": "hPa",
    "hectopascal": "hPa",
    "g": "gram",
    "kg": "kilogram",
    "m/s": "m/s",
    "kph": "kph",
    "km/h": "kph",
    "v": "V",
    "volt": "V",
    "w": "W",
    "watt": "W",
    "%": "percent",
    "lux": "lux",
    "db": "dB",
    "dbm": "dBm",
    "byte": "byte",
    "bytes": "byte",
    # Add any other aliases encountered in your config files
}


# --- Helper Functions ---


def get_canonical_unit(unit_str: Optional[str]) -> Optional[str]:
    """
    Translates a unit string using the UNIT_ALIASES map to a
    Pint-compatible name.
    Returns None if input is None or empty.
    """
    if not unit_str:
        return None
    return UNIT_ALIASES.get(unit_str.strip().lower(), unit_str)


def convert_value(
    value: Any,
    from_unit_str: Optional[str],
    to_unit_str: Optional[str],
    measurement_type: str,  # Pass type for context logging
) -> Optional[Decimal]:
    """
    Converts value using pint. Expects canonical unit strings.
    Returns Decimal or None if conversion fails or value is invalid.
    """
    # Ensure value is potentially numeric before proceeding
    try:
        numeric_value = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        logging.error(
            f"Invalid numeric value '{value}' for {measurement_type}."
        )
        return None

    # If units are missing or identical, return the parsed original value
    if not from_unit_str or not to_unit_str:
        logging.warning(
            f"Unit conversion skipped for {measurement_type}: Missing "
            f"canonical source ('{from_unit_str}') or target "
            f"('{to_unit_str}') unit. Using original value."
        )
        return numeric_value

    if from_unit_str == to_unit_str:
        return numeric_value

    logging.debug(
        f"Attempting unit conversion for {measurement_type}: "
        f"{value} {from_unit_str} -> {to_unit_str}"
    )
    try:
        # Perform the conversion using Pint
        qty = ureg.Quantity(numeric_value, from_unit_str)
        converted_qty = qty.to(to_unit_str)
        result = Decimal(str(converted_qty.magnitude)) # Ensure Decimal output
        logging.debug(f"Conversion successful: {result} {to_unit_str}")
        return result

    except (UndefinedUnitError, DimensionalityError) as e:
        logging.error(
            f"Pint unit conversion error for {measurement_type}: {e}. "
            f"From '{from_unit_str}' to '{to_unit_str}'. Value:'{value}'"
        )
        return None
    except Exception as e:
        # Catch any unexpected errors during Pint processing
        logging.error(
            f"Unexpected pint conversion error for {measurement_type} "
            f"value:'{value}': {e}",
            exc_info=True,
        )
        return None


def validate_value(
    value: Decimal,  # Expects the value already converted/parsed
    measurement_type: str,
    server_config_map: Dict[str, Dict[str, Any]],
) -> bool:
    """
    Validates the value against min/max limits in server_config_map.
    Returns True if valid or if validation cannot be performed,
    False if invalid.
    """
    config_key = MEASUREMENT_CONFIG_MAP.get(measurement_type, measurement_type)
    config_entry = server_config_map.get(config_key)

    if not config_entry:
        logging.debug(
            f"No server config validation limits found for '{config_key}'. Skipping."
        )
        return True  # Assume valid if no limits are defined

    min_val_str = config_entry.get("lowest_acceptable")
    max_val_str = config_entry.get("highest_acceptable")
    min_limit: Optional[Decimal] = None
    max_limit: Optional[Decimal] = None
    is_valid = True

    logging.debug(
        f"Validating {measurement_type} value {value} against limits "
        f"(min='{min_val_str}', max='{max_val_str}')"
    )

    try:
        # Check lower bound
        if min_val_str is not None and str(min_val_str).strip():
            min_limit = Decimal(str(min_val_str))
            if value < min_limit:
                logging.warning(
                    f"Validation FAIL: {measurement_type} value {value} < min {min_limit}"
                )
                is_valid = False

        # Check upper bound only if lower bound was valid
        if is_valid and max_val_str is not None and str(max_val_str).strip():
            max_limit = Decimal(str(max_val_str))
            if value > max_limit:
                logging.warning(
                    f"Validation FAIL: {measurement_type} value {value} > max {max_limit}"
                )
                is_valid = False

        if is_valid:
            logging.debug(f"Validation PASS for {measurement_type} value {value}")

        return is_valid

    except (InvalidOperation, TypeError, ValueError) as e:
        logging.error(
            f"Could not parse validation limits for {config_key}: {e}. "
            f"Limits: min='{min_val_str}', max='{max_val_str}'. Skipping validation."
        )
        return True  # Treat as valid if limits are unparseable
    except Exception as e:
        logging.error(
            f"Unexpected validation error for {measurement_type} value {value}: {e}",
            exc_info=True,
        )
        return False # Fail validation on unexpected errors


# --- Main Processing Function ---


def process_data_for_influx(
    db: Session,
    rc: Optional[redis.Redis],
    client_id: str,  # Hub ID
    incoming_data: list[Dict[str, Any]],
) -> list[Point]:
    """
    Processes sensor data: handles new sensors/types, converts/validates units
    (with alias handling), CALLS RULE ENGINE based on sensor group,
    prepares InfluxDB Points.
    """
    # --- 1. Get Hub/Server Configs & Sensor->Group Map ---
    logging.debug(f"Starting processing for hub {client_id}")
    hub_config = get_hub_config_cached(db, rc, client_id)
    server_config_map = get_server_config_cached(db, rc)

    if not hub_config:
        logging.error(
            f"Aborting processing for {client_id}: Hub configuration unavailable."
        )
        return []

    sensor_group_map = get_sensor_group_map_cached(db, rc, client_id)
    existing_sensors_map: Dict[str, str] = {}
    try:
        existing_sensors_db = (
            db.query(Sensor.id, Sensor.measurement)
            .filter(Sensor.client_id == client_id)
            .all()
        )
        existing_sensors_map = {s.id: s.measurement for s in existing_sensors_db}
        logging.debug(
            f"Fetched {len(existing_sensors_map)} existing sensors for hub {client_id}."
        )
    except SQLAlchemyError as e:
        logging.error(
            f"DB error fetching existing sensors for hub {client_id}: {e}",
            exc_info=True,
        )
        # Decide if we should continue without existing sensor info or abort
        return [] # Aborting for safety

    # --- 2. Initialize Lists & Counters ---
    influx_points: List[Point] = []
    new_sensors_to_create: List[Dict[str, Any]] = []
    processed_count = 0
    valid_points_count = 0
    rejected_mismatch_count = 0
    rejected_unit_err_count = 0
    rejected_validation_count = 0
    newly_identified_sensors: Set[str] = set() # Track sensors added in this batch

    # --- 3. Process Readings Loop ---
    logging.info(
        f"Processing {len(incoming_data)} incoming readings for hub {client_id}..."
    )
    for i, reading in enumerate(incoming_data):
        processed_count += 1
        reading_num = i + 1 # For logging clarity

        # Extract essential fields safely
        measurement_type = reading.get("unit")
        original_value = reading.get("value")
        original_timestamp_str = reading.get("time")
        sensor_id = str(reading.get("id", f"unknown_{reading_num}"))

        # Basic validation of essential fields
        if not all(
            [
                measurement_type,
                original_value is not None,
                original_timestamp_str,
                not sensor_id.startswith("unknown_"),
            ]
        ):
            logging.warning(
                f"Skipping reading {reading_num}: missing essential field(s). Data: {reading}"
            )
            continue

        # --- 4. Check Sensor Existence/Type & Get Group ID ---
        group_id: Optional[str] = None
        stored_measurement = existing_sensors_map.get(sensor_id)
        is_new_sensor_in_this_batch = sensor_id in newly_identified_sensors

        if stored_measurement is not None:  # Sensor known from DB or earlier in this batch
            if stored_measurement != measurement_type:
                logging.warning(
                    f"REJECTED reading {reading_num}: Type mismatch for sensor {sensor_id}. "
                    f"DB/Batch='{stored_measurement}', Reading='{measurement_type}'."
                )
                rejected_mismatch_count += 1
                continue
            # Sensor type matches, get its group if available
            group_id = sensor_group_map.get(sensor_id)

        elif not is_new_sensor_in_this_batch:  # Truly new sensor for this hub
            logging.info(
                f"Reading {reading_num}: New sensor identified: ID='{sensor_id}', "
                f"Type='{measurement_type}'. Queued for creation."
            )
            # Prepare data for potential DB insert
            new_sensor_data = {
                "id": sensor_id,
                "client_id": client_id,
                "measurement": measurement_type,
                # Add default values for other required fields if necessary
            }
            new_sensors_to_create.append(new_sensor_data)
            newly_identified_sensors.add(sensor_id)
            # Add to in-memory map *immediately* so subsequent readings for the
            # same new sensor in this batch are processed correctly.
            existing_sensors_map[sensor_id] = measurement_type
            # Group ID might be available if map was pre-populated or updated elsewhere
            group_id = sensor_group_map.get(sensor_id)

        else: # Sensor was identified as new earlier in this *same batch*
            # Type consistency is guaranteed by the logic above.
            # Get group ID if it became available (unlikely mid-batch but possible)
            group_id = sensor_group_map.get(sensor_id)


        # --- 5. Timestamp Validation & Parsing ---
        timestamp_dt: Optional[datetime] = None
        try:
            if isinstance(original_timestamp_str, datetime):
                timestamp_dt = original_timestamp_str
            elif isinstance(original_timestamp_str, str):
                # Handle ISO format with or without 'Z'
                ts_str = original_timestamp_str.replace('Z', '+00:00')
                timestamp_dt = datetime.fromisoformat(ts_str)
            else:
                raise ValueError(f"Unsupported timestamp type: {type(original_timestamp_str)}")

            # Ensure timezone-aware (assume UTC if naive)
            if timestamp_dt.tzinfo is None:
                timestamp_dt = timestamp_dt.replace(tzinfo=timezone.utc)

        except (ValueError, TypeError) as e:
            logging.warning(
                f"Skipping reading {reading_num} (sensor {sensor_id}): "
                f"Invalid timestamp '{original_timestamp_str}'. Error: {e}"
            )
            continue

        # --- 6. Unit Handling and Value Preparation ---
        value_for_validation: Optional[Decimal] = None
        value_for_influx: Optional[float] = None # Influx client needs float
        original_source_unit_str: Optional[str] = None
        canonical_source_unit: Optional[str] = None
        canonical_target_unit: Optional[str] = None
        final_unit_for_influx: Optional[str] = None # Unit corresponding to value_for_influx

        # Determine target unit from server config
        config_key = MEASUREMENT_CONFIG_MAP.get(measurement_type, measurement_type)
        server_spec = server_config_map.get(config_key)

        if server_spec:
            raw_target_unit = server_spec.get("units")
            canonical_target_unit = get_canonical_unit(raw_target_unit)
        else:
            # If no server config, we cannot determine target unit or validation rules
            logging.warning(
                f"Skipping reading {reading_num} (sensor {sensor_id}, type {measurement_type}): "
                f"No ServerConfig entry found for config key '{config_key}'. Cannot process."
            )
            rejected_unit_err_count += 1
            continue

        # Determine source unit from hub config
        # Use specific mapping if exists, otherwise construct standard key
        hub_unit_key = MEASUREMENT_HUB_UNIT_KEY_MAP.get(
            config_key, f"{config_key}_unit"
        )
        original_source_unit_str = hub_config.get(hub_unit_key)
        canonical_source_unit = get_canonical_unit(original_source_unit_str)

        # --- Handle different unit/value scenarios ---
        try:
            if measurement_type in BINARY_TYPES:
                # Handle binary status types (expect 0 or 1)
                val = int(original_value)
                if val not in [0, 1]:
                    raise ValueError(f"Invalid binary value '{original_value}'")
                value_for_validation = Decimal(val)
                final_unit_for_influx = "status" # Assign a conceptual unit

            elif measurement_type in UNIT_EXPECTED_BUT_MISSING:
                # Handle types where unit is implied/not needed (e.g., humidity %)
                if canonical_source_unit or canonical_target_unit:
                    logging.warning(
                        f"Config mismatch for unitless type {measurement_type}: "
                        f"Units specified (Source: '{canonical_source_unit}', "
                        f"Target: '{canonical_target_unit}') but none expected."
                    )
                # Assume the value is directly usable
                value_for_validation = Decimal(str(original_value))
                # Assign a conventional unit if applicable (e.g., '%' for humidity)
                final_unit_for_influx = (
                    "percent" if measurement_type == "humidity" else None
                )

            elif canonical_source_unit and canonical_target_unit:
                # Both source and target units defined: Perform conversion
                value_for_validation = convert_value(
                    original_value,
                    canonical_source_unit,
                    canonical_target_unit,
                    measurement_type,
                )
                if value_for_validation is None:
                    # Conversion helper function already logged the error
                    raise ValueError("Unit conversion failed") # Skip to except block
                final_unit_for_influx = canonical_target_unit

            elif canonical_target_unit and not canonical_source_unit:
                # Target unit defined, but source is missing: Assume value is already in target unit
                logging.warning(
                    f"Processing {measurement_type} (sensor {sensor_id}): Hub config missing "
                    f"source unit ('{hub_unit_key}'). Assuming value '{original_value}' "
                    f"is already in target unit '{canonical_target_unit}'."
                )
                value_for_validation = Decimal(str(original_value))
                final_unit_for_influx = canonical_target_unit

            elif canonical_source_unit and not canonical_target_unit:
                # Source unit defined, but target is missing: Use value as-is with source unit
                logging.warning(
                    f"Processing {measurement_type} (sensor {sensor_id}): Server config missing "
                    f"target unit for '{config_key}'. Using value '{original_value}' "
                    f"with source unit '{canonical_source_unit}'."
                )
                value_for_validation = Decimal(str(original_value))
                final_unit_for_influx = canonical_source_unit

            else:  # Both source and target units missing where expected
                # This implies a configuration error for a standard measurement type
                raise ValueError(
                    f"Both source unit ('{hub_unit_key}' in HubConfig) and target unit "
                    f"('units' for '{config_key}' in ServerConfig) are missing."
                )

            # If we successfully got a Decimal value, convert to float for Influx
            if value_for_validation is not None:
                value_for_influx = float(value_for_validation)

        except (ValueError, TypeError, InvalidOperation) as e:
            # Catch errors from parsing (int, Decimal) or explicit raises
            logging.warning(
                f"Skipping reading {reading_num} (sensor {sensor_id}, type {measurement_type}): "
                f"Unit/Value processing error - {e}."
            )
            rejected_unit_err_count += 1
            continue
        except Exception as e:
             # Catch unexpected errors during unit logic
             logging.error(
                f"Unexpected error during unit/value handling for reading {reading_num} "
                f"(sensor {sensor_id}): {e}", exc_info=True
             )
             rejected_unit_err_count += 1
             continue

        # Check if we successfully obtained a value for validation
        if value_for_validation is None:
            logging.warning(
                 f"Skipping reading {reading_num} (sensor {sensor_id}, type {measurement_type}): "
                 f"Failed to produce a valid Decimal value for processing."
            )
            rejected_unit_err_count += 1
            continue


        # --- 7. Validate Value ---
        is_valid = validate_value(
            value_for_validation, measurement_type, server_config_map
        )
        if not is_valid:
            # validate_value function already logged the reason
            logging.info(
                f"Skipping reading {reading_num} (sensor {sensor_id}) due to validation failure "
                f"(Value: {value_for_validation}, Unit: {final_unit_for_influx})."
            )
            rejected_validation_count += 1
            continue

        # --- 8. CALL RULE ENGINE ---
        if group_id:
            # Prepare context for the rule engine
            trigger_context = {
                "trigger_type": "measurement",
                "client_id": client_id,
                "sensor_id": sensor_id,
                "group_id": group_id,
                "measurement_type": measurement_type,
                "value": value_for_validation, # Provide Decimal for precision
                "unit": final_unit_for_influx,
                "timestamp_dt": timestamp_dt,
            }
            try:
                # Rule engine executes actions internally (e.g., alerts, controls)
                triggered_ids = check_and_trigger_rules_for_event(
                    db, rc, group_id, "measurement", trigger_context
                )
                if triggered_ids:
                    logging.info(
                        f"Sensor {sensor_id} reading triggered rules: {triggered_ids}"
                    )
            except Exception as rule_exc:
                logging.error(
                    f"Rule engine execution failed for sensor {sensor_id} event: {rule_exc}",
                    exc_info=True,
                )
                # Decide if failure here should stop point creation (depends on requirements)
        else:
            logging.debug(
                f"Sensor {sensor_id} is not associated with any group. Skipping rule evaluation."
            )

        # --- 9. Create InfluxDB Point ---
        # Ensure we have the float value needed for InfluxDB
        if value_for_influx is None:
             logging.error(
                 f"Internal error: value_for_influx is None before creating point for sensor {sensor_id}. This should not happen."
             )
             continue

        try:
            point = Point("sensor_measurement") # Measurement name in InfluxDB
            # Tags (indexed fields)
            point.tag("client_id", client_id)
            point.tag("sensor_id", sensor_id)
            point.tag("measurement_type", measurement_type)
            if final_unit_for_influx:
                point.tag("standard_unit", final_unit_for_influx)

            # Fields (non-indexed data)
            point.field("value", value_for_influx) # The primary processed value

            # Add original value/unit fields for reference, handling potential type issues
            try:
                 # Try storing original value as float if possible
                 point.field("original_value_numeric", float(original_value))
            except (ValueError, TypeError):
                 # Fallback to string if not convertible to float
                 point.field("original_value_str", str(original_value))
            if original_source_unit_str:
                 point.field("original_unit", original_source_unit_str)

            # Timestamp
            point.time(timestamp_dt, WritePrecision.NS)

            influx_points.append(point)
            valid_points_count += 1

        except Exception as e:
            logging.error(
                f"Failed to create InfluxDB Point for reading {reading_num} (sensor {sensor_id}): {e}",
                exc_info=True,
            )
            # Continue processing other readings

    # --- END LOOP ---

    # --- 10. Batch Create New Sensors in PostgreSQL ---
    if new_sensors_to_create:
        logging.info(
            f"Attempting to create {len(new_sensors_to_create)} new sensors for hub {client_id}..."
        )
        try:
            # Ensure data keys match Sensor model __init__ or attributes
            new_sensor_objects = [Sensor(**data) for data in new_sensors_to_create]
            db.add_all(new_sensor_objects)
            db.commit()
            logging.info(
                f"Successfully created {len(new_sensor_objects)} new sensors in DB."
            )
            # Invalidate relevant caches after successful DB commit
            if rc:
                logging.debug(f"Invalidating inventory cache for hub {client_id} due to new sensors.")
                invalidate_inventory_cache(rc, client_id=client_id)
        except SQLAlchemyError as e:
            db.rollback()
            logging.error(
                f"Database error batch creating sensors for hub {client_id}: {e}",
                exc_info=True,
            )
        except Exception as e:
            # Catch potential errors during object creation or commit
            db.rollback()
            logging.error(
                f"Unexpected error batch creating sensors for hub {client_id}: {e}",
                exc_info=True,
            )

    # --- Final Summary Logging ---
    logging.info(
        f"Processing complete for hub {client_id}. "
        f"Total Readings: {processed_count}, "
        f"Valid Points for InfluxDB: {valid_points_count}, "
        f"Rejected (Type Mismatch): {rejected_mismatch_count}, "
        f"Rejected (Unit/Value Error): {rejected_unit_err_count}, "
        f"Rejected (Validation Fail): {rejected_validation_count}, "
        f"New Sensors Created: {len(new_sensors_to_create)}."
    )

    return influx_points

# --- End of processing.py ---

    