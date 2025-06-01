#####################################
# init/first_init/tags_add
# Adding user from default config
# Last version of update: v0.95

#####################################

import os
import json
import psycopg
import logging


def import_configs(configs_path):
    """Loads tag configurations from JSON files."""
    try:
        with open(f"{configs_path}/tags/mode_tags.json", "r") as file:
            mode_tags = json.load(file)
        with open(f"{configs_path}/tags/purpose_tags.json", "r") as file:
            purpose_tags = json.load(file)
        with open(f"{configs_path}/tags/status_tags.json", "r") as file:
            status_tags = json.load(file)
        logging.info("Successfully loaded tag configuration files.")
        return mode_tags, purpose_tags, status_tags
    except FileNotFoundError as e:
        logging.error(f"Error loading configuration file: {e}")
        raise
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON from a configuration file: {e}")
        raise


# --- Function to Sync Tags from JSON ---
def sync_tags_from_json():
    """
    Reads tags from specified JSON files and adds/updates them in the 'tags' table.
    It checks if a tag with the same 'id' already exists in the database
    using the ON CONFLICT (id) DO NOTHING clause. If a tag id exists, it's skipped.
    """

    DB_NAME = os.getenv('POSTGRES_DB', "clients_system") # Added default for safety
    DB_USER = os.getenv('POSTGRES_USER', "client_modifier") # Added default
    DB_PASSWORD = os.getenv('POSTGRES_USERS_ACCESS_PASS')
    DB_HOST = os.getenv('POSTGRES_HOST', 'localhost')    # e.g., 'localhost', '127.0.0.1', or a hostname
    DB_PORT = os.getenv('POSTGRES_PORT', '5432')         # Default PostgreSQL port is 5432
    CONFIGS_PATH = os.getenv('configs_path')

    if not DB_PASSWORD:
        logging.error("POSTGRES_USERS_ACCESS_PASS environment variable not set.")
        return
    if not CONFIGS_PATH:
        logging.error("configs_path environment variable not set.")
        return

    CONN_STRING = f"dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD} host={DB_HOST} port={DB_PORT}"

    added_count = 0
    skipped_count = 0
    processed_count = 0

    try:
        mode_tags, purpose_tags, status_tags = import_configs(CONFIGS_PATH)
    except Exception as e:
        logging.error(f"Failed to import tag configurations: {e}")
        return # Stop execution if configs can't be loaded

    tags = mode_tags + purpose_tags + status_tags
    logging.info(f"Total tags to process from JSON files: {len(tags)}")

    try:
        # Connect to your PostgreSQL database
        with psycopg.connect(CONN_STRING) as conn:
            logging.info(f"Successfully connected to database '{DB_NAME}' on {DB_HOST}:{DB_PORT}.")
            # Open a cursor to perform database operations
            with conn.cursor() as cur:
                for tag_data in tags: 
                    processed_count += 1
                    
                    tag_id = tag_data.get('id')
                    name = tag_data.get('name')
                    tag_type = tag_data.get('type')
                    description = tag_data.get('description')

                    # Validate essential data
                    if not tag_id:
                        logging.warning(f"Skipping entry {processed_count}: Missing 'id' field. Data: {tag_data}")
                        skipped_count += 1
                        continue
                    if not name:
                        logging.warning(f"Skipping entry {processed_count} (ID: {tag_id}): Missing 'name' field. Data: {tag_data}")
                        skipped_count += 1
                        continue
                    if not tag_type:
                        logging.warning(f"Skipping entry {processed_count} (ID: {tag_id}): Missing 'type' field. Data: {tag_data}")
                        skipped_count += 1
                        continue

                 
                    if description == "":
                        description = None

                    sql = """
                        INSERT INTO tags (id, name, type, description)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING;
                    """
                    # Use tag_id from JSON as the first value
                    values = (tag_id, name, tag_type, description)

                    try:
                        cur.execute(sql, values)

                        if cur.rowcount > 0:
                            logging.info(f"Added tag (ID: '{tag_id}', Name: '{name}', Type: '{tag_type}') - Entry {processed_count}")
                            added_count += 1
                        else:
                            logging.info(f"Skipped tag (ID: '{tag_id}', Name: '{name}') - Entry {processed_count}: ID already exists.")
                            skipped_count += 1

                    except psycopg.Error as e:
                        logging.error(f"Database error processing tag ID '{tag_id}', Name '{name}' (Entry {processed_count}): {e}")
                        # conn.rollback() # Not strictly needed here as psycopg3 manages transactions per 'with conn:' block implicitly
                                         # unless you want finer-grained control within the loop.
                                         # If one insert fails, others can still proceed.
                        skipped_count += 1
                        # Optionally, re-raise if you want to stop the whole process on a single DB error
                        # raise


                # --- Commit Transaction ---
                # If we reached here without critical errors, commit all successful inserts/skips
                conn.commit() # This commit happens when the 'with conn:' block exits successfully
                logging.info("\n--- Sync Summary ---")
                logging.info(f"Total tags processed from JSON: {len(tags)}")
                logging.info(f"Tags successfully added: {added_count}")
                logging.info(f"Tags skipped (already existed or had errors): {skipped_count}")

    except psycopg.OperationalError as e: # More specific for connection issues
        logging.error(f"Database connection error: {e}")
        logging.error(f"Connection string used: dbname={DB_NAME} user={DB_USER} host={DB_HOST} port={DB_PORT} (password is hidden)")
    except psycopg.Error as e: # Catch other psycopg errors
        logging.error(f"A psycopg database error occurred during sync: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred during sync process: {e}", exc_info=True)
