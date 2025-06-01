      
####################################
# Inventory Service
# Last version of update: v0.95
# app/services/inventory_service.py
####################################

import logging
import json
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
import redis # type: ignore
from typing import Dict, Any, Optional, List
import humanize # For relative time formatting
from datetime import datetime, timezone
from app.dep_lib import convert_units

# Adjust import path based on your project structure
try:
    from app.db_man.pqsql.models import Sensor, AvailableSensorsDatabase
except ImportError:
    # Fallback if models.py is in a different relative location
    logging.warning("Could not import models from app.db_man.pqsql, falling back to top-level import.")
    from models import Sensor, AvailableSensorsDatabase


# Cache configuration
CACHE_TTL_SECONDS = 300 # Cache general inventory lists for 5 minutes
SENSOR_GROUP_CACHE_TTL = 3600 # Cache sensor->group mapping for 1 hour

# --- Internal Helper Function ---

def _format_relative_time(dt_object: Optional[datetime]) -> str:
    """Helper to format datetime into a relative string using humanize."""
    if not dt_object:
        return "N/A"
    try:
        now = datetime.now(timezone.utc)
        # Ensure DB time is timezone-aware for comparison
        db_time_aware = dt_object
        if dt_object.tzinfo is None:
             # If DB object is naive, assume UTC (adjust if necessary)
             db_time_aware = dt_object.replace(tzinfo=timezone.utc)
        else:
             # Convert to UTC if it's aware but not UTC (optional, depends on desired output)
             db_time_aware = dt_object.astimezone(timezone.utc)

        # Use humanize to get "x minutes ago", "an hour ago", etc.
        return humanize.naturaltime(now - db_time_aware)
    except Exception as e:
        logging.warning(f"Failed to humanize timestamp {dt_object}: {e}")
        # Provide a clear fallback format if humanize fails
        return dt_object.strftime("%Y-%m-%d %H:%M %Z") if dt_object else "N/A"


# --- Internal Fetch Functions (Database Interaction) ---

def _fetch_sensors_from_db(db: Session) -> List[Dict[str, Any]]:
    """
    Fetches and formats sensor list directly from PostgreSQL,
    including denormalized last reading data and hub info.
    """
    logging.debug("Fetching sensors list directly from database.")
    sensors_list = []
    try:

        sensors_orm = db.query(Sensor).options(
            joinedload(Sensor.client_system)
        ).order_by(Sensor.id).all()

        for sensor in sensors_orm:
            hub_name = sensor.client_system.client_name if sensor.client_system else "Unknown Hub"
            hub_id = sensor.client_system.client_id if sensor.client_system else None
            # Create a reasonably descriptive default name
            sensor_name = f"{sensor.measurement.capitalize()} ({sensor.id})" # Example: "Temperature (s001)"

            # Format last reading data from the denormalized columns
            last_reading_str = "N/A"
            if sensor.last_reading_value is not None:
                # Format float nicely, handle non-float just in case
                val_str = f"{sensor.last_reading_value:.1f}" if isinstance(sensor.last_reading_value, float) else str(sensor.last_reading_value)
                # Append unit only if it exists
                unit_str = sensor.last_reading_unit if sensor.last_reading_unit else ""
                last_reading_str = f"{val_str} {convert_units.get(unit_str, unit_str)}" # e.g., "35.2°C", "62%", "15.8kg"

            # Format timestamp using humanize helper
            last_update_str = _format_relative_time(sensor.last_reading_time)

            # Append dictionary in the desired format
            sensors_list.append({
                "id": sensor.id,
                "name": sensor_name,
                "type": sensor.measurement,
                "hubId": hub_id,
                "hubName": hub_name,
                "lastReading": last_reading_str,
                "lastUpdate": last_update_str,
            })
        logging.info(f"Successfully fetched {len(sensors_list)} sensors from database.")
        return sensors_list

    except SQLAlchemyError as e:
        logging.error(f"Database error fetching sensors: {e}", exc_info=True)
        return [] # Return empty list on DB error
    except Exception as e:
        logging.error(f"Unexpected error fetching sensors: {e}", exc_info=True)
        return []


def _fetch_hubs_from_db(db: Session) -> List[Dict[str, Any]]:
    """
    Fetches and formats hub list with sensor counts and last heard from time
    directly from PostgreSQL.
    """
    logging.debug("Fetching hubs list directly from database.")
    hubs_list = []
    try:
        # Query Hubs (AvailableSensorsDatabase), count associated Sensors via outer join,
        # and get the denormalized last_heard_from timestamp
        query = db.query(
            AvailableSensorsDatabase.client_id,
            AvailableSensorsDatabase.client_name,
            AvailableSensorsDatabase.last_heard_from, # Select the denormalized column
            func.count(Sensor.id).label("sensor_count") # Count associated sensors
        ).outerjoin( # Use outerjoin to include hubs even if they have 0 sensors
            Sensor, AvailableSensorsDatabase.client_id == Sensor.client_id
        ).group_by(
            AvailableSensorsDatabase.client_id,
            AvailableSensorsDatabase.client_name,
            AvailableSensorsDatabase.last_heard_from # Must group by selected column
        ).order_by(
            AvailableSensorsDatabase.client_id # Order consistently
        )

        results = query.all()

        for hub_id, hub_name, last_heard_dt, sensor_count in results:
            # Format the last_heard_from timestamp using humanize helper
            last_update_str = _format_relative_time(last_heard_dt)

            # Append dictionary in the desired format
            hubs_list.append({
                "id": hub_id,
                "name": hub_name,
                "connectedSensors": sensor_count,
                "lastUpdate": last_update_str,
            })
        logging.info(f"Successfully fetched {len(hubs_list)} hubs from database.")
        return hubs_list

    except SQLAlchemyError as e:
        logging.error(f"Database error fetching hubs: {e}", exc_info=True)
        return [] # Return empty list on DB error
    except Exception as e:
        logging.error(f"Unexpected error fetching hubs: {e}", exc_info=True)
        return []


# --- Public Service Functions (Caching Logic) ---

def get_sensors(db: Session, rc: Optional[redis.Redis], force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Gets the list of all sensors, utilizing Redis cache.

    Args:
        db: SQLAlchemy Session instance.
        rc: Redis client instance (optional).
        force_refresh: If True, bypass cache and fetch directly from DB.

    Returns:
        A list of sensor dictionaries, matching the specified JSON structure.
    """
    cache_key = "inventory:sensors:all"
    sensors_data: List[Dict[str, Any]] = []

    # 1. Try Cache
    if rc and not force_refresh:
        try:
            cached_data_str = rc.get(cache_key)
            if cached_data_str:
                logging.debug(f"Cache HIT for sensors list ({cache_key})")
                sensors_data = json.loads(cached_data_str)
                # Basic check if cached data is the expected type
                if isinstance(sensors_data, list):
                    return sensors_data
                else:
                    logging.warning(f"Cached sensor data ({cache_key}) is not a list. Re-fetching.")
                    sensors_data = [] # Reset to trigger fetch
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis GET error for '{cache_key}': {e}. Falling back to DB.")
        except json.JSONDecodeError as e:
             logging.error(f"Redis cache data corrupted for '{cache_key}': {e}. Falling back to DB.")
             # Optionally, delete the corrupted key: rc.delete(cache_key)

    # 2. Fetch from Database if cache miss, invalid, error, or force_refresh
    logging.debug(f"Cache MISS or refresh forced for sensors list ({cache_key}). Fetching from DB.")
    sensors_data = _fetch_sensors_from_db(db)

    # 3. Populate cache if data was fetched successfully and Redis is available
    # Consider caching even empty lists to prevent repeated DB queries for non-existent data
    if rc: # Check if rc is available before attempting to set
        try:
            # Use default=str for safety (handles potential non-JSON types like datetime if not formatted)
            rc.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(sensors_data, default=str))
            logging.debug(f"Populated Redis cache for sensors list ({cache_key}) with {len(sensors_data)} items.")
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis SETEX error for '{cache_key}': {e}")
        except TypeError as e:
             logging.error(f"Failed to serialize sensors data for caching: {e}") # Should be rare with default=str

    return sensors_data


def get_hubs(db: Session, rc: Optional[redis.Redis], force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Gets the list of all hubs with sensor counts, utilizing Redis cache.

    Args:
        db: SQLAlchemy Session instance.
        rc: Redis client instance (optional).
        force_refresh: If True, bypass cache and fetch directly from DB.

    Returns:
        A list of hub dictionaries, matching the specified JSON structure.
    """
    cache_key = "inventory:hubs:all"
    hubs_data: List[Dict[str, Any]] = []

    # 1. Try Cache
    if rc and not force_refresh:
        try:
            cached_data_str = rc.get(cache_key)
            if cached_data_str:
                logging.debug(f"Cache HIT for hubs list ({cache_key})")
                hubs_data = json.loads(cached_data_str)
                if isinstance(hubs_data, list):
                    return hubs_data
                else:
                     logging.warning(f"Cached hub data ({cache_key}) is not a list. Re-fetching.")
                     hubs_data = []
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis GET error for '{cache_key}': {e}. Falling back to DB.")
        except json.JSONDecodeError as e:
             logging.error(f"Redis cache data corrupted for '{cache_key}': {e}. Falling back to DB.")

    # 2. Fetch from Database
    logging.debug(f"Cache MISS or refresh forced for hubs list ({cache_key}). Fetching from DB.")
    hubs_data = _fetch_hubs_from_db(db)

    # 3. Populate Cache
    if rc:
        try:
            rc.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(hubs_data, default=str))
            logging.debug(f"Populated Redis cache for hubs list ({cache_key}) with {len(hubs_data)} items.")
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis SETEX error for '{cache_key}': {e}")
        except TypeError as e:
             logging.error(f"Failed to serialize hubs data for caching: {e}")

    return hubs_data


# --- Function to get sensor -> group mapping (Needed by rule engine) ---
def get_sensor_group_map_cached(db: Session, rc: Optional[redis.Redis], client_id: str) -> Dict[str, Optional[str]]:
    """
    Fetches/caches a mapping of sensor_id -> group_id for a specific client_id (hub).
    """
    cache_key = f"map:sensor_group:{client_id}"
    sensor_group_map: Dict[str, Optional[str]] = {}

    # 1. Try Cache
    if rc:
        try:
            cached_data = rc.get(cache_key)
            if cached_data:
                logging.debug(f"Cache HIT sensor->group map ({cache_key})")
                return json.loads(cached_data)
        except redis.exceptions.RedisError as e: logging.error(f"Redis GET error sensor map '{cache_key}': {e}. Falling back.")
        except json.JSONDecodeError as e: logging.error(f"Redis cache corrupt sensor map '{cache_key}': {e}. Falling back.")

    # 2. Fetch from DB
    logging.debug(f"Cache MISS sensor->group map ({cache_key}). Fetching DB.")
    try:
        # Query only needed columns for efficiency
        results = db.query(Sensor.id, Sensor.group_id)\
                    .filter(Sensor.client_id == client_id)\
                    .all()
        sensor_group_map = {row.id: row.group_id for row in results} # group_id can be None
        logging.debug(f"Fetched group map for {len(sensor_group_map)} sensors of hub {client_id}.")
        logging.debug(f"Builded MAP: {sensor_group_map}")
    except SQLAlchemyError as e:
         logging.error(f"DB error fetching sensor group map for {client_id}: {e}", exc_info=True)
         return {} # Return empty on error to avoid processing without group info
    except Exception as e:
         logging.error(f"Unexpected error fetching sensor group map for {client_id}: {e}", exc_info=True)
         return {}

    # 3. Populate Cache
    if rc: # Cache the result (even if empty)
        try:
            rc.setex(cache_key, SENSOR_GROUP_CACHE_TTL, json.dumps(sensor_group_map))
            logging.debug(f"Populated Redis cache sensor->group map ({cache_key})")
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis SETEX error sensor map '{cache_key}': {e}")

    return sensor_group_map


# --- Cache Invalidation ---
def invalidate_inventory_cache(rc: Optional[redis.Redis], client_id: Optional[str] = None):
    """
    Clears general inventory lists AND specific client's sensor-group map if client_id provided.
    """
    if not rc:
        logging.warning("Cannot invalidate cache: Redis client unavailable.")
        return

    keys_to_delete = ["inventory:sensors:all", "inventory:hubs:all"]
    if client_id:
        keys_to_delete.append(f"map:sensor_group:{client_id}")

    if not keys_to_delete: return

    try:
        deleted_count = rc.delete(*keys_to_delete)
        if deleted_count > 0:
             logging.info(f"Invalidated inventory/sensor cache. Deleted {deleted_count} keys: {keys_to_delete}")
    except redis.exceptions.RedisError as e:
        logging.error(f"Redis DELETE error during cache invalidation: {e}")


    