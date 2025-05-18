##################################
# Flask dependency library
# Last version of update: v0.81

##################################

import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import secrets
import bcrypt

port = os.getenv('MEMCACHE_PORT')
host = os.getenv('MEMCACHE_HOST')
memcached_uri = f'memcached://{host}:{port}'
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


binary_units = ['storm', 'charging']

units = {'time': 0,
         'temperature': 1,
         'pressure': 2,
         'battery_voltage': 3, 'solar_voltage': 3,
         'battery_wattage': 4, 'system_wattage': 4,
         'speed': 5,
         'weight': 6,
         'sound_pressure_level': 7,
         'network_strenght': 8,
         'memory': 9,
         'light': 10}




def generate_api_key():
    api_key = secrets.token_hex(64)
    salt = bcrypt.gensalt()
    hashed_key = bcrypt.hashpw(api_key.encode('utf-8'), salt)
    return (api_key, hashed_key)