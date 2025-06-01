      
####################################################
# Database engine
# Last version of update: v0.95
# app/db_man/pqsql/database.py
####################################################

import os
import logging # Use logging instead of print for better practice
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv
import logging

# Assuming models.py is in a 'pqsql' subdirectory relative to this file
# Adjust the import path if your structure is different
try:
    from app.db_man.pqsql.models import Base
except ImportError:
    logging.error("Could not import Base from pqsql.models. Ensure models.py exists and the path is correct.")
    raise

# Load environment variables
load_dotenv()

#TODO there was an database_url now is maybe redudant
# --- Database Engine ---
try:
    # pool_pre_ping is good practice
    engine = create_engine(
            f"postgresql+psycopg://client_modifier:{os.getenv('POSTGRES_USERS_ACCESS_PASS')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/clients_system",
            pool_pre_ping=True,
            echo=False,
            future=True,
            isolation_level="READ COMMITTED"
        ) # echo=False for production
    logging.info(f"Database engine created for URL: {engine.url.render_as_string(hide_password=True)}") # Hide password in logs

    # --- Session Factory ---
    # This factory creates *independent* sessions when called
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logging.info("SQLAlchemy SessionLocal factory configured.")

except Exception as e:
    logging.error(f"Error creating database engine or session factory: {e}", exc_info=True)
    logging.error("Please check your DATABASE_URL, database server status, and credentials.")
    exit(1) # Exit if we can't create the engine/session factory


# This function is for future usage, actually not used

def create_db_and_tables(db_engine=engine): # Accept engine argument
    """Creates database tables defined in models.py if they don't exist."""
    logging.info("Attempting to create database tables...")
    try:
        # Test connection before creating tables
        with db_engine.connect() as connection:
            logging.info("Database connection successful.")
        # Create tables using the Base metadata
        Base.metadata.create_all(bind=db_engine)
        logging.info("Database tables checked/created successfully.")
    except OperationalError as oe:
        logging.error(f"Database connection error during table creation: {oe}", exc_info=True)
        logging.error("Ensure the database server is running and accessible.")
        logging.error("Also check username/password and database name in DATABASE_URL.")
        # Decide if failure here should stop the application
    except Exception as e:
        logging.error(f"An unexpected error occurred during table creation: {e}", exc_info=True)
        # Decide if failure here should stop the application


    