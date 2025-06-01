import logging
import os
from datetime import datetime, timezone # Ensure timezone is imported

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import redis

# Import your application's modules
from app.engines.rules_engine.evaluator import check_and_trigger_rules_for_event
# Assuming Schedule model is here
from app.db_man.pqsql.models import Group, Schedule
# Assuming your check_and_update_schedule_progress function is in this path
# You might need to adjust this import based on your project structure
from app.engines.rules_engine.schedule_evaluator import check_and_update_schedule_progress

# --- Configuration ---
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg://client_modifier:{os.getenv('POSTGRES_USERS_ACCESS_PASS')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/clients_system"
REDIS_URL = os.environ.get('REDIS_URL_FOR_APP', 'redis://redis:6379/0')

# --- Celery Application Setup ---
# Ensure the tasks module is correctly specified if it's not tasks.py directly under background_worker
celery_app = Celery('tasks', # This name 'tasks' should match how you refer to the app instance, e.g., app.background_worker.tasks.celery_app
                    broker=CELERY_BROKER_URL,
                    backend=CELERY_RESULT_BACKEND,
                    include=['app.background_worker.tasks']) # Explicitly include the module where tasks are defined

celery_app.autodiscover_tasks(packages=['app.background_worker'], related_name='tasks')


# --- Database Setup for Celery Worker ---
engine = None
SessionLocal = None

def get_engine():
    global engine
    if engine is None:
        if not isinstance(SQLALCHEMY_DATABASE_URL, str):
            logging.error(f"SQLALCHEMY_DATABASE_URL is not a string: {SQLALCHEMY_DATABASE_URL} (type: {type(SQLALCHEMY_DATABASE_URL)})")
            raise ValueError("SQLALCHEMY_DATABASE_URL misconfigured")
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
    return engine

def get_db_session():
    global SessionLocal
    if SessionLocal is None:
        eng = get_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=eng)
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Redis Client for Application Logic (rc) ---
def get_redis_client_for_app():
    return redis.Redis.from_url(REDIS_URL)

# --- Celery Tasks ---

@celery_app.task(name='app.background_worker.tasks.run_scheduled_rule_check_for_group')
def run_scheduled_rule_check_for_group(group_id: str):
    logging.info(f"Running scheduled rule check for group_id: {group_id}")
    
    db_session_generator = get_db_session()
    db = next(db_session_generator)
    rc = get_redis_client_for_app()

    try:
        check_and_trigger_rules_for_event(
            db=db,
            rc=rc,
            group_id=group_id,
            trigger_type="schedule", 
            trigger_context={'group_id': group_id,
                             'trigger_type': 'schedule'} 
        )
        logging.info(f"Successfully completed scheduled rule check for group_id: {group_id}")
    except Exception as e:
        logging.error(f"Error during scheduled rule check for group_id {group_id}: {e}", exc_info=True)
    finally:
        try:
            next(db_session_generator, None)
        except StopIteration:
            pass


@celery_app.task(name='app.background_worker.tasks.dispatch_scheduled_rule_checks')
def dispatch_scheduled_rule_checks():
    logging.info("Dispatching scheduled rule checks for groups...")
    
    db_session_generator = get_db_session()
    db = next(db_session_generator)

    try:
        groups_query = db.query(Group.id).all()
        group_ids = [g.id for g in groups_query]

        if not group_ids:
            logging.info("No groups found to check for scheduled rules.")
            return

        logging.info(f"Found {len(group_ids)} groups. Dispatching rule check tasks...")
        for group_id in group_ids:
            # Make sure the task name here matches the actual task name for clarity if it's different
            run_scheduled_rule_check_for_group.delay(str(group_id))
        
        logging.info(f"Dispatched rule check tasks for {len(group_ids)} groups.")
    except Exception as e:
        logging.error(f"Error in dispatch_scheduled_rule_checks: {e}", exc_info=True)
    finally:
        try:
            next(db_session_generator, None)
        except StopIteration:
            pass

# --- NEW TASKS FOR SCHEDULE PROGRESS ---

@celery_app.task(name='app.background_worker.tasks.process_single_schedule_progress')
def process_single_schedule_progress(schedule_id: str):
    """
    Celery task to process and update the progress of a single schedule.
    """
    logging.info(f"Processing schedule progress for schedule_id: {schedule_id}")
    db_session_generator = get_db_session()
    db = next(db_session_generator)
    try:
        check_and_update_schedule_progress(db=db, schedule_id=schedule_id)
        logging.info(f"Successfully processed schedule progress for schedule_id: {schedule_id}")
    except Exception as e:
        logging.error(f"Error processing schedule progress for schedule_id {schedule_id}: {e}", exc_info=True)
    finally:
        try:
            next(db_session_generator, None)
        except StopIteration:
            pass


@celery_app.task(name='app.background_worker.tasks.dispatch_all_schedule_progress_checks')
def dispatch_all_schedule_progress_checks():
    """
    Celery task to fetch all schedules and dispatch progress checks for each.
    """
    logging.info("Dispatching schedule progress checks for all schedules...")
    db_session_generator = get_db_session()
    db = next(db_session_generator)
    try:
        schedules_query = db.query(Schedule.id).filter(Schedule.status != 'archived', Schedule.status != 'template', Schedule.status =='completed').all() # Example filter
        schedule_ids = [s.id for s in schedules_query]

        if not schedule_ids:
            logging.info("No active schedules found to update progress.")
            return

        logging.info(f"Found {len(schedule_ids)} schedules. Dispatching progress check tasks...")
        for schedule_id in schedule_ids:
            process_single_schedule_progress.delay(str(schedule_id))
        
        logging.info(f"Dispatched progress check tasks for {len(schedule_ids)} schedules.")
    except Exception as e:
        logging.error(f"Error in dispatch_all_schedule_progress_checks: {e}", exc_info=True)
    finally:
        try:
            next(db_session_generator, None)
        except StopIteration:
            pass

# --- Celery Beat Schedule ---
celery_app.conf.beat_schedule = {
    'dispatch-group-rule-checks-every-minute': { # Renamed for clarity
        'task': 'app.background_worker.tasks.dispatch_scheduled_rule_checks',
        'schedule': crontab(minute='*'), # Every minute
    },
    'dispatch-schedule-progress-checks-hourly': {
        'task': 'app.background_worker.tasks.dispatch_all_schedule_progress_checks',
        'schedule': crontab(minute='0', hour='*'), # Every hour at minute 0
    },
}
celery_app.conf.timezone = 'UTC'

# It's good practice to ensure logging is configured, especially for background workers.
# If not configured elsewhere, a basic config here can be useful for debugging.
if not logging.getLogger().hasHandlers():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')