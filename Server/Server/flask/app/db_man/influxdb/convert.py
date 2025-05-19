##################################
# InfluxDB Convert file
# Last version of update: v0.81

##################################

import os, logging

from pint import UnitRegistry

from app.dep_lib import units
from app.db_man.pqsql.models import Config
from app.db_man.pqsql.backend_func import reading

ureg = UnitRegistry()
Q_ = ureg.Quantity

def config_repair(config):
    """
    Change wrong value names into right one

    Args:
        Config (List): 
            List of configuration
            Key_names:
                example: ["ms", "degF", "Pa", "t", "V", "W", "m/s", "gram", "db", "db", "bytes"]
                meaning: system_time_unit, temperature_unit, pressure_unit, voltage_unit, power_unit,
                    speed_unit, weight_unit, sound_pressure_level_unit, network_strenght_unit, memory_unit
        
    Returns:
        config {dict}: List of all edited values
    """
    
    if (config['temperature'] == "F") or (config['temperature'] == "f"):
        config['temperature'] = "degF"
    elif (config['temperature'] == "C") or (config['temperature'] == "c"):
        config['temperature'] = "degC"

    return config

def units_convertion(val, unit_in, unit_out, precision):
    """
    Converts session_value into corresponding system_value, 
    for example 18C into 64.4F

    Args:
        val (int): Converting Value
        unit_in (str): Session Config unit
        unit_out (str): System Config unit
        precision (int): decimal points in conversion
    
    Using:
        os, logging, pint
    
    Returns:
        int: Converted value 
    """

    try:
        logging.debug(f"value: {val}, type: {type(val)} unit_in: {unit_in}, unit_out: {unit_out.get('units')}")
        value = Q_(int(val), ureg(str(unit_in))).to(str(unit_out.get('units')))
        logging.debug(f"value: {value}")
        number = round(value.magnitude, int(precision))
        logging.debug(f"number: {number}")
        return number

    except Exception as err:
        logging.debug(f"Convertion Error: {err}")
        logging.info("Units Convertion Failed, Invalid config!")
        raise Exception('config_error')


def converting_units(session_config, server_config, key, value):
    """
    Converts all session_config values into corresponding server_config values 
    for example 18C into 64.4F

    Args:
        session_config (list): Clients config stored in database
        server_config (list): Server defined config
        key (str):
        value (int): int of current value

    Using:
        os, logging, pint
    
    Returns:
        int: Converted value 
    """
    logging.debug(f"Session_Config: {session_config}, Server_Config: {server_config}")


    if key not in units or session_config[key] == server_config[key]:
        #logging.debug(f"not in units: {value}")
        #logging.debug(f"key: {key}")
        if key in units:
            logging.debug(f" sesion_config: {session_config[key]}, server_config: {server_config[key]}")
        try:
            logging.debug(float(value))
            cvalue = round(float(value), int(os.getenv('NUMBER_PRECISION')))
            return cvalue
        except:
            logging.debug("converting Failed")
            return value
    
    #logging.debug(f"key: {key}, sess: {session_config[key]}, server: {server_config[key]}")
    cvalue = units_convertion(value, session_config[key], server_config[key], os.getenv('NUMBER_PRECISION'))
    #logging.debug(f"Configs are not same, converted value: {cvalue} default: {value}, key: {key}, session_config: {session_config[key]}, server_config: {server_config[key]}")
    
    return float(cvalue)

