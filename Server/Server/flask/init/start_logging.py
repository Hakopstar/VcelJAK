#####################################
# init/start_logging.py
# Logging File
# Last version of update: v0.95

#####################################


import os
import logging
from datetime import datetime


def start_logging() -> bool:
    """
    Starts a logging proccess with set parameters from enviroment variables

    Args:  
        FLASK_DEBUG (Enviroment_Variable): used for managing the level of debugging messages

    Using:
        os, logging, tracemalloc, datetime, pyfiglet

    Returns:
        file: Creates a log file in folder logs, 
              file name is current time in format %Y_%m_%d_%H_%M_%s
              (logs/vceljaklog_2024_12_24_11_11_11.log)

        python_subproccess: create a background process,
                            that is writing all printed information.
    """
    logging_status = True

    try:
        # Terminal logging colors begin
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

        print("----- Starting logging -----")

        if not os.path.exists('logs'):
            os.mkdir('logs')

        log_time = datetime.now().strftime('vceljaklog_%Y_%m_%d_%H_%M_%s')
        # Formatting terminal output
        console_formatter = ColoredFormatter(
            '%(asctime)s - %(filename)s/%(funcName)s:%(name)s - %(levelname)s - %(message)s'
        )
        # Formatting log file output
        file_formatter = logging.Formatter(
            '%(asctime)s - %(filename)s/%(funcName)s:%(name)s - %(levelname)s - %(message)s'
        )
        # Set format
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(console_formatter)
        file_handler = logging.FileHandler(f'logs/{log_time}.log')
        file_handler.setFormatter(file_formatter)

        logger = logging.getLogger()

        # Get minimum logger level from enviroment variables. (.env file)
        # WARNING! - IN THE .ENV NEEDS TO BE INT, or the system fails
        # 0 - Not Set
        # 10 - DEBUG
        # 20 - INFO
        # 30 - WARNING
        # 40 - ERROR
        # 50 - CRITICAL 

        logger.setLevel(int(os.getenv('FLASK_DEBUG', 10)))
        logger.addHandler(stream_handler)
        logger.addHandler(file_handler)
        logging.info("----! Logging Started - Succesfully !----")
        
    except Exception as err:
        # Exception when something goes wrong with logging
        print("!!!-------- LOGGING FAILED --------!!!")
        print("Logging Parameters are wrongly set or logging module is corrupted!")
        print(f"Error: {err}")
        logging_status = False

    try:
        # Somewhat useless import, Used from old versions of this system, for legacy purposes i still keep it here.
        import pyfiglet as pyg

        logging.info(f"""
        {pyg.figlet_format(f"Starting Application! Version v{os.getenv('SYSTEM_VERSION')}", font = "digital")}""")
    except Exception as err:
        logging.warning(f"--- Piglet Error ---")

    return logging_status