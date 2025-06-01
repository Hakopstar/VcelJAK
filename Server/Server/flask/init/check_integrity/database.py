#####################################
# init/check_integrity/database.py
# Import checking File
# Last version of update: v0.95

#####################################

import logging
import os
import time

import psycopg
from psycopg import DatabaseError
from influxdb_client import InfluxDBClient
from influxdb_client.client.exceptions import InfluxDBError
import redis
from redis.exceptions import ConnectionError as RedisConnectionError


def check_services():
    """
    Checks availability of PostgreSQL, InfluxDB, and Redis.

    """

    # PostgreSQL check
    try:
        if not postgres_checking_connection():
            raise Exception
    except:
        logging.critical("POSTGRES NOT CONNECTED, SHUTTING DOWN APPLICATION")
        raise Exception("PQSQL - NOT CONN")

    # InfluxDB check
    try:
        if not influxdb_checking_connection():
            raise Exception
    except:
        logging.critical("INFLUXDB NOT CONNECTED, SHUTTING DOWN APPLICATION")
        raise Exception("INFLUXDB - NOT CONN")

    # Redis check
    try:
        if not redis_checking_connection():
            raise Exception
    except:
        logging.critical("REDIS NOT CONNECTED, SHUTTING DOWN APPLICATION")
        raise Exception("REDIS - NOT CONN")


def postgres_checking_connection():
    """
    Checking availability of PostgreSQL database via psycopg

    Args:
        POSTGRES_HOST (Enviroment_Variable): Postgres host IP
        POSTGRES_PORT (Enviroment_Variable): Postgres host Port

    Using:
        os, logging, time, psycopg

    Returns:
        Bool: Status if can connect to Postgres
    """
    logging.info("Checking connection to Postgres")
    logging.debug(
        f"""    host={os.getenv('POSTGRES_HOST')},
                port={os.getenv('POSTGRES_PORT')},
                dbname='testing',
                user='connection_testing',
                password={os.getenv('POSTGRES_TEST_PASS')}""")
    
    logging.debug(f"timeout limit: {os.getenv('POSTGRES_TIMEOUT', 10)}")
    for tries in range(int(os.getenv('POSTGRES_TIMEOUT', 10))):
        logging.debug(f"Connecting: {tries+1}/{os.getenv('POSTGRES_TIMEOUT', 10)}")
        
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
            logging.debug(f"Connection Failed, trying {tries+1}/{os.getenv('POSTGRES_TIMEOUT', 10)}")
            time.sleep(1)
            continue
    return False


def influxdb_checking_connection():
    """
    Checking availability of Influxdb database via influx_db_client

    Args:
        INFLUXDB_URL (Enviroment_Variable): influxdb host IP
        INFLUXDB_PORT (Enviroment_Variable): influxdb host Port
        INFLUXDB_TOKEN (Enviroment_Variable): influxdb host token


    Using:
        os, logging, time, influxdb_client

    Returns:
        Bool: Status if can connect to influxdb
    """
    logging.info("Checking connection to influxdb")
    logging.debug(
        f"InfluxDB URL: {os.getenv('INFLUXDB_URL')}, INFLUXDB TOKEN: {os.getenv('DOCKER_INFLUXDB_INIT_ADMIN_TOKEN')}, org: {os.getenv('DOCKER_INFLUXDB_INIT_ORG')}")
    logging.debug(f"timeout limit: {os.getenv('INFLUXDB_TIMEOUT', 10)}")
    url   = os.getenv("INFLUXDB_URL")
    token = os.getenv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN")
    org   = os.getenv("DOCKER_INFLUXDB_INIT_ORG")
    for tries in range(int(os.getenv('INFLUXDB_TIMEOUT', 10))):
        logging.debug(f"Connecting: {tries+1}/{os.getenv('INFLUXDB_TIMEOUT', 10)}")
        try:
            # Connect to database
            with InfluxDBClient(url=url, token=token, org=org) as client:
                version = client.ping()
                logging.info(f"✅ Connected to InfluxDB, server version: {version}")
            return True
        except KeyboardInterrupt:
            logging.info("!KEYBOARD INTERRUPT!")
            logging.info("Stopping trying...")
            return False
        except Exception as error:
            # Connection failed message
            logging.debug(f"Connection Failed, trying {tries+1}/{os.getenv('INFLUXDB_TIMEOUT', 10)}")
            logging.info(f"Error: {error}")
            time.sleep(1)
            continue
    return False


def redis_checking_connection():
    """
    Checking availability of Redis database

    Args:
        REDIS_URL (Enviroment_Variable): redis host IP
        REDIS_PORT (Enviroment_Variable): redis host Port


    Using:
        os, logging, time, redis

    Returns:
        Bool: Status if can connect to redis
    """
    logging.info("Checking connection to redis")
    logging.debug(
        f"REDIS HOST: {os.getenv('REDIS_HOST')}, Port: {os.getenv('REDIS_PORT', 10)}")
    logging.debug(f"timeout limit: {os.getenv('REDIS_TIMEOUT', 10)}")
    for tries in range(int(os.getenv('REDIS_TIMEOUT', 10))):
        logging.debug(f"Connecting: {tries+1}/{os.getenv('REDIS_TIMEOUT', 10)}")
        try:
            r = redis.Redis(host=os.getenv('REDIS_HOST'), port=os.getenv('REDIS_PORT'), db=0)
            r.ping()
            return True
        except KeyboardInterrupt:
            logging.info("!KEYBOARD INTERRUPT!")
            logging.info("Stopping trying...")
            return False
        except Exception as error:
            # Connection failed message
            logging.debug(f"Connection Failed, trying {tries+1}/{os.getenv('REDIS_TIMEOUT', 10)}")
            logging.debug(f"error: {error}")
            time.sleep(1)
            continue
    return False

