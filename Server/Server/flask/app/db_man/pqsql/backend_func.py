####################################
# PostgresSQL
# Last version of update: v0.81

####################################
import logging

from sqlalchemy import inspect


from app.db_man.pqsql.models import *
from app.db_man.pqsql.engine import *
import bcrypt

def detection_system(client_id: str, sclass: object) -> bool:
    """
    Detects if client_id is present and can return instance in specific table

    Args:
        client_id (str): searched client_id
        sclass (object): searched table

    Using:
        os, logging, sqlalchemy

    Returns:
        bool: if client_id is present
    """

    try:
        logging.debug("Detection System Activated!")
        with session_clientmodifier() as session:
            for instance in session.query(sclass).filter_by(client_id=client_id):
                x = instance.client_id
                return True
        logging.warning(f"client_id: {client_id} Not detected!")
        return False
    except Exception as err:
        logging.warning(f"e, client_id: {client_id} Not detected!")
        logging.debug(err)
        return False


def hub_rename(uuid, name):
    try:
        logging.debug("Renaming Sensor")
        with session_clientmodifier() as session:
            session.query(Available_sensors).filter(Available_sensors.client_id == uuid).update({"client_name": str(name)})
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Renaming Hub failed")
        session.rollback()
        logging.debug(err)
        return False

def hub_change_key(uuid, hashed_key):
    try:
        logging.debug("Renaming Sensor")
        with session_clientmodifier() as session:
            session.query(Available_sensors).filter(Available_sensors.client_id == uuid).update({"client_key_hash": hashed_key})
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Renaming Hub failed")
        session.rollback()
        logging.debug(err)
        return False


def config_supporting_range(unit, status):
    value = 0
    logging.debug(unit)
    if (unit == "wind_speed"):
        unit = "speed"
    with session_clientmodifier() as session:
         values = session.query(Server_Config.__table__).filter_by(config_name=unit).first()
         if not values:
            logging.debug("Range not found")
            return 0
    if (status == 0):
        value = values.lowest_acceptable
    elif (status == 1):
        value = values.highest_acceptable
        
    return value

def check_if_uuid_exists(id):
    try:
        with session_clientmodifier() as session:
            for instance in session.query(Available_sensors).filter_by(client_id=str(id)):
                x = instance.client_id
                logging.debug(f"client_id {id} EXISTS!")
                return True
        logging.debug(f"client_id: {id} Not detected!")
        return False
    except Exception as err:
        logging.warning(f"UUID DONT EXISTS: {err}, maybe")
        return False
        

def hub_add(uuid, name, key_hash, last_session, active, access_key):
    try:
        with session_clientmodifier() as session:
            new_rec = Available_sensors(client_id=uuid, client_name=name, client_key_hash=key_hash,
                                        client_last_session=last_session, client_active=active, client_access_key=access_key)
            session.add(new_rec)
            session.commit()
            return True
    except Exception as err:
        session.rollback()
        logging.error(f"Adding hub into database failed {err}")
        return False
    

def delete_beehive(beehive_id):
    try:
        logging.debug("Delete Beehive")
        with session_clientmodifier() as session:
            session.query(Beehive).filter(Beehive.id == beehive_id).delete()
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Deleting Beehive failed")
        session.rollback()
        logging.debug(err)
        return False

def terminating_session(session_id):
    try:
        logging.debug("Delete Beehive")
        with session_clientmodifier() as session:
            session.query(Session_auth).filter(Session_auth.session_id == session_id).delete()
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Deleting Beehive failed")
        session.rollback()
        logging.debug(err)
        return False

def update_inspection(beehive_id, lastInspection):
    try:
        logging.debug("Beehive edit")
        with session_clientmodifier() as session:
            session.query(Beehive).filter(Beehive.id == beehive_id).update({"last_inspection": lastInspection})
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Update Inspection Beehive failed")
        session.rollback()
        logging.debug(err)
        return False
    
def beehive_edit(beehive_id, name, location):
    try:
        logging.debug("Beehive edit")
        with session_clientmodifier() as session:
            session.query(Beehive).filter(Beehive.id == beehive_id).update({"name": name, "location": location})
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Editing Beehive failed")
        session.rollback()
        logging.debug(err)
        return False

def hub_delete_key(uuid):
    try:
        logging.debug("Delete Sensor")
        with session_clientmodifier() as session:
            session.query(Available_sensors).filter(Available_sensors.client_id == uuid).delete()
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Deleting Hub failed")
        session.rollback()
        logging.debug(err)
        return False

def user_change_password(client_id, client_pass):
    
    try:
        salt = bcrypt.gensalt()
        hashed_key = bcrypt.hashpw(client_pass.encode('utf-8'), salt)
        logging.debug("Changing Password")
        with session_clientmodifier() as session:
            session.query(Users).filter(Users.client_id == client_id).update({"client_hash": hashed_key.decode('utf-8')})
            session.commit()
        return True
    except Exception as err:
        logging.error(f"Changing Password failed")
        session.rollback()
        logging.debug(err)
        return False

def reading(id: str, sclass: object):
    """
    Reads record of client_id in table

    Args:
        id (str): searched client_id
        sclass (object): table of reading

    Using:
        os, logging, sqlalchemy

    Returns:
        False or list: returns record as list or False if reading fails
    """

    try:
        logging.debug("Reading system")
        with session_clientmodifier() as session:
            rec = session.query(sclass.__table__).filter_by(
                client_id=id).first()
            if not rec:
                return False
            logging.debug(f"Returning: {rec}")
            return list(rec)
    except Exception as err:
        logging.debug(f"Reading Failed: {err}")
        return False


def update(sess: list, sclass: object) -> bool:
    """
    Updates record as replacement in database

    Args:
        sess (list): replacement list
        sclass (object): table of updating

    Using:
        os, logging, sqlalchemy

    Returns:
        bool: Status of completion
    """

    try:
        logging.debug("Updating!")
        with session_clientmodifier() as session:
            client_id = sess[0]
            rec = session.query(sclass).filter_by(client_id=client_id).first()
            if rec:
                mapper = inspect(sclass)
                for index, value in enumerate(mapper.attrs):
                    logging.debug(f"index: {index}: {value.key}")
                    setattr(rec, value.key, sess[index])
                session.commit()
        return True
    except Exception as err:
        session.rollback()
        logging.error(f"session: {err} Updating Failed!")
        logging.debug(err)
        return False


def writing_config(config: list) -> bool:
    """
    Checks if config exists and updates or creates the config

    Args:
        config (list): List of all configuration variables

    Using:
        os, logging, sqlalchemy

        backend: detection_system(), reading(), update()

    Returns:
        bool: status of completion
    """

    try:
        logging.info("Writing Config!")
        if not detection_system(config[0], Config):
            with session_clientmodifier() as session:
                new_rec = Config(client_id=config[0], system_time_unit=config[1], temperature_unit=config[2], pressure_unit=config[3], voltage_unit=config[4], power_unit=config[5],
                                 speed_unit=config[6], weight_unit=config[7], sound_pressure_level_unit=config[8], network_strenght_unit=config[9], memory_unit=config[10])
                session.add(new_rec)
                session.commit()
        else:
            logging.debug("Detecting existing config")
            if list(reading(config[0], Config)) != config:
                logging.debug("Updating Config!")
                if not update(config, Config):
                    return False
            else:
                logging.debug("Configs are same, not updating!")
        logging.debug("Writing config was succesfull")
        return True
    except Exception as err:
        session.rollback()
        logging.debug("Config Writing Failed")
        logging.error("Adding information to database failed reason:")
        logging.error(err)
        return False


def session(client: str, config: list) -> bool:
    """
    Checks if session exist and is same, then don't do anything,
    if they aren't same or session doesn't exist create another.

    Args:
        client (str): presented client_id
        config (list): list of configuration parameters

    Using:
        os, logging, sqlalchemy

        backend: detection_system(), reading(), writing_config()

    Returns:
        bool: Status of completion
    """

    logging.info("Checking if session exists...")
    try:
        logging.info("Creating new session!")
        if not detection_system(client[0], Session_auth):
            with session_clientmodifier() as sesss:
                new_rec = Session_auth(client_id=client[0],
                                       session_id=client[1],
                                       session_key_hash=client[2],
                                       available=client[3],
                                       session_end=client[4],
                                       system_privileges=client[5])
                sesss.add(new_rec)
                sesss.commit()
            logging.debug("Session updating config")
            if not writing_config(config):
                return False
        else:
            logging.debug("Checking if session is same...")
            if list(reading(client[0], Session_auth)) != client:
                logging.info("Session are not same!")
                if not update(client, Session_auth):
                    return False
            else:
                logging.debug("Session is same, not updating!")
            logging.info("Updating Config")
            if not writing_config(config):
                return False
            logging.info("Config Updated")
        logging.debug("Session Created!")
        return True

    except Exception as err:
        logging.critical("Session creating failed")
        logging.error("Adding information to database failed reason:")
        logging.error(err)
        
        return False


