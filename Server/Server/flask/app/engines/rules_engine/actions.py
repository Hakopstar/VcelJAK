####################################################
# Action running program
# Last version of update: v0.95
# app/engines/rules_engine/actions.py
####################################################
import logging
import json
from typing import Dict, Any, Optional

# --- NEW IMPORTS ---
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import redis # For type hinting rc

try:
    from app.sse import update_sse # Import the SSE update function
    SSE_AVAILABLE = True
except ImportError:
    logging.warning("Could not import update_sse function. SSE actions will be unavailable.")
    SSE_AVAILABLE = False
    def update_sse(*args, **kwargs):
        logging.error("SSE function called but module not available.")

try:
    # Import Group and Tag models
    from app.db_man.pqsql.models import Group, Tag
    from app.services.health_service import update_health
except ImportError:
    logging.error("Could not import Group or Tag model. Health/Tag adjustment actions will fail.")
    Group = None
    Tag = None

try:
    ActionDict = Dict[str, Any]
except ImportError:
    ActionDict = Dict[str, Any]

# --- Action Implementations ---

def action_log_event(params: Optional[Dict[str, Any]], context: Dict[str, Any], db: Optional[Session] = None, rc: Optional[redis.Redis] = None): # Add rc
    logging.info("--- Rule Action: Log Event Triggered ---")
    message = params.get("message", "Rule triggered") if params else "Rule triggered"
    level = params.get("level", "info").lower() if params else "info"
    log_func = getattr(logging, level, logging.info)
    rule_id = context.get('rule_id', 'N/A'); rule_prio = context.get('rule_priority', 'N/A')
    log_func(f"Rule Event (Prio:{rule_prio}): {message} [Context: Sensor={context.get('sensor_id')}, Group={context.get('group_id')}, Val={context.get('value')}, Unit={context.get('unit')}]")

def action_send_notification(params: Optional[Dict[str, Any]], context: Dict[str, Any], db: Optional[Session] = None, rc: Optional[redis.Redis] = None): # Add rc
    logging.info("--- Rule Action: Send Notification Triggered ---")
    target = params.get("target", "default_channel") if params else "default_channel"
    message_template = params.get("message", "Alert: Rule {rule_id} (Prio:{rule_priority}) triggered for {sensor_id} ({value} {unit}) in group {group_id}") if params else "Alert triggered"
    try: message = message_template.format(**context)
    except KeyError as e: logging.warning(f"Notification format fail key {e}. Template: '{message_template}'"); message = f"Alert: Rule {context.get('rule_id','N/A')} triggered."
    logging.warning(f"NOTIFICATION (Simulated): To='{target}': {message}")

def action_adjust_health(params: Optional[Dict[str, Any]], context: Dict[str, Any], db: Optional[Session] = None, rc: Optional[redis.Redis] = None): # Add rc
    logging.info("--- Rule Action: Adjust Health Triggered ---")
    if not db:
        logging.error("Adjust Health action failed: Database session unavailable.")
        return
    if not Group:
        logging.error("Adjust Health action failed: Group model not loaded.")
        return
    if not params or 'amount' not in params:
        logging.error("Adjust Health action failed: Missing 'amount' parameter.")
        return

    group_id = context.get('group_id')
    if not group_id:
        logging.error("Adjust Health action failed: Missing 'group_id' in context.")
        return

    try:
        amount = int(params['amount'])
    except (ValueError, TypeError):
        logging.error(f"Adjust Health action failed: Invalid 'amount' parameter: {params['amount']}")
        return

    try:
        group = db.get(Group, group_id)
        if not group:
            logging.error(f"Adjust Health action failed: Group '{group_id}' not found.")
            return

        current_health = group.health if group.health is not None else 50
        health_type = params.get('healthType', "dynamic")
        if health_type == "dynamic":
            new_health = max(0, min(100, current_health + amount))
        elif health_type == "static":
            new_health = max(0, min(100, amount))
        else: # Default to dynamic if unknown type
             new_health = max(0, min(100, current_health + amount))

        if new_health != group.health:
            group.health = new_health
            db.commit()
            logging.info(f"Adjusted health for group '{group_id}' by {amount}. New health: {new_health}.")
            update_health(group_id, new_health, rc)
        else:
            logging.info(f"Health for group '{group_id}' remains {current_health} (no change after adjustment by {amount}).")

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error adjusting health for group '{group_id}': {e}", exc_info=True)
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error adjusting health for group '{group_id}': {e}", exc_info=True)

def action_send_sse_tip(params: Optional[Dict[str, Any]], context: Dict[str, Any], db: Optional[Session] = None, rc: Optional[redis.Redis] = None): # Add rc
    logging.info("--- Rule Action: Send SSE Tip Triggered ---")
    if not SSE_AVAILABLE:
        logging.error("Send SSE Tip action failed: SSE module not available.")
        return

    message_template = params.get("message", "Rule {rule_id} triggered for group {group_id}") if params else "Rule triggered"
    try:
        message = message_template.format(**context)
    except KeyError as e:
        logging.warning(f"SSE Tip format fail key {e}. Template: '{message_template}'");
        message = f"Tip: Rule {context.get('rule_id','N/A')} triggered."

    logging.info(f"Sending SSE Tip: {message}")
    try:
        update_sse({"tips": [message]})
    except Exception as e:
        logging.error(f"Failed to send SSE tip: {e}", exc_info=True)

def action_add_tag(params: Optional[Dict[str, Any]], context: Dict[str, Any], db: Optional[Session] = None, rc: Optional[redis.Redis] = None): # Renamed from action_add_tip for clarity, added rc
    """Action: Adds a specified tag to the target group and re-evaluates rules."""
    logging.info("--- Rule Action: Add Tag Triggered ---")
    if not db:
        logging.error("Add Tag action failed: Database session unavailable.")
        return
    if not Group or not Tag:
        logging.error("Add Tag action failed: Group or Tag model not loaded.")
        return
    
    group_id = context.get('group_id')
    if not group_id:
        logging.error("Add Tag action failed: Missing 'group_id' in context.")
        return

    tag_to_add_id = params.get('tagId') if params else None
    if not tag_to_add_id:
        logging.error("Add Tag action failed: Missing 'tagId' in parameters.")
        return



    try:
        group = db.get(Group, group_id)
        if not group:
            logging.error(f"Add Tag action failed: Group '{group_id}' not found.")
            return

        tag_to_add = db.get(Tag, tag_to_add_id)
        if not tag_to_add:
            logging.error(f"Add Tag action failed: Tag with ID '{tag_to_add_id}' not found.")
            return

        if tag_to_add in group.tags:
            logging.info(f"Group '{group_id}' already has tag '{tag_to_add.name}' (ID: {tag_to_add_id}). No action taken.")
            return # No change, so no re-evaluation needed strictly for this action

        # Add the tag
        group.tags.append(tag_to_add)
        db.commit()
        logging.info(f"Successfully added tag '{tag_to_add.name}' (ID: {tag_to_add_id}) to group '{group_id}'.")

        # Re-evaluate rules for this group due to tag change
        # Perform local import to break circular dependency
        try:
            from app.engines.rules_engine.evaluator import check_and_trigger_rules_for_event
            
            logging.info(f"Re-evaluating rules for group '{group_id}' due to tag change (added tag ID: {tag_to_add_id}).")
            
            tag_change_trigger_context = {
                'group_id': group_id,
                'trigger_type': 'tag_change', # Important for evaluator logic
                'changed_tag_id': tag_to_add_id,
                'change_details': 'added'
            }
            # The evaluator's check_rule_initiators will use 'group_id' from context to fetch current tags
            # and 'trigger_type' to know how to match initiators.
            
            check_and_trigger_rules_for_event(
                db=db,
                rc=rc, # Pass the redis client
                group_id=group_id,
                trigger_type="tag_change",
                trigger_context=tag_change_trigger_context
            )
        except ImportError:
            logging.error("Failed to import 'check_and_trigger_rules_for_event' for tag change re-evaluation. Rule re-triggering skipped.")
        except Exception as e_reeval:
            logging.error(f"Error during rule re-evaluation after tag change for group '{group_id}': {e_reeval}", exc_info=True)

    except SQLAlchemyError as e_db:
        db.rollback()
        logging.error(f"Database error adding tag to group '{group_id}': {e_db}", exc_info=True)
    except Exception as e_main:
        db.rollback() # Ensure rollback on other unexpected errors before re-evaluation attempt
        logging.error(f"Unexpected error adding tag to group '{group_id}': {e_main}", exc_info=True)


# --- Action Dispatcher ---
ACTION_DISPATCHER = {
    "log_event": action_log_event,
    "send_notification": action_send_notification,
    "adjust_health": action_adjust_health,
    "send_sse_tip": action_send_sse_tip,
    "alert": action_send_notification,
    "email": action_send_notification, # Placeholder
    "tip": action_send_notification,   # Placeholder, could be SSE or specific tip system
    "sse": action_send_sse_tip,
    "health": action_adjust_health,
    "tag": action_add_tag, # Updated from None to action_add_tag
    "schedule": None, # Placeholder     #TODO: Next update
    "maintenance": None, # Placeholder  #TODO: Next update
    "inspection": None, # Placeholder   #TODO: Next update
    "progress": None, # Placeholder     #TODO: Next update
}

# Remove None entries if they will remain unimplemented, or add their functions.
ACTION_DISPATCHER = {k: v for k, v in ACTION_DISPATCHER.items() if v is not None}


def execute_action(action_data: ActionDict, context: Dict[str, Any], rc: Optional[redis.Redis] = None, db: Optional[Session] = None): # Add rc
    """Looks up and executes the appropriate action function, passing db and rc session."""
    action_type = action_data.get('action_type')
    action_params = action_data.get('action_params')
    rule_id = context.get('rule_id', 'N/A')
    rule_prio = context.get('rule_priority', 'N/A')

    backend_action_key = action_type 
    action_function = ACTION_DISPATCHER.get(backend_action_key)

    if action_function:
        logging.debug(f"Executing action '{backend_action_key}' Rule:{rule_id} (Prio:{rule_prio}) Params:{action_params}")
        try:
            # Pass db and rc session to the action function
            action_function(action_params, context, db=db, rc=rc) # Pass rc
        except Exception as e:
            logging.error(f"Error executing action '{backend_action_key}' (Rule:{rule_id}, Prio:{rule_prio}): {e}", exc_info=True)
    else:
        logging.warning(f"Unknown or unimplemented action type '{action_type}' (mapped to '{backend_action_key}') Rule:{rule_id} (Prio:{rule_prio})")