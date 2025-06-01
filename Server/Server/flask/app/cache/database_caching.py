########################################################
# cache/database_caching.py database caching system
# Last version of update: v0.95
# 
########################################################


import logging
import json
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import SQLAlchemyError
import redis 
from typing import Dict, Any, Optional, List, TypedDict, Set

try:
    from app.db_man.pqsql.models import ( Rule, RuleInitiator, RuleAction, Group, RuleSet,
                                          Config as HubConfig, ServerConfig )
except ImportError:
    # Fallback if models.py is in a different relative location
    logging.warning("Could not import models from app.db_man.pqsql, falling back to top-level import.")
    from models import ( Rule, RuleInitiator, RuleAction, Group, RuleSet,
                         Config as HubConfig, ServerConfig )


# Cache TTLs
# TODO: ADD THIS TO ENVIROMENT VARIABLES
CACHE_TTL_SECONDS = 3600 # Cache Hub/Server configs for 1 hour
RULES_CACHE_TTL_SECONDS = 600 # Cache group rules for 10 min


# --- Hub/Client Configuration Loading ---

def get_hub_config_cached(db: Session, rc: Optional[redis.Redis], client_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches HubConfig (models.Config) from Redis cache or DB.
    Returns a dictionary of the hub's unit configurations.
    """
    if not client_id:
        logging.error("Cannot fetch HubConfig: client_id is missing.")
        return None

    cache_key = f"config:hub:{client_id}"

    # 1. Try Cache
    if rc:
        try:
            cached_config_str = rc.get(cache_key)
            if cached_config_str:
                logging.debug(f"Cache HIT for HubConfig: {client_id}")
                if cached_config_str == 'null': return None # Handle cached 'not found'
                return json.loads(cached_config_str)
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis GET error for HubConfig {client_id}: {e}. Falling back.")
        except json.JSONDecodeError as e:
             logging.error(f"Redis cache corrupt HubConfig {client_id}: {e}. Falling back.")

    # 2. Fetch from Database
    logging.debug(f"Cache MISS for HubConfig: {client_id}. Fetching DB.")
    try:
        hub_config = db.get(HubConfig, client_id) # Use primary key lookup
    except SQLAlchemyError as e:
        logging.error(f"DB error fetching HubConfig {client_id}: {e}", exc_info=True)
        return None
    except Exception as e:
         logging.error(f"Unexpected error fetching HubConfig {client_id}: {e}", exc_info=True)
         return None

    # 3. Process and Cache
    if hub_config:
        # Explicitly map model attributes to dictionary keys
        config_dict = {
            'system_time_unit': hub_config.system_time_unit,
            'temperature_unit': hub_config.temperature_unit,
            'pressure_unit': hub_config.pressure_unit,
            'voltage_unit': hub_config.voltage_unit,
            'power_unit': hub_config.power_unit,
            'speed_unit': hub_config.speed_unit,
            'weight_unit': hub_config.weight_unit,
            'sound_pressure_level_unit': hub_config.sound_pressure_level_unit,
            'network_strength_unit': hub_config.network_strength_unit, # Uses Python attribute name
            'memory_unit': hub_config.memory_unit,
            # Do not include client_id here unless explicitly needed downstream
        }
        if rc:
            try:
                rc.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(config_dict))
                logging.debug(f"Populated Redis cache HubConfig: {client_id}")
            except redis.exceptions.RedisError as e:
                logging.error(f"Redis SETEX error HubConfig {client_id}: {e}")
        return config_dict
    else:
        logging.warning(f"HubConfig not found in DB: {client_id}")
        # Cache 'not found' state
        if rc:
             try: rc.setex(cache_key, CACHE_TTL_SECONDS // 10, json.dumps(None)) # Shorter TTL
             except redis.exceptions.RedisError as e: logging.error(f"Redis SETEX error HubConfig 'not found' {client_id}: {e}")
        return None

# --- Server Configuration Loading ---

def get_server_config_cached(db: Session, rc: Optional[redis.Redis]) -> Dict[str, Dict[str, Any]]:
    """
    Fetches all ServerConfig entries from Redis cache or DB.
    Returns a dictionary keyed by config_name (measurement type),
    containing 'units', limits, 'accuracy', etc.
    """
    cache_key = "config:server:all"
    server_config_map: Dict[str, Dict[str, Any]] = {}

    # 1. Try Cache
    if rc:
        try:
            cached_config_str = rc.get(cache_key)
            if cached_config_str:
                logging.debug("Cache HIT for ServerConfig")
                return json.loads(cached_config_str)
        except redis.exceptions.RedisError as e: logging.error(f"Redis GET error ServerConfig: {e}. Falling back.")
        except json.JSONDecodeError as e: logging.error(f"Redis cache corrupt ServerConfig: {e}. Falling back.")

    # 2. Fetch from Database
    logging.debug("Cache MISS for ServerConfig. Fetching DB.")
    try:
        server_configs = db.query(ServerConfig).all()
        for sc in server_configs:
            server_config_map[sc.config_name] = {
                'units': sc.units,
                'lowest_acceptable': sc.lowest_acceptable,
                'highest_acceptable': sc.highest_acceptable,
                'accuracy': sc.accuracy,
                'value': sc.value # Include other fields if needed
            }
        logging.debug(f"Fetched {len(server_config_map)} server config entries from DB.")
    except SQLAlchemyError as e:
        logging.error(f"Failed query ServerConfig from DB: {e}", exc_info=True)
        return {} # Return empty on DB error
    except Exception as e:
         logging.error(f"Unexpected error fetching ServerConfig: {e}", exc_info=True)
         return {}

    # 3. Populate Cache
    if rc: # Cache even if map is empty
        try:
            # Use default=str for safety, though these fields are mostly text
            rc.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(server_config_map, default=str))
            logging.debug(f"Populated Redis cache ServerConfig ({len(server_config_map)} entries)")
        except redis.exceptions.RedisError as e: logging.error(f"Redis SETEX error ServerConfig: {e}")
        except TypeError as e: logging.error(f"Failed serialize server config cache: {e}")

    return server_config_map

# --- Rule Loading ---

def get_rules_for_group_cached(db: Session, rc: Optional[redis.Redis], group_id: str) -> Dict:
    """
    Fetches active Rules applicable to a specific Group (directly or via RuleSets).
    Loads related Initiators and Actions eagerly. Caches the result per group_id.
    Returns a list of RuleDicts, sorted by priority (accesending 0 to 10).
    higher number latter execution
    """
    if not group_id:
        logging.warning("Attempted to get rules for empty group_id.")
        return []

    cache_key = f"rules:group:{group_id}"
    group_rules_list = []

    # 1. Try Cache
    if rc:
        try:
            cached_data = rc.get(cache_key)
            if cached_data:
                logging.debug(f"Cache HIT for group rules ({cache_key})")
                loaded_list = json.loads(cached_data)
                # Perform basic validation on cached structure if needed
                if isinstance(loaded_list, list):
                    return loaded_list # Return cached (already sorted) list
                else:
                    logging.error(f"Cached group rule data invalid format for {group_id}. Refetching.")
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis GET error rules '{cache_key}': {e}. Falling back.")
        except json.JSONDecodeError as e:
            logging.error(f"Redis cache corrupt rules '{cache_key}': {e}. Falling back.")

    # 2. Fetch from Database
    logging.debug(f"Cache MISS for group rules ({cache_key}). Fetching DB.")
    try:
        # Use selectinload for efficient loading of related collections (many-to-many, one-to-many)
        # Use joinedload for many-to-one or one-to-one relationships if needed elsewhere
        group = db.query(Group).options(
            selectinload(Group.rules).options(  # Rules directly linked to group
                joinedload(Rule.initiators).options(
                    selectinload(RuleInitiator.tags)  # Load tags for initiators of direct rules
                ),
                joinedload(Rule.actions)      # Load actions for direct rules
            ),
            selectinload(Group.rule_sets).options(  # RuleSets linked to group
                selectinload(RuleSet.rules).options(  # Rules within those RuleSets
                    joinedload(Rule.initiators).options(
                        selectinload(RuleInitiator.tags)  # Load tags for initiators of ruleset rules
                    ),
                    joinedload(Rule.actions)      # Load actions for ruleset rules
                )
            )
        ).filter(Group.id == group_id).first()
        if not group:
            logging.warning(f"Cannot fetch rules: Group '{group_id}' not found.")
            # Cache empty list to prevent re-querying non-existent group quickly
            if rc:
                try: rc.setex(cache_key, RULES_CACHE_TTL_SECONDS // 5, json.dumps([]))
                except redis.exceptions.RedisError as e: logging.error(f"Redis SETEX error rules (empty) '{cache_key}': {e}")
            return []

        logging.debug(f"Got builded group: {group}")
        # Consolidate unique, active rules using a Set to handle overlaps
        active_rules_orm: Set[Rule] = set()
        # Add directly associated active rules
        for rule in group.rules:
            if rule.is_active:
                logging.debug(f"Got Rule: {rule}")
                active_rules_orm.add(rule)
        # Add active rules from associated active rulesets
        for ruleset in group.rule_sets:
            # Optional: Check if ruleset itself is active if model supports it
            # if ruleset.is_active:
            for rule in ruleset.rules:
                if rule.is_active:
                    active_rules_orm.add(rule)

        # Convert the unique set of ORM rules to dictionaries
        temp_list = []
        for rule in active_rules_orm:
            # Convert initiators
            initiators = [
                {'initiator_table_id': i.initiator_table_id,
                 'initiator_ref_id': i.initiator_ref_id,
                 'type': i.type,
                 'operator': i.operator,
                 'value': str(i.value) if i.value is not None else None, # Convert Decimal to string
                 'value2': str(i.value2) if i.value2 is not None else None, # Convert Decimal to string
                 'schedule_type': i.schedule_type, # Include schedule details
                 'schedule_value': i.schedule_value,
                 'tags': set((tag.id for tag in i.tags))
                 } for i in rule.initiators
            ]
            # Convert actions, ensuring sorted order
            actions = sorted([
                {'action_id': a.action_id,
                 'action_type': a.action_type,
                 'action_params': a.action_params, # Assumes JSONB loads as dict
                 'execution_order': a.execution_order}
                for a in rule.actions
                ], key=lambda x: x['execution_order']) # Sort by execution order

            # Build the final RuleDict for this rule
            temp_list.append({
                'id': rule.id,
                'name': rule.name,
                'logical_operator': rule.logical_operator,
                'priority': rule.priority, # Include priority field
                'initiators': initiators,
                'actions': actions
            })

        # Sort the final list of rule dictionaries by priority (higher number = higher priority)
        group_rules_list = sorted(temp_list, key=lambda x: x['priority'], reverse=False)
        logging.debug(f"Fetched and sorted {len(group_rules_list)} active rules for group {group_id}.")

    except SQLAlchemyError as e:
        logging.error(f"DB Error querying Rules/Actions for group '{group_id}': {e}", exc_info=True)
        return [] # Return empty on DB error
    except Exception as e:
         logging.error(f"Unexpected error fetching rules for group '{group_id}': {e}", exc_info=True)
         return []


    # 3. Populate Cache
    if rc: # Cache the result (even if empty)
        try:
            rc.setex(cache_key, RULES_CACHE_TTL_SECONDS, json.dumps(group_rules_list, default=str))
            logging.debug(f"Populated Redis cache for group rules ({cache_key}) with {len(group_rules_list)} rules.")
        except redis.exceptions.RedisError as e:
            logging.error(f"Redis SETEX error group rules '{cache_key}': {e}")
        except TypeError as e:
             logging.error(f"Failed serialize group rules cache '{cache_key}': {e}")

    return group_rules_list


def invalidate_hub_config_cache(rc: Optional[redis.Redis], client_id: str):
    """Clears the cache for a specific hub's configuration."""
    if not rc or not client_id:
        return
    cache_key = f"config:hub:{client_id}"
    try:
        deleted_count = rc.delete(cache_key)
        if deleted_count > 0:
             logging.info(f"Invalidated hub config cache for: {client_id}")
    except redis.exceptions.RedisError as e:
        logging.error(f"Redis DELETE error invalidating hub config cache {client_id}: {e}")

def invalidate_server_config_cache(rc: Optional[redis.Redis]):
    """Clears the cache for the global server configuration."""
    if not rc:
        return
    cache_key = "config:server:all"
    try:
        deleted_count = rc.delete(cache_key)
        if deleted_count > 0:
             logging.info(f"Invalidated server config cache ({cache_key})")
    except redis.exceptions.RedisError as e:
        logging.error(f"Redis DELETE error invalidating server config cache {cache_key}: {e}")

def invalidate_group_rules_cache(rc: Optional[redis.Redis], group_id: str):
    """Clears the rule cache for a specific group."""
    if not rc or not group_id:
        return
    cache_key = f"rules:group:{group_id}"
    try:
        deleted_count = rc.delete(cache_key)
        if deleted_count > 0:
             logging.info(f"Invalidated rule cache for group: {group_id}")
    except redis.exceptions.RedisError as e:
        logging.error(f"Redis DELETE error invalidating group rule cache {group_id}: {e}")
