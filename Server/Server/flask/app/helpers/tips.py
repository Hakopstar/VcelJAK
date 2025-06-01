####################################
# Default tips helper.
# Last version of update: v0.95
# app/helpers/tips.py
####################################

tips = []

system_tips =  {
        "setup_1":{
            "title": "Create new group and sent data.",
            "description": "Create a new group for monitoring and sent data into it.",
            "priority": "Setup"},

        "setup_2":{
                "title": "Add new hardware hub",
                "description": "Connect hardware hub to this system",
                "priority": "Setup"
            },

            "setup_3":{
                "title": "Add meteostation",
                "description": "If u have hardware hub connected to meteostation sensors, connect them via creating new group meteostation. (This warning will disappear when hardware hub is connected to new group)",
                "priority": "Setup (Optional)"
            },
        "system_error" : {
            "title": "System failure",
            "description": "There was an error in reporting data, check logs for additional info",
            "priority": "High"
        }}

group_tips = {
        "group_temp_high":{
            "title": "Temperature High",
            "description": "Temperature is in the group is too high, please allow ventilation in group.",
            "priority": "Medium"
        },
        "group_temp_high_high":{
            "title": "Temperature High",
            "description": "Temperature is in the group is very high, please allow ventilation in group",
            "priority": "High"
        },
        "group_temp_low":{
            "title": "Temperature Low",
            "description": "Temperature is in the group is too low, add more insulation to group.",
            "priority": "Medium"
        },
        "group_temp_freezing":{
            "title": "Temperature Low",
            "description": "Temperature is in the group is freezing, add more insulation to group.",
            "priority": "High"
        },
        "group_humidity_high":{
            "title": "High Humidity",
            "description": "High humidity present in group meaning higher risk of mold.",
            "priority": "Low"
        },
        "group_humidity_low":{
            "title": "Low Humidity",
            "description": "Low humidity present in group, egg hatching may be effected ",
            "priority": "Low"
        }
        }

group_health_tips = {
    "health_low":{
        "title": "Low Health",
        "description": "System detected of low health ",
        "priority": "Low"
    }
}

from app.sse import update_sse
import logging


def update_tips():
    full_tips = []
    full_tips = full_tips
    logging.debug(f"tips: {tips}")
    update_sse({"tips": full_tips})

