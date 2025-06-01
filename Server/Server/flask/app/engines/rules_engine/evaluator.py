####################################################
# Rule evaluator program
# Last version of update: v0.95
# app/engines/rules_engine/evaluator.py
####################################################

import logging
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, Optional, List, Set

from .actions import execute_action # Actions from sibling module
# Adjust import path for loader function and types
try:
    from app.cache.database_caching import get_rules_for_group_cached
except ImportError as err1:
    logging.error(f"Evaluator error: {err1}")
    try: 
        from .loader import get_rules_for_group_cached, ActionDict, InitiatorDict
    except ImportError: 
        logging.error("Cannot import rule loader function/types for evaluator. 1")
        RuleDict=Dict 
        ActionDict=Dict 
        InitiatorDict=Dict; 
        def get_rules_for_group_cached(*args, **kwargs): return []


# Import DB session/Redis for loader call
from sqlalchemy.orm import Session, joinedload, selectinload
import redis # type: ignore
from datetime import timedelta, datetime, timezone
from app.dep_lib import measurement_init, translate_init
from app.db_man.pqsql.models import Group, Sensor
from sqlalchemy import func
from app.engines.event_engine.event_tracker import write_event

window_seconds = 10

# --- Condition Evaluation Helper (Keep as before) ---
def evaluate_condition( sensor_value: Decimal, operator: Optional[str], threshold1_str: Optional[str], threshold2_str: Optional[str] = None) -> bool:
    # ... (Implementation using Decimal, handling operators) ...
    if operator is None or threshold1_str is None: return False
    try:
        threshold1 = Decimal(threshold1_str); threshold2 = Decimal(threshold2_str) if threshold2_str is not None else None; op = operator.lower().strip()
        if op in ['>', 'gt']: return sensor_value > threshold1
        elif op in ['>=', 'gte']: return sensor_value >= threshold1
        elif op in ['<', 'lt']: return sensor_value < threshold1
        elif op in ['<=', 'lte']: return sensor_value <= threshold1
        elif op in ['=', '==', 'eq']: return sensor_value == threshold1
        elif op in ['!=', 'ne']: return sensor_value != threshold1
        elif op == 'between':
            if threshold2 is None: logging.warning("Rule Eval: 'between' needs 2 thresholds."); return False
            t1, t2 = (threshold1, threshold2) if threshold1 <= threshold2 else (threshold2, threshold1); return t1 <= sensor_value <= t2
        elif op in ['outside', 'not between']:
            if threshold2 is None: logging.warning("Rule Eval: 'outside' needs 2 thresholds."); return False
            t1, t2 = (threshold1, threshold2) if threshold1 <= threshold2 else (threshold2, threshold1); return sensor_value < t1 or sensor_value > t2
        else: logging.warning(f"Unsupported rule operator: '{operator}'"); return False
    except (InvalidOperation, TypeError, ValueError) as e: logging.error(f"Rule Eval Error: Invalid thresholds. Op='{operator}', T1='{threshold1_str}', T2='{threshold2_str}'. Error: {e}"); return False
    except Exception as e: logging.error(f"Unexpected rule eval error: {e}", exc_info=True); return False


# --- Trigger Rule Actions ---
def trigger_rule_actions(rule_data: Dict, trigger_context: Dict[str, Any], rc, db: Optional[Session] = None): # Add db parameter
    """Executes the actions associated with a triggered rule."""
    actions = rule_data.get('actions', [])
    rule_id = rule_data.get('id', 'UNKNOWN_RULE')
    rule_prio = rule_data.get('priority', 'N/A')

    if not actions:
        logging.debug(f"Rule {rule_id} triggered but has no actions.")
        return

    logging.debug(f"Executing {len(actions)} actions for Rule {rule_id} (Priority: {rule_prio})...")
    # Prepare context (can be augmented per action)
    action_context = trigger_context.copy() # Use trigger context
    action_context['rule_id'] = rule_id
    action_context['rule_name'] = rule_data.get('name')
    action_context['rule_priority'] = rule_prio

    # Actions are pre-sorted by loader
    for action_data in actions:
        # Pass the db session down to execute_action
        execute_action(action_data, action_context, rc=rc, db=db) # Pass db




def evaluate_measurement(db, initiator, trigger_context):
    measurement_type = initiator.get('type', "None")
    group_id = trigger_context.get('group_id')
    latest_time_subquery = db.query(
        func.max(Sensor.last_reading_time)
    ).filter(
        Sensor.group_id == group_id,
        Sensor.measurement == translate_init.get(measurement_type, measurement_type),
        Sensor.last_reading_time.isnot(None)  # Only consider sensors with actual reading times
    ).scalar_subquery()

    average_value = db.query(
        func.avg(Sensor.last_reading_value)
    ).filter(
        Sensor.group_id == group_id,
        Sensor.measurement == translate_init.get(measurement_type, measurement_type),
        Sensor.last_reading_time == latest_time_subquery  # Filter by the most recent time
    ).scalar()

    condition_met = evaluate_condition(
                    sensor_value=average_value,
                    operator=initiator.get('operator'),
                    threshold1_str=initiator.get('value'),
                    threshold2_str=initiator.get('value2')
    )
    return condition_met



def evaluate_tag(db, intiator_tags, trigger_context):
    # get tags
    group = db.query(Group).options(joinedload(Group.tags)).filter(Group.id == trigger_context.get('group_id')).first()
    result = set(intiator_tags).issubset(set(group.tags))
    return result

def evaluate_schedule(initiator):
    schedule_type = initiator.get('schedule_type', 'None')
    schedule_value = initiator.get('schedule_value', "None")
    current_time = datetime.now(timezone.utc)
    try:
        # --- 1. Parse scheduled time (HH:MM) ---
        # This is common to all types.
        # If there's a date part, it's before a comma.
        if ',' in schedule_value:
            date_part_str, time_str = schedule_value.split(',', 1)
        else: # Daily schedule
            date_part_str = None
            time_str = schedule_value

        scheduled_hour, scheduled_minute = map(int, time_str.split(':'))

        # --- 2. Define the precise scheduled time for today's date (or relevant date) ---
        # This will be the start of our active window.
        # We use current_time's date parts and replace only H, M, S, MS.
        scheduled_datetime_start = current_time.replace(
            hour=scheduled_hour,
            minute=scheduled_minute,
            second=0,
            microsecond=0
        )

        # The window ends 'window_seconds' after the scheduled_datetime_start.
        # The range is [scheduled_datetime_start, scheduled_datetime_start + window_seconds]

        scheduled_datetime_end_inclusive = scheduled_datetime_start + timedelta(seconds=window_seconds)
        # --- 3. Check if current_time is within the time window [start, end_inclusive] ---
        time_matches = (scheduled_datetime_start <= current_time <= scheduled_datetime_end_inclusive)

        logging.debug(f"Time matches: {time_matches}, Start: {scheduled_datetime_start}, current_time: {current_time}, end: {scheduled_datetime_end_inclusive}")
        if not time_matches:
            return False # If time doesn't match, no need to check date parts

        # --- 4. Check date components based on schedule_type ---
        if schedule_type == 'daily':
            return True # Time already matched

        elif schedule_type == 'weekly':

            if date_part_str is None: return False # Should not happen for weekly
                       
            return current_time.weekday() == int(date_part_str)

        elif schedule_type == 'monthly':
            # '1,15:01' (DD,HH:MM)
            if date_part_str is None: return False # Should not happen for monthly
            
            scheduled_day_of_month = int(date_part_str)
            return current_time.day == scheduled_day_of_month

        elif schedule_type == 'yearly':
            # '15/06,10:00' (DD/MM,HH:MM)
            if date_part_str is None: return False # Should not happen for yearly
            
            day_str, month_str = date_part_str.split('/')
            scheduled_day = int(day_str)
            scheduled_month = int(month_str)
            return current_time.day == scheduled_day and current_time.month == scheduled_month

        else:
            logging.debug(f"Unknown schedule type: {schedule_type}") # Or raise an error
            return False

    except ValueError:
        logging.debug(f"Error parsing value '{schedule_value}' for type '{schedule_type}'.") # Or log
        return False
    except Exception as e:
        logging.warning(f"An unexpected error occurred: {e}") # Or log
        return False
    
def check_rule_initiators(
    db: Session,
    rule_data: Dict,
    trigger_type: str, # e.g., "measurement", "schedule", "tag_change"
    trigger_context: Dict[str, Any]
    ) -> bool:
    """
    Evaluates initiators of a specific type for a given rule against the trigger context.
    Applies the rule's logical operator.

    Args:
        rule_data: Dictionary representing the rule.
        trigger_type: The type of event triggering the check.
        trigger_context: Data relevant to the trigger
                         (e.g., sensor data for 'measurement', time info for 'schedule').

    Returns:
        True if the rule's conditions (for the specified trigger type) are met, False otherwise.
    """
    initiators = rule_data.get('initiators', [])
    logical_operator = rule_data.get('logical_operator', 'or').lower()
    rule_id = rule_data.get('id', 'UNKNOWN')

    relevant_initiator_results: List[bool] = []
    found_intiators = []

    for initiator in initiators:
        stored_type = translate_init.get(str(initiator.get('type')), str(initiator.get('type')))
        if (stored_type == trigger_context.get('measurement_type')) or (str(stored_type) == str(trigger_context.get('trigger_type'))):
            found_intiators.append(initiator)
        else:
            logging.debug(f"Stored type: {stored_type}, trigger_type: {trigger_type}")

    if found_intiators == []:
        logging.debug(f"Rule {rule_id} has no initiators matching trigger type '{trigger_type}'.")
        logging.debug(f"stored_type: {stored_type}")
        logging.debug(f"measurement_type: {trigger_context.get('measurement_type')}")
        logging.debug(f"trigger_context: {trigger_context.get('trigger_type')}")
        return False
    num_init = 0
    for initiator in initiators:
        num_init += 1
        condition_met = False
        initiator_type = str(initiator.get('type'))
        logging.debug(f"Intiator: {num_init}/{len(initiators)}, type: {initiator_type}")
        if (translate_init.get(initiator_type, initiator_type) == trigger_context.get('measurement_type')):
            # called by measurement, before writing into postgres last sensor value.
            logging.debug("Case_1: initiator called by trigger_context")
            sensor_value = trigger_context.get('value')
            logging.debug(f"sensor value: {sensor_value}, trigger: {trigger_context}")
            got_value_condition_met = evaluate_condition(
                    sensor_value=sensor_value,
                    operator=initiator.get('operator'),
                    threshold1_str=initiator.get('value'),
                    threshold2_str=initiator.get('value2')
            )
            last_value_condition_met = evaluate_measurement(db, initiator, trigger_context) # I can because, measurement rule is evaluated before put into postgres database, 
            if got_value_condition_met and last_value_condition_met:        # if hub with multiple sensors assigned to specific group and the sensors data get inside at the same time, then if the values are near threshold there will be multiple warnings. 
                logging.debug("Last is evaluated same as the new one")                                                              # user can add schedule initator that will activates              
                condition_met = False
            else:
                condition_met = got_value_condition_met
            logging.debug(f"Final Case_1: {condition_met}")
        elif (initiator_type in measurement_init):
            logging.debug("Case_2: initiator is measurement but the trigger_context")
            condition_met = evaluate_measurement(db, initiator, trigger_context)
            logging.debug(f"Final Case_2: {condition_met}")
        elif (initiator_type in set(('tag', 'set_tag', 'tag_change'))):
            try:
                logging.debug("Case_3: initiator is tag.")
                condition_met = evaluate_tag(db, initiator.get('tags'), trigger_context)
                logging.debug(f"Final Case_3: {condition_met}")
            except Exception as e:
                logging.error(f"ERROR IN THE TAG INCI: {initiator}, trigger: {trigger_context}, rule: {rule_data}")
        elif (initiator_type in set(('date', 'time', 'schedule_interval', 'time_interval', 'schedule'))):
            logging.debug("Case 4: initiator is time")
            condition_met = evaluate_schedule(initiator)
            logging.debug(f"Final Case 4: {condition_met}")
        else:
            logging.debug(f"Edge case or not stored: 5 {initiator_type}")
            condition_met = False
        if condition_met:
            relevant_initiator_results.append(True)
        else:
            relevant_initiator_results.append(False)

    logging.debug(f"Final Intiators status: {relevant_initiator_results}")
    if logical_operator == 'and':
        result = all(relevant_initiator_results)
        logging.info(f"Rule {rule_id} (AND on '{trigger_type}') evaluation result: {result}")
        return result
    elif logical_operator == 'or':
        result = any(relevant_initiator_results)
        logging.info(f"Rule {rule_id} (OR on '{trigger_type}') evaluation result: {result}")
        return result
    else:
        logging.warning(f"Unsupported logical operator '{logical_operator}' for rule {rule_id}. Defaulting to AND.")
        return all(relevant_initiator_results)



# --- Main Entry Point for Checking Rules for a Specific Trigger/Context ---
def check_and_trigger_rules_for_event(
    db: Session, # db is already available here
    rc: Optional[redis.Redis],
    group_id: str,
    trigger_type: str, # "measurement", "schedule_interval", "tag_change", etc.
    trigger_context: Dict[str, Any] # Data specific to the trigger
    ) -> Set[str]:
    """
    Fetches applicable rules for a group, checks initiators matching the trigger type,
    and executes actions for fully matched rules based on their logical operator.
    Returns IDs of triggered rules.

    Expected behavior: in measurement mode, must be called before postgres
                       in tag mode, must be called when the specific tag is called, not used generally
                       in schedule mode, for now, no know restricitions
    """
    triggered_rule_ids: Set[str] = set()
    if not group_id:
        logging.warning("Cannot check rules: group_id is missing.")
        return triggered_rule_ids

    # 1. Get rules for this group (sorted by priority)
    rules_for_group = get_rules_for_group_cached(db, rc, group_id)
    if not rules_for_group:
        logging.debug(f"No active rules found for group {group_id} to check against trigger '{trigger_type}'.")
        return triggered_rule_ids

    logging.debug(f"Evaluating {len(rules_for_group)} rules for group {group_id} based on trigger '{trigger_type}'...")

    # Add group_id to context if not already present
    if 'group_id' not in trigger_context:
        trigger_context['group_id'] = group_id
    logging.debug("Evaluating intiators for each rule: ")

    logging.debug(f"Trigger context: {trigger_context}")
    logging.debug("")
    # 2. Evaluate rules in priority order
    for rule in rules_for_group:
        rule_id = rule['id']
        logging.debug(f"Checking Rule '{rule_id}' (Prio: {rule['priority']}) for trigger '{trigger_type}'...")
        try:
            logging.info(f"rule info: {rule}, trigger type:{trigger_type}, trigger context: {trigger_context}")
            # Check if *this rule's* relevant initiators are met by the trigger event
            rule_conditions_met = check_rule_initiators(
                db=db,
                rule_data=rule,
                trigger_type=trigger_type,
                trigger_context=trigger_context
            )

            if rule_conditions_met:
                logging.info(f"RULE TRIGGERED: Rule ID '{rule_id}' (Prio: {rule['priority']}) fully met by '{trigger_type}' event for group {group_id}.")
                triggered_rule_ids.add(rule_id)
                # Execute actions for this triggered rule, PASSING DB
                write_event(db, {'group_id': trigger_context.get("group_id"), 
                                 'type': 'rule_executed',
                                 'rule_context': rule})
                trigger_rule_actions(rule, trigger_context,rc,db=db) # Pass db here
                
        except Exception as e:
             logging.error(f"Error processing rule '{rule_id}' during event '{trigger_type}': {e}", exc_info=True)

    return triggered_rule_ids