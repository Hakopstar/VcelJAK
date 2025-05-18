import os
import logging
import time
import psycopg

# Checking if database ready to receive connection
# Will stay the same
timeout = 10


def checking_connection():
    """
    Checking availability of PostgreSQL database via psycopg

    Args:
        POSTGRES_HOST (Enviroment_Variable): Postgres host IP
        POSTGRES_PORT (Enviroment_Variable): Postgres host Port
        timeout (int) - predefined

    Using:
        os, logging, time, psycopg

    Returns:
        Bool: Status if can connect to Postgres
    """
    logging.info("Checking connection to Postgres")
    logging.debug(
        f"POSTGRES HOST: {os.getenv('POSTGRES_HOST')}, POSTGRES PORT: {os.getenv('POSTGRES_PORT')}")
    logging.debug(f"timeout limit: {timeout}")
    for tries in range(timeout):
        logging.debug(f"Connecting: {tries+1}/{timeout}")
        try:
            # Connect to database
            conn = psycopg.connect(
                host=os.getenv('POSTGRES_HOST'),
                port=os.getenv('POSTGRES_PORT'),
                dbname='testing',
                user='connection_testing',
                password=os.getenv('POSTGRES_TEST_PASS'))
            # Close connection
            conn.close()
            return True
        except KeyboardInterrupt:
            logging.info("!KEYBOARD INTERRUPT!")
            logging.info("Stopping trying...")
            return False
        except Exception as error:
            # Connection failed message
            logging.debug(f"Connection Failed, trying {tries+1}/{timeout}")
            time.sleep(1)
            continue
    return False
