

tips = []

system_tips =  {
        "setup_1":{
            "title": "Create new beehive and sent data.",
            "description": "Create a new beehive for monitoring and sent data into it.",
            "priority": "Setup"},

        "setup_2":{
                "title": "Add new hardware hub",
                "description": "Connect hardware hub to this system",
                "priority": "Setup"
            },

            "setup_3":{
                "title": "Add meteostation",
                "description": "If u have hardware hub connected to meteostation sensors, connect them via creating new beehive meteostation. (This warning will disappear when hardware hub is connected to new beehive)",
                "priority": "Setup (Optional)"
            },
        "system_error" : {
            "title": "System failure",
            "description": "There was an error in reporting data, check logs for additional info",
            "priority": "High"
        }}

beehive_tips = {
        "beehive_temp_high":{
            "title": "Temperature High",
            "description": "Temperature is in the beehive is too high, please allow ventilation in beehive.",
            "priority": "Medium"
        },
        "beehive_temp_high_high":{
            "title": "Temperature High",
            "description": "Temperature is in the beehive is very high, please allow ventilation in beehive",
            "priority": "High"
        },
        "beehive_temp_low":{
            "title": "Temperature Low",
            "description": "Temperature is in the beehive is too low, add more insulation to beehive.",
            "priority": "Medium"
        },
        "beehive_temp_freezing":{
            "title": "Temperature Low",
            "description": "Temperature is in the beehive is freezing, add more insulation to beehive.",
            "priority": "High"
        },
        "beehive_humidity_high":{
            "title": "High Humidity",
            "description": "High humidity present in beehive meaning higher risk of mold.",
            "priority": "Low"
        },
        "beehive_humidity_low":{
            "title": "Low Humidity",
            "description": "Low humidity present in beehive, egg hatching may be effected ",
            "priority": "Low"
        }
        }

beehive_health_tips = {
    "health_low":{
        "title": "Low Health",
        "description": "System detected of low health ",
        "priority": "Low"
    }
}

from app.db_man.multidb_func import get_all_measurement, get_last_sensor_data
from app.sse import update_sse
import logging

def check_setup_tips():
    #Beehive values, if there is some unit
    tips = []
    sensor_data_by_beehive = get_last_sensor_data()
    if (sensor_data_by_beehive == []):
        tips.append(system_tips.get('setup_1'))
    sensor_clients = get_all_measurement()
    if (sensor_clients == []):
        tips.append(system_tips.get('setup_2'))
    
    if ((sensor_data_by_beehive == []) and (sensor_clients == [])):
        tips.append(system_tips.get('setup_3'))
    return tips

def update_tips():
    full_tips = []
    full_tips = full_tips + check_setup_tips()
    logging.debug(f"tips: {tips}")
    update_sse({"tips": full_tips})

