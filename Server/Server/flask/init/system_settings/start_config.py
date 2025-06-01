#####################################
# init/first_init/start_config
# Config start config, 
# Last version of update: v0.95

#####################################


import logging
import os
import json
import psycopg
from psycopg import OperationalError

import init.system_settings.first_init.user_add as user_add
import init.system_settings.first_init.tags_add as tags_add

import redis
from redis.exceptions import RedisError

# Redis client (configured at import time)
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

def config_options():
    """
    Reads default_config.json, updates/inserts into PostgreSQL,
    then flushes and caches each config in Redis with a 5-minute TTL.
    - Short description
    """
    logging.debug("--- Config Options Started ---")

    # Load JSON configuration
    try:
        
        with open("configs/default_config.json", "r") as file:
            config_data = json.load(file)
        logging.debug(f"Loaded config: {config_data}")
        os.environ['configs_path'] = "configs/"
    except (OSError, json.JSONDecodeError) as e:
        logging.error(f"Failed reading JSON config in docker instance, reading JSON config in testing instance")
        try: 
            with open("../configs/default_config.json", "r") as file:
                config_data = json.load(file)
            logging.debug(f"Loaded config: {config_data}")
            os.environ['configs_path'] = "../configs/"
        except (OSError, json.JSONDecodeError) as e:
            logging.error(f"Failed reading JSON config: {e}")
            return

    # Ensure the 'first_init' flag is present
    config_data.setdefault("first_init", {'value': "1"})

    conn = None
    try:
        # Connect to PostgreSQL
        conn = psycopg.connect(
            host=os.getenv('POSTGRES_HOST'),
            port=os.getenv('POSTGRES_PORT'),
            dbname='clients_system',
            user='client_modifier',
            password=os.getenv('POSTGRES_USERS_ACCESS_PASS')
        )
        with conn:
            with conn.cursor() as cur:
                # Insert or update each configuration entry
                for name, values in config_data.items():
                    logging.debug(f"Processing config '{name}': {values}")
                    cur.execute(
                        "SELECT 1 FROM server_config WHERE config_name = %s",
                        (name,)
                    )
                    if not cur.fetchone():
                        if name == "first_init":
                            logging.info("FIRST INIT INTIATED")
                            # first init actually intialized - if the postgres was deleted, rebuild the user from default config
                            user_add.create_default_webpage_user()
                            tags_add.sync_tags_from_json()
                        # Build INSERT dynamically
                        cols = ["config_name"]
                        vals = [name]
                        placeholders = ["%s"]
                        for field in ("units", "lowest_acceptable",
                                      "highest_acceptable", "value", "accuracy"):
                            if field in values:
                                cols.append(field)
                                placeholders.append("%s")
                                vals.append(values[field])
                        sql = (
                            f"INSERT INTO server_config ({', '.join(cols)}) "
                            f"VALUES ({', '.join(placeholders)})"
                        )
                        cur.execute(sql, tuple(vals))

        # Flush Redis and cache new values (If flask fails, or is rebuild)
        try:
            r.flushall()
            logging.debug("Redis flushall succeeded")
        except RedisError as e:
            logging.error(f"Redis flushall failed: {e}")

        for key, value in config_data.items():
            try:
                # Store JSON-stringified value with 5-minute expiry
                r.set(key, json.dumps(value), ex=300)
                logging.debug(f"Cached '{key}' in Redis")
            except RedisError as e:
                logging.error(f"Failed to set Redis key '{key}': {e}")

    except OperationalError as db_err:
        logging.error(f"PostgreSQL operation failed: {db_err}")
        if conn:
            conn.rollback()
    except Exception as err:
        logging.error(f"Unexpected error in config_options: {err}", exc_info=True)
    finally:
        if conn:
            conn.close()