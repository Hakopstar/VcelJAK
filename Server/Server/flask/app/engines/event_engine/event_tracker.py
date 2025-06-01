####################################################
# Event Writing updating program
# Last version of update: v0.95
# app/engines/event_engine/event_tracker.py
####################################################

import logging
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, Optional, List, Set
from datetime import datetime, UTC
from sqlalchemy.exc import SQLAlchemyError

from app.helpers.formatters import _format_initiator, _format_action
from app.db_man.pqsql.models import GroupEvent

def summarize_rule(rule: dict) -> str:
    parts = []
    # Header
    parts.append(f"Rule activated: {rule['name']} (ID: {rule['id']})")
    parts.append(f"Priority: {rule.get('priority', '')}")

    return "\n".join(parts)

def write_event(db, trigger_context):
    # trigger_context
    #               group_id
    #               type
    #               time
    #               
    logging.info("Writing Event")
    group_id = trigger_context.get('group_id')
    if group_id is None: return

    type = trigger_context.get('type')
    time = trigger_context.get('time', datetime.now(UTC))
    
    if type == 'rule_executed':
        description = summarize_rule(trigger_context.get('rule_context'))
    
    try:
        new_event = GroupEvent(
            group_id=group_id,
            event_type=type,
            event_date=time,
            description=description
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        return new_event
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Failed to create new Groupevent err: {e}")