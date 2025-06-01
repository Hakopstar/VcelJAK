#####################################
# init/__init__.py
# Init File
# Last version of update: v0.95

#####################################


def start():
    # Starting Text
    print("----------------------------------------------------")
    print("         Starting system - init file activated")
    print("----------------------------------------------------")
    try:
        print("")
        # Importing other modules from init folder
        import init.start_logging as slog
        import init.system_settings.start_config as sconfig

        import init.check_integrity.imports as cimports
        import init.check_integrity.database as cdb

        

        print("--- 1. Stage of init started ---")
        print("Starting logging")
        slog.start_logging()
        import logging

        logging.info("--- 2. Stage of init started ---")
        logging.info("Checking depencies")
        cimports.check_requirements()

        logging.info("--- 3. Stage of init started ---")
        logging.info("Checking databases")
        cdb.check_services()

        logging.info("--- 4. Stage of init started ---")
        logging.info("Checking integrity of server config and server settings")
        sconfig.config_options()


    except Exception as err:
        print("#######################################")
        print(f"CRITICAL: {err}")
        print("#######################################")
        raise Exception(err)




if __name__ == "__main__":
    print("FILE STARTED WRONGLY")
