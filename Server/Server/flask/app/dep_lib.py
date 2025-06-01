##################################
# Flask dependency library
# Last version of update: v0.95

##################################

import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import secrets
import bcrypt

port = os.getenv('REDIS_PORT')
host = os.getenv('REDIS_HOST')
memcached_uri = f'redis://{host}:{port}'
limiter = Limiter(storage_uri=memcached_uri,
                  key_func=get_remote_address)

available_options = set(("solar", "battery",
                        "serial", "memorymode",
                         "jtagdebugging", "temperature",
                         "humidity", "pressure",
                         "wind_speed", "wind_vane",
                         "storm", "weight",
                         "calibration", "voltage",
                         "wattage", "light"))
# Supported Values
supported_units = ['humidity', 'temperature',
                   'pressure', 'wind_speed',
                   'wind_vane', 'storm',
                   'weight',
                   'battery_voltage', 'solar_wattage', 'light']

convert_units = {
    'degC': '°C',
    'degF': '°F',
    'percent': '%',
    'pascal': 'Pa',
    'kilopascal': 'kPa',
    'gram': 'g',
    'status': '',
}

allowed_rules_init = set((
    "temp", "hum",
    "sound", "lux",
    "rain", "weight",
    "wind", "activity",
    "battery", "tag",
    "time", "date", "none", 
    "temperature", "humidity", 
    "pressure", "battery_voltage", 
    "solar_voltage","storm", "light",
    "schedule"
))

translate_init = {
    'temp': 'temperature',
    'lux': 'light',
    'hum': 'humidity'    
}

measurement_init = set((
    "temp", "hum",
    "sound", "lux",
    "rain", "weight",
    "wind", "activity",
    "battery",
    "temperature", "humidity", 
    "pressure", "battery_voltage", 
    "solar_voltage","storm", "light"
))

binary_units = ['storm', 'charging']

units = {'time': 0,
         'temperature': 1,
         'pressure': 2,
         'battery_voltage': 3, 'solar_voltage': 3,
         'battery_wattage': 4, 'system_wattage': 4,
         'speed': 5,
         'weight': 6,
         'sound_pressure_level': 7,
         'network_strength': 8,
         'memory': 9,
         'light': 10}


measurement_config = ("light", "temperature", "humidity", "speed", "pressure"
                      "wind_vane", "storm", "weight", "voltage", "wattage", "sound_pressure_level",
                      "memory" "network_strenght")
system_config = ("system_time", "hardware_session_expire", "number_precision", "backup_interval", "automatic")

def generate_api_key():
    api_key = secrets.token_hex(64)
    salt = bcrypt.gensalt()
    hashed_key = bcrypt.hashpw(api_key.encode('utf-8'), salt)
    return (api_key, hashed_key)