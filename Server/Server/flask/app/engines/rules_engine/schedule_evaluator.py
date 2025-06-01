####################################################
# Schedule evaluating program 
# Last version of update: v0.95
# app/engines/rules_engine/schedule_evaluator.py
####################################################

from sqlalchemy.orm import Session, selectinload, joinedload
from datetime import datetime, timezone, date
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.client.exceptions import InfluxDBError
import logging
import os
from app.db_man.pqsql.models import *


INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8087")
INFLUXDB_TOKEN = os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN", "") 
INFLUXDB_ORG = os.getenv("DOCKER_INFLUXDB_INIT_ORG", "vceljak") 
INFLUXDB_BUCKET = os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")


def check_sensor_condition_all_must_match(
    time_period: str,
    sensor_id: str,
    measurement_name: str = "sensor_measurement",
    field_key: str = "value",
    operator: str = "==",
    condition_value: float = 0.0
) -> bool:
    """
    Checks if ALL sensor values meet a condition within a given time period.
    - For value comparisons: True if data exists AND all data points meet the condition.
    - For "observed": True if any data point exists.

    Args:
        time_period: The duration string for the query range (e.g., "1h", "7d").
        sensor_id: The ID of the sensor to check.
        measurement_name: The InfluxDB measurement name.
        field_key: The field key containing the value to check.
        operator: The comparison operator (">", "<", "==", "<=", ">=", "observed").
        condition_value: The value to compare against (ignored if operator is "observed").

    Returns:
        True if the condition is met according to the "all must match" logic, False otherwise.
    """
    flux_query = ""

    normalized_operator = operator.lower().strip()

    if normalized_operator == "above":
        normalized_operator = ">"
    elif normalized_operator == "below":
        normalized_operator = "<"
    elif normalized_operator == "aboveequal":
        normalized_operator = ">="
    elif normalized_operator == "belowequal":
        normalized_operator = "<="
    elif normalized_operator == "equal":
        normalized_operator = "="
    

    if normalized_operator == "observed":
        
        flux_query = f'''
            import "array"

            // Base data for the sensor and field
            base_data = from(bucket: "{INFLUXDB_BUCKET}")
              |> range(start: -{time_period})
              |> filter(fn: (r) => r._measurement == "{measurement_name}")
              |> filter(fn: (r) => r.sensor_id == "{sensor_id}")
              |> filter(fn: (r) => r._field == "{field_key}")

            // Filter for the specific value we want to observe
            specific_value_present = base_data
              |> filter(fn: (r) => r._value == {float(condition_value)}) // Check for equality with condition_value
              |> count() // Count how many times this specific value was found
              |> map(fn: (r) => ({{_value: r._value > 0 }})) // True if count > 0 (i.e., value was found at least once)
              |> findRecord(fn: (key) => true, idx: 0) // Get the single result record

            meets_condition = if exists specific_value_present._value then
                                 specific_value_present._value
                               else
                                 false // If findRecord fails or no data, assume false

            array.from(rows: [{{final_condition_met: meets_condition}}])
              |> yield(name: "result")
        '''
    else:
        

        flux_query = f'''
            import "array"

            base_data = from(bucket: "{INFLUXDB_BUCKET}")
              |> range(start: -{time_period})
              |> filter(fn: (r) => r._measurement == "{measurement_name}")
              |> filter(fn: (r) => r.sensor_id == "{sensor_id}")
              |> filter(fn: (r) => r._field == "{field_key}")

            has_any_data_record = base_data
              |> count()
              |> map(fn: (r) => ({{_value: r._value > 0 }}))
              |> findRecord(fn: (key) => true, idx: 0)

            has_any_data = if exists has_any_data_record._value then
                                 has_any_data_record._value
                               else
                                 false

            violators_count_record = base_data
              |> filter(fn: (r) => not (r._value {normalized_operator} {float(condition_value)}))
              |> count()
              |> findRecord(fn: (key) => true, idx: 0)

            violators_count = if exists violators_count_record._value then
                                    violators_count_record._value
                                  else
                                    0

            meets_condition = has_any_data and violators_count == 0

            array.from(rows: [{{final_condition_met: meets_condition}}])
              |> yield(name: "result")
        '''

    logging.debug(f"--- Executing Flux Query ---\n{flux_query}\n-------------------------------------------------")

    try:
        with InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG, timeout=20000) as client: # Increased timeout
            query_api = client.query_api()
            tables = query_api.query(query=flux_query)

            if not tables:
                logging.debug("Query returned no tables. Assuming condition not met.")
                return False

            for table in tables:
                if table.records:
                    for record in table.records:
                        logging.debug(record)
                        if record.values.get("final_condition_met") is True:
                            return True
                    # If loop finishes for a table with records, 'final_condition_met' was false.
                    return False
            # If no tables had records with 'final_condition_met'
            logging.debug("Query returned tables but no relevant records found. Assuming condition not met.")
            return False

    except InfluxDBError as e:
        logging.error(f"InfluxDB API Error: {e}")
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return False




def evaluate_condition(condition: ScheduleCondition) -> bool:
    """
    Evaluates a single schedule condition.
    Updates condition.actual_value (streak counter) and condition.last_update.
    Returns True if the condition's target duration/streak is met, False otherwise.
    Assumes condition.group (and .sensors) are pre-loaded.
    """
    current_time = datetime.now(timezone.utc)
    condition.last_update = current_time  # Update last_update time regardless of outcome

    try:
        # Ensure actual_value is treated as an integer for streak counting
        current_streak = int(condition.actual_value) if condition.actual_value and condition.actual_value.isdigit() else 0
    except ValueError:
        current_streak = 0
    
    target_duration = condition.duration if condition.duration is not None and condition.duration > 0 else 1
    
    condition_type_lower = condition.type.lower() if condition.type else ""
    check_passed_this_iteration = 0 # Result of this specific check cycle

    # --- Measurement Condition (e.g., temperature, humidity) ---
    if condition_type_lower in ['temperature', 'humidity', 'weight', 'pressure', 'sound level', 'voc']: # Add all relevant measurement types
        target_group = condition.group
        if not target_group:
            logging.debug(f"    Condition {condition.condition_id} ({condition.type}): Measurement check needs a group, but none linked.")
            current_streak = 0 # Reset streak
            condition.actual_value = str(current_streak)
            return current_streak >= target_duration

        if not target_group.sensors:
            logging.debug(f"    Condition {condition.condition_id} ({condition.type}): Group '{target_group.id}' has no sensors for measurement check.")
            current_streak = 0 # Reset streak
            condition.actual_value = str(current_streak)
            return current_streak >= target_duration

        # Determine InfluxDB query_time_period from condition.duration_unit
        # This time_period is for *one check interval*
        influx_query_period_map = {
            "minute": "1m", "minutes": "1m",
            "hour": "1h", "hours": "1h",
            "day": "1d", "days": "1d",
            "week": "1w", "weeks": "1w",
            "check": "1h", # Default 'check' to 1 hour; adjust as needed for your scheduling frequency
        }
        duration_unit_lower = condition.duration_unit.lower() if condition.duration_unit else "check"
        query_time_period = influx_query_period_map.get(duration_unit_lower, "1h")

        # Find the relevant sensor by matching condition.type with sensor.measurement
        found_sensor = []
        for sensor in target_group.sensors:
            if sensor.measurement and sensor.measurement.lower() == condition_type_lower:
                found_sensor.append(sensor)
                
        number_of_sensor = len(found_sensor)
        if not found_sensor:
            logging.debug(f"    Condition {condition.condition_id} ({condition.type}): No sensor found in Group '{target_group.id}' matching measurement type '{condition_type_lower}'.")
            current_streak = 0 # Reset streak
        else:
            checks_passed = 0
            for sensor in found_sensor:
                value_to_check_str = condition.value
                operator_str = condition.operator
                
                if operator_str.lower().strip() == "observed":
                     value_to_check_float = float(value_to_check_str)# Not used by 'observed' operator logic in check_sensor_condition_all_must_match
                else:
                    try:
                        value_to_check_float = float(value_to_check_str)
                    except (ValueError, TypeError):
                        logging.warning(f"    Condition {condition.condition_id} ({condition.type}): Invalid condition value '{value_to_check_str}' for numeric comparison. Resetting streak.")
                        current_streak = 0 # Reset streak due to invalid config
                        condition.actual_value = str(current_streak)
                        return 0

               
                sensor_check = check_sensor_condition_all_must_match(
                    time_period=query_time_period,
                    sensor_id=sensor.id,
                    measurement_name="sensor_measurement", # Standard measurement name for sensor data
                    field_key="value",                    # Standard field key for sensor readings
                    operator=operator_str,
                    condition_value=value_to_check_float
                )
                if sensor_check:
                    checks_passed += 1
            if checks_passed == number_of_sensor:
                check_passed_this_iteration = True
    else:
        logging.debug(f"    Condition {condition.condition_id}: Unhandled condition type '{condition.type}'. Resetting streak.")
        current_streak = 0 # Reset streak for unhandled types

    # Update streak based on this iteration's check result
    if check_passed_this_iteration:
        current_streak += 1
    else:
        current_streak = 0 # Reset streak if condition failed this time
    
    if int(condition.actual_value) > int(condition.duration):
        condition.actual_value = str(condition.duration)
    else: 
        condition.actual_value = str(current_streak)
    
    if condition.operator == "observed":
        if current_streak >= 1:
            condition.actual_value = condition.duration
            return 1
    
    logging.debug(f"    Condition {condition.condition_id} ({condition.type}): Streak updated to {current_streak}/{target_duration}.")
    return int(current_streak) / int(condition.duration)

from datetime import datetime, timedelta, timezone

def time_calc(db_timestamp_str, time_span_unit, condition):
    try:
        
        # Ensure db_time is timezone-aware (it should be if fromisoformat parsed the +00)
        if db_timestamp_str.tzinfo is None:
            logging.warning("Warning: Database timestamp was parsed as naive. Assuming UTC.")
            db_timestamp_str = db_timestamp_str.replace(tzinfo=timezone.utc)


        # 2. Define the time delta based on the input
        if time_span_unit.lower() == 'hours':
            delta = timedelta(hours=1)
        elif time_span_unit.lower() == 'days':
            delta = timedelta(days=1)
        elif time_span_unit.lower() == 'weeks':
            delta = timedelta(weeks=1)
        else:
            raise ValueError("Invalid time_span_unit. Choose 'hour', 'day', or 'week'.")
        # 3. Calculate the target time (this will also be timezone-aware)
        target_time = db_timestamp_str + delta

        # 4. Get the current time as timezone-aware UTC
        current_time_utc = datetime.now(timezone.utc)

        # 5. Compare (both are timezone-aware, so direct comparison is correct)
        if condition.operator == "observed":
            return True
        return current_time_utc >= target_time 

    except ValueError as e:
        logging.error(f"Error processing timestamp or timespan: {e}")
        # Could be due to parsing db_timestamp_str or invalid time_span_unit/value
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return False


def check_and_update_schedule_progress(db: Session, schedule_id: str):
    """
    Checks all conditions for a given schedule, updates its progress,
    and status if all conditions are met.
    """
    schedule = db.query(Schedule).options(
        selectinload(Schedule.conditions).options(
            joinedload(ScheduleCondition.group).options(
                selectinload(Group.sensors),
                selectinload(Group.tags) # Retained tags preloading, though not used in current evaluate_condition
            )
        )
    ).filter(Schedule.id == schedule_id).first()

    if not schedule:
        logging.debug(f"Schedule with ID '{schedule_id}' not found.")
        return

    
    if not schedule.conditions:
        logging.debug(f"Schedule '{schedule.name}' (ID: {schedule.id}) has no conditions.")
    else:
        total_conditions = len(schedule.conditions)
        met_conditions_count = 0

        logging.debug(f"\nChecking conditions for Schedule: '{schedule.name}' (ID: {schedule.id}, Current Status: {schedule.status}, Progress: {schedule.progress}%)")
        for condition in schedule.conditions:
            logging.debug(f"  Evaluating Condition ID: {condition.condition_id}, Type: '{condition.type}', Operator: '{condition.operator}', Value: '{condition.value}', Target Duration: {condition.duration} {condition.duration_unit}, Current Streak: {condition.actual_value}, Group: {condition.group_id}")
            if not (time_calc(condition.last_update, condition.duration_unit, condition)):
                condition_progress = (int(condition.actual_value) / int(condition.duration))
                if condition_progress > 1:
                    met_conditions_count += 1
                else: 
                    met_conditions_count += condition_progress
                continue
            # condition_calculating_updating calls evaluate_condition, which updates condition.actual_value and condition.last_update
            condition_met_for_schedule = evaluate_condition(condition)
            met_conditions_count += condition_met_for_schedule
            if condition_met_for_schedule == 1:
                logging.debug(f"    Condition ID: {condition.condition_id} - FULLY MET (Streak: {condition.actual_value} >= Target: {condition.duration})")
            else:
                logging.debug(f"    Condition ID: {condition.condition_id} - NOT YET FULLY MET (Streak: {condition.actual_value} < Target: {condition.duration})")


        new_progress = 0
        if total_conditions > 0:
            logging.debug(met_conditions_count)
            new_progress = int((met_conditions_count / total_conditions) * 100)

        logging.debug(f"  Schedule '{schedule.name}': {met_conditions_count}/{total_conditions} conditions fully met. Calculated progress: {new_progress}%")
        if new_progress > 100:
            new_progress = 100

        # Update schedule progress and status
        if schedule.progress != new_progress:
            schedule.progress = new_progress
            logging.info(f"  Schedule '{schedule.name}' progress updated to {new_progress}%.")


        if new_progress >= 100:
            if schedule.status != 'completed':
                schedule.status = 'completed'
                schedule.completion_date = datetime.now(timezone.utc).date()
                logging.info(f"  Schedule '{schedule.name}' marked as COMPLETED on {schedule.completion_date}.")
        else: # new_progress < 100
            if schedule.status == 'completed':
                schedule.completion_date = None # Clear completion date
                # Decide if it goes to 'in-progress' or 'pending'
                schedule.status = 'in-progress' if new_progress > 0 else 'pending'
                logging.info(f"  Schedule '{schedule.name}' status reverted from 'completed' to '{schedule.status}'.")
            elif new_progress > 0:
                if schedule.status == 'pending':
                    schedule.status = 'in-progress'
                    logging.info(f"  Schedule '{schedule.name}' status changed from 'pending' to 'in-progress'.")
            elif new_progress == 0: # new_progress is 0 and not 100
                if schedule.status != 'pending':
                    schedule.status = 'pending'
                    logging.info(f"  Schedule '{schedule.name}' status changed to 'pending'.")
    
    try:
        db.commit()
        logging.info(f"  Successfully updated and committed changes for schedule '{schedule.name}'. Final Status: {schedule.status}, Progress: {schedule.progress}%.")
    except Exception as e:
        db.rollback()
        logging.error(f"Error updating schedule '{schedule.name}': {e}")