#####################################
# init/check_integrity/imports.py
# Import checking File
# Last version of update: v0.95

#####################################

# I KNOW - this is dumb but i wanna add custom error mesages in the future
# TODO: ADD CUSTOM ERROR MESSAGES
python_critical_packages = [
        {
            "package": "os",
            "error_message": "os - unknown error, Python Corruption Detected"
        },
        {
            "package": "sys",
            "error_message": "sys - Failed, Python or system Corruption Detected"
        },
        {
            "package": "collections",
            "error_message": "collections - Failed, Wrong Python Version"
        },
        {
            "package": "datetime",
            "error_message": "dateTime - Failed, Wrong Python Version", 
        },
        {
            "package": "json",
            "error_message": "json - Failed, Wrong Python Version", 
        },
        {
            "package": "logging",
            "error_message": "logging - Failed, Wrong Python Version", 
        },
        {
            "package": "time",
            "error_message": "time - Failed, Wrong Python Version", 
        },
        {
            "package": "uuid",
            "error_message": "uuid - Failed, Wrong Python Version", 
        },
        {
            "package": "atexit",
            "error_message": "atexit - Failed, Wrong Python Version", 
        }
]

external_critical_requirements = [
        {
            "package": "dateutil",
            "error_message": "dateutil - Not Detected, install: pip install python-dateutil"
        },
        {
            "package": "jsonschema",
            "error_message": "jsonschema - Not Detected, install: pip install jsonschema",
        },
        {
            "package": "bcrypt",
            "error_message": "bcrypt - Not detected, install: pip install bcrypt",
        },
        {
            "package": "pint",
            "error_message": "pint - Not detected, install: pip install pint",
        },
        {
            "package": "hashlib",
            "error_message": "hashlib - Not detected, install: pip install hashlib",
        }, 
        {
            "package": "gevent",
            "error_message": "gevent - Not detected, install: pip install gevent",
        }, 
        {
            "package": "humanize",
            "error_message": "humanize - Not detected, install: pip install humanize",
        },             
        {
            "package": "flask",
            "error_message": "flask - Server, Not detected, install: pip install flask",
        },
        {
            "package": "flask_limiter",
            "error_message": "flask_limiter - Flask extension, Not detected, install: pip install flask_limiter",
        },
        {
            "package": "flask_httpauth",
            "error_message": "flask_httpauth - Flask extension, Not detected, install: pip install flask_httpauth",
        },
        {
            "package": "flask_cors",
            "error_message": "flask_cors - Flask extension, Not detected, install: pip install flask_cors",
        },
        {
            "package": "flask_jwt_extended",
            "error_message": "flask_jwt_extended - Flask extension, Not detected, install: pip install flask_jwt_extended",
        },
        {
            "package": "flask_sqlalchemy",
            "error_message": "flask_sqlalchemy - Flask extension, Not detected, install: pip install flask_sqlalchemy",
        },
        {
            "package": "sqlalchemy",
            "error_message": "sqlalchemy - ORM, Not detected, install: pip install sqlalchemy",
        },
        {
            "package": "psycopg",
            "error_message": "psycopg3 - database, Not detected, install: pip install psycopg, pip install psycopg-binary",
        },
        {
            "package": "influxdb_client",
            "error_message": "influxdb_client - database, Not detected, install: pip install influxdb-client",
        },
        {
            "package": "redis",
            "error_message": "redis - database, Not detected, install: pip install redis",
        }]


not_critical_requirements = [
        {
            "package": "pyfiglet",
            "error_message": "Pyfiglet - Warning, Not Detected",
        },
        {
            "package": "psutil",
            "error_message": "psutil - Warning, Not Detected",
        },
        {
            "package": "flask_admin",
            "error_message": "flask_admin - Warning, Not Detected",
        }]





def check_requirements() -> None:
    """
    Check if all modules are installed

    Args:
        POSTGRES_HOST (Enviroment_Variable): Postgres host IP
        POSTGRES_PORT (Enviroment_Variable): Postgres host Port

    Using:
        os, logging
        
    Returns:
        Status - returns nothing, if fail - raise Exception CORE_MODULES FAILED {core_fail}
    """

    import logging

    logging.info("---- Checking requirement ----")
    logging.info("Applying monkey patches: ")
    try:
        from gevent import monkey
        monkey.patch_all()
    except Exception as err:
        logging.critical(f"MONKEY PATCHING FAILED: {err}")
        raise Exception(f"Monkey patch failed: {err}")

    logging.info("Checking python imports: ")
    python_import_core_fail = []
    core_modules = len(python_critical_packages)
    for count, python_package in enumerate(python_critical_packages):
        try:
            logging.info(f"Importing: {python_package.get('package')} ({count+1}/{core_modules})")
            # Should be fine... (last words spoken before disaster)
            exec(f"import {python_package.get('package')}")
        except Exception as err:
            logging.info(f"{python_package.get('error_message', f'Package - error {err}')}")
            python_import_core_fail.append(python_package.get('package'))

    if python_import_core_fail != []:
        logging.critical(f"""
!!!!!!!!!!!!!!CRTICIAL!!!!!!!!!!!!!!!!
!CORE_MODULES FAILED: 
{python_import_core_fail}
 Raising Exception
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!   
""")
        raise Exception(f"CORE_MODULES FAILED {python_import_core_fail}")
    else:
        logging.info("Python imports succesfully checked!")


    logging.info("Checking external imports: ")
    external_import_core_fail = []
    external_core_modules = len(external_critical_requirements)
    for count, external_package in enumerate(external_critical_requirements):
        try:
            logging.info(f"Importing: {external_package.get('package')} ({count+1}/{external_core_modules})")
            # Again should be fine... (last words spoken before disaster)
            exec(f"import {external_package.get('package')}")
        except Exception as err:
            logging.info(f"{external_package.get('error_message', f'Package - error {err}')}")
            external_import_core_fail.append(external_package.get('package'))

    if external_import_core_fail != []:
        logging.critical(f"""
!!!!!!!!!!!!!!CRTICIAL!!!!!!!!!!!!!!!!
!EXTERNAL IMPORTS FAILED: 
{external_import_core_fail}
 Raising Exception
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!   
""")
        raise Exception(f"EXTERNAL_CORE_MODULES FAILED {external_import_core_fail}")
    else:
        logging.info("External imports succesfully checked!")
    
    logging.info("Checking additional packages")
    additional_fail = []
    additional_modules = len(not_critical_requirements)
    for count, additional_package in enumerate(not_critical_requirements):
        try:
            logging.info(f"Importing: {additional_package.get('package')} ({count+1}/{additional_modules})")
            exec(f"import {additional_package.get('package')}")
        except Exception as err:
            logging.info(f"{additional_package.get('error_message', f'Package - error {err}')}")
            additional_fail.append(additional_package.get('package'))

    if additional_fail != []:
        logging.warning(f"Warning, Additional Modules: {external_import_core_fail}")
        logging.info("Failed to import")
    else:
        logging.info("All additionals imports succesfully checked!")

    logging.info("""
    -----------------------------------------------------
    # All imports succesfully checked!      
    # - Starting other init files
    -----------------------------------------------------      
""")

    
