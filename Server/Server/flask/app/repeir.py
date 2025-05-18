#####################################
# Repairing module
# Last version of update: v0.81

#####################################

version = 1.8


def start_logging() -> None:
    """
    Starts a logging proccess with set parameters from enviroment variables

    Args:  
        FLASK_DEBUG (Enviroment_Variable): used for managing the level of debugging messages

    Using:
        os, logging, tracemalloc, datetime, pyfiglet

    Returns:
        file: Creates a log file in folder logs, 
              file name is current time in format %H_%M_%d_%m_%Y
              (logs/flasklog_10_39_09_12_2023.log)

        python_subproccess: create a background process,
                            that is writing all printed information.
    """

    try:
        import os
        import logging
        import tracemalloc
        from datetime import datetime
        LOG_COLORS = {
            'DEBUG': '\033[36m',   # Cyan
            'INFO': '\033[1;34m',    # Green
            'WARNING': '\033[33m', # Yellow
            'ERROR': '\033[1m\033[31m',   # Red
            'CRITICAL': '\033[1m\033[31m' # Magenta
        }
        RESET = '\033[0m'
        class ColoredFormatter(logging.Formatter):
            def format(self, record):
                color = LOG_COLORS.get(record.levelname, RESET)
                message = super().format(record)
                return f"{color}{message}{RESET}"
        
        tracemalloc.start()

        print("...STARTING LOGGING...")

        if not os.path.exists('logs'):
            os.mkdir('logs')

        log_time = datetime.now().strftime('flasklog_%Y_%m_%d_%H_%M_%s')
        console_formatter = ColoredFormatter(
            '%(asctime)s - %(filename)s/%(funcName)s:%(name)s - %(levelname)s - %(message)s'
        )
        file_formatter = logging.Formatter(
            '%(asctime)s - %(filename)s/%(funcName)s:%(name)s - %(levelname)s - %(message)s'
        )
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(console_formatter)
        file_handler = logging.FileHandler(f'logs/{log_time}.log')
        file_handler.setFormatter(file_formatter)

        logger = logging.getLogger()
        logger.setLevel(int(os.getenv('FLASK_DEBUG', 10)))
        logger.addHandler(stream_handler)
        logger.addHandler(file_handler)
        logging.info("Logging Started - Succesfully")

    except Exception as err:
        print("Logging Parameters are wrongly set or logging module is corrupted!")
        print(err)
        print("WARNING: LOGGING FAILED")

    try:
        import pyfiglet as pyg

        logging.info(f"""
        {pyg.figlet_format(f"Starting Application! Version v{os.getenv('SYSTEM_VERSION')}", font = "digital")}""")
    except:
        logging.warning("Pyfiglet Failed")


def test_postgres() -> None:
    """
    Tests if postgres is active and can be connected

    Args:
        POSTGRES_HOST (Enviroment_Variable): Postgres host IP
        POSTGRES_PORT (Enviroment_Variable): Postgres host Port

    Using:
        os, logging
        pgsql_test: checking_connection()
        
    Returns:
        Status - returns nothing, if fail - raise Exception ("POSTGRES_TIMEOUT")
    """

    import os
    import logging
    from app.db_man.pqsql.test import checking_connection

    # Checking if postgres is present on network
    logging.info("APP INIT Started")
    if checking_connection():
        logging.info("Checking Postgres connection was succesfull")
    else:
        logging.critical("Postgres connection Timeout")
        logging.debug(
            "Possible fix, try starting flask in the docker enviroment with active postgres, Set the correct enviroment variables for postgres database.")
        logging.debug(
            f"POSTGRES HOST: {os.getenv('POSTGRES_HOST')}, POSTGRES PORT: {os.getenv('POSTGRES_PORT')}")
        raise Exception("POSTGRES_TIMEOUT")

def config_options():
    from app.db_man.memcache.mem_engine import mc
    import logging
    import os
    import psycopg
    import json

    logging.debug("Config Options Started")
    with open("app/default_config.json", "r") as file:
        config_data = json.load(file)
    logging.debug(config_data)

    # Ensure the "first_init" option is added/updated
    config_data.update({"first_init": {'value': "1"}})

    conn = None
    try:
        
        conn = psycopg.connect(
                host=os.getenv('POSTGRES_HOST'),
                port=os.getenv('POSTGRES_PORT'),
                dbname='clients_system',
                user='client_modifier',
                password=os.getenv('POSTGRES_USERS_ACCESS_PASS'))
        # Open a transaction block using the connection context
        with conn:
            with conn.cursor() as cur:
                for config_name, config_values in config_data.items():
                    logging.debug(f"config_name: {config_name}, config_value: {config_values}")
                    # Check if the configuration already exists
                    cur.execute(
                        "SELECT config_name FROM server_config WHERE config_name = %s", 
                        (config_name,)
                    )
                    existing_config = cur.fetchone()

                    if not existing_config:
                        if config_name == "first_init":
                            first_init()
                        logging.debug("Creating New Entry in PostgreSQL")
                        logging.debug(f"config values: {config_values}")
                        # Build the insert query dynamically.
                        columns = ["config_name"]
                        placeholders = ["%s"]
                        values = [config_name]

                        # The table columns (other than the primary key) you want to update.
                        for field in ["units", "lowest_acceptable", "highest_acceptable", "value", "accuracy"]:
                            if field in config_values:
                                columns.append(field)
                                placeholders.append("%s")
                                values.append(config_values[field])

                        query = f"INSERT INTO server_config ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
                        cur.execute(query, tuple(values))
            # Committing is handled automatically upon exiting the 'with conn:' block
        # After committing, refresh any cached config values
        mc.flush_all()
        for key, value in config_data.items():
            logging.debug(f"key: {key}")
            logging.debug(f"Value: {value}")
            mc.set(key, value, time=300)
    except Exception as err:
        logging.error(f"Adding to database failed: {err}")
        print("Adding to the database failed")
        if conn is not None:
            conn.rollback()
    finally:
        if conn is not None:
            conn.close()


def create_default_webpage_user():
    import bcrypt
    import os
    import psycopg
    import logging

    salt = bcrypt.gensalt()
    hashed_key = bcrypt.hashpw(os.getenv("WEBPAGE_PASS").encode('utf-8'), salt)
    try:
        logging.debug(f"User: {os.getenv('WEBPAGE_USER')} pass: {os.getenv('WEBPAGE_PASS')}")
        conn = psycopg.connect(
                host=os.getenv('POSTGRES_HOST'),
                port=os.getenv('POSTGRES_PORT'),
                dbname='clients_system',
                user='client_modifier',
                password=os.getenv('POSTGRES_USERS_ACCESS_PASS'))
        with conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO users (client_id, client_hash) VALUES (%s, %s)",
                (os.getenv("WEBPAGE_USER"), hashed_key.decode('utf-8')))
                conn.commit()
                        
        logging.debug("Webpage user added")
        return True
    except Exception as err:
        print(err)
        print("Error")
        return False


def first_init():
    create_default_webpage_user()





def checksum(file):
    import hashlib
    with open(file, "rb") as f:
        file_hash = hashlib.md5()
        while chunk := f.read(8192):
            file_hash.update(chunk)
    return file_hash.hexdigest()



def check_requirements(mode: str) -> None:
    """
    Check if all modules are installed

    Args:
        POSTGRES_HOST (Enviroment_Variable): Postgres host IP
        POSTGRES_PORT (Enviroment_Variable): Postgres host Port

    Using:
        os
        
    Returns:
        Status - returns nothing, if fail - raise Exception CORE_MODULES FAILED {core_fail}
    """

    core_requirements = ["os", "sys", "collections", "dateutil", "datetime", "json", "jsonschema", "time", "uuid", "flask",
                         "flask_limiter", "psycopg", "influxdb_client", "flask_httpauth", "logging", "hashlib", "pint", "bcrypt", "flask_limiter", "flask_cors"]
    additional_requirements = ["sqlalchemy, unittest", "pyfiglet", "psutil", "flask_admin", "flask_sqlalchemy"]

    core_fail_message = ["OS - Failed, Python Corruption Detected", "SYS - Failed, Python or system Corruption Detected", "Collections - Failed, Wrong Python Version", "Dateutil - Not Detected, install: pip install python-dateutil", "DateTime - Failed, Wrong Python Version", "Json - Failed, Wrong Python Version", "jsonschema - Not Detected, install: pip install jsonschema", "time - Failed, Wrong Python Version", "uuid - Failed, Wrong Python Version", "flask - Not detected, install: pip install flask",
                         "flask_limiter - Not detected, install: pip install flask-limiter", "psycopg3 - Not detected, install: pip install psycopg, psycopg-binary", "influxdb-client - Not detected, install: pip install influxdb-client", "flask_httpauth - Not detected, install: pip install flask_httpauth", "logging - Failed, wrong python version", "hashlib - Failed, wrong python version", "pint - Not detected, install: pip install pint", "bcrypt - Not detected, install: pip install bcrypt", "flask-limiter - Not detected, install: pip install flask-limiter", "flask-cors - Not deteected, install: pip install flask-cors"]
    additional_fail_message = ["SQLAlchemy - Warning, Not Detected", "Unittest - Warning, Not Detected",
                               "Pyfiglet - Warning, Not Detected", "Psutil - Warning, Not detected", "Flask_Admin - Warning, Not detected", "Flask_alchemy - Warning, Not detected"]
    print(f"""Checking presence of following:
    {core_requirements}""")
    core_fail = []
    core_modules = len(core_requirements)
    for count, core in enumerate(core_requirements):
        try:
            print(f"Importing: {core} ({count+1}/{core_modules})")
            exec(f"import {core}")
        except Exception:
            print(f"{core_fail_message[count]}")
            core_fail.append(core)

    if len(core_fail) != 0:
        print(f"""
!!!!!!!!!!!!!!CRTICIAL!!!!!!!!!!!!!!!!
!CORE_MODULES FAILED: 
{core_fail}
 Raising Exception
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!   
""")
        if mode == "module":
            raise Exception(f"CORE_MODULES FAILED {core_fail}")
        else:
            print("!Exception is not raised, because script was launched in main mode!")
            return core_fail
    else:
        print("All Core modules are present!")

    additional_fail = []
    additional_modules = len(additional_requirements)
    for count, requirement in enumerate(additional_requirements):
        try:
            print(f"Importing: {requirement} ({count+1}/{additional_modules})")
            exec(f"import {requirement}")
        except Exception:
            print(f"{additional_fail_message[count]}")
            additional_fail.append(requirement)
    if len(additional_fail) != 0:
        print(f"""
    !!!!!!!!!!!!!!WARNING!!!!!!!!!!!!!!!!
    !WARNING ADDITIONAL MODULES MISSING: 
    {additional_fail}
    
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!   
    """)



def test(mode: str) -> None:
    """
    Test, testing basic function and writing basic information (Interpreter, Current Directory)

    Args:
        mode (str): tells in what mode was called
            options: 
                module - called by module process
                main - called by main process

    Using:
        os
        
    Returns:
        Status - it doesn't return nothing, if fail - raise Exception ("CORRUPTED_SYSOS")
    """

    try:
        import os
        import sys
        import logging

        if mode == "module":
            logging.info(f"""
Starting diagnostics... Mode: {mode} Version: {version}, Modules: os,sys,logging detected
    Interpreter: {sys.executable}     
    Current Directory: {os.getcwd()}       
              """)
        else:
            print(f"""
Starting diagnostics... Mode: {mode} Version: {version}, Modules: os,sys,logging detected
    Interpreter: {sys.executable}     
    Current Directory: {os.getcwd()}       
              """)
    except:
        print("Basic Function Import failed!")
        raise Exception("CORRUPTED_SYSOS")


def module_diagnostics():
    """
    Runs diagnostics of all modules

    Args:
        None

    Using:
        os, logging
        
    Returns:
        Status - it doesn't return nothing, if fail - raise Exception ("DIAGNOSTICS_FAILED")
    """

    try:
        import logging

        test("module")
        status = check_requirements("module")
        logging.info(f"Check Requirements status: {status}")
    except Exception as err:
        logging.critical(f"ERROR: {err}")
        logging.critical("Diagnostics Failed! Shutting down")
        raise Exception("DIAGNOSTICS_FAILED")


def main():
    test("main")
    check_requirements("main")
    while True:
        print("""
type:
    1 - Check for file corruption
    2 - Check if requirements are present
    3 - Reset Enviroment Variables
    4 - Create New Enviroment Variables
    5 - Create User key
    6 - Get checksum of file
    7 - Checking for SQL Injection
    exit - exit repeir
                        """)

        input_code = input(">")
        match input_code:
            case '1':
                print("Check for file corruption checked!")
            case '2':
                print("Check if requirements are present")
            case '3':
                print("Reset Enviroment Variables")
            case '4':
                print("Create New Enviroment Variables")
            case '5':
                print("Create User key")
            case '6':
                print("Get checksum of file")
                input_file = input("write file:")
                print(checksum(input_file))
            case 'exit':
                print("Exit")
                exit()
            case _:
                print("Wrong input!")


if __name__ == "__main__":
    main()
