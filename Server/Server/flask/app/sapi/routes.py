########################################################
# sapi/routes.py creating POST routes to database
# Last version of update: v0.91
# 
########################################################

import os
import json
import logging
import tracemalloc
import random
import time
import io

from flask import Flask, render_template, request, json, jsonify, Response, flash, request, redirect
from flask_socketio import SocketIO, emit
from app.sapi import bp
from app.dep_lib import limiter
from app.db_man.influxdb.read import get_num_bid, get_bid_timedata
from app.db_man.multidb_func import check_if_beehive_exist, get_last_sensor_data



SENSORS = {
    "0": {"temperature": 22, "humidity": 60, "weight": 10.2},
    "1": {"temperature": 22, "humidity": 60, "weight": 10.2},
    "2": {"temperature": 25, "humidity": 55, "weight": 10.5},
    "3": {"temperature": 20, "humidity": 65, "weight": 9.8},
    "4": {"temperature": 10, "humidity": 61, "weight": 1.8},
}

SENSORA =  [
     { "id": "1", "timestamp": "2025-03-03 11:18:25", "temperature": 35, "humidity": 60, "weight": 15},
        { "id": "2", "timestamp": "2025-03-03 11:19:30", "temperature": 34, "humidity": 62, "weight": 14},
        { "id": "3", "timestamp": "2025-03-03 11:20:15", "temperature": 33, "humidity": 58, "weight": 16},
        { "id": "4", "timestamp": "2025-03-03 11:21:05", "temperature": 36, "humidity": 61, "weight": 15.5},
        { "id": "5", "timestamp": "2025-03-03 11:22:10", "temperature": 35, "humidity": 59, "weight": 15.2},
        { "id": "6", "timestamp": "2025-03-03 11:23:00", "temperature": 34, "humidity": 60, "weight": 14.8}
    ]


TIME_LABELS = {
    "month": ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Sep", "Nov", "Dec", "Jan"],
    "day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "hour": ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"]
}


def generate_sensor_data():
    while True:
        data = {
            "health_value": round(random.uniform(50, 100), 2),  # Health percentage
            "wind_speed": round(random.uniform(5, 20), 2),
            "temperature": round(random.uniform(15, 35), 2),
            "humidity": round(random.uniform(30, 80), 2),
            "tips": [
                {
                    "title": "Regular Inspections",
                    "description": "Conduct weekly hive inspections to check for signs of disease, pests, or queen issues.",
                    "priority": "High",
                },
                {
                    "title": "Water Source",
                    "description": "Provide a clean, shallow water source near the hive to prevent bees from seeking water elsewhere.",
                    "priority": "Medium",
                },
                {
                    "title": "Diverse Plantings",
                    "description": "Plant a variety of nectar-rich flowers to ensure a consistent food supply throughout the season.",
                    "priority": "Medium",
                },        
            ]
        }
        yield f"data: {json.dumps(data)}\n\n"
        time.sleep(2)  # Send updates every 2 seconds



@bp.route('/sensors', methods=['GET'])
def get_sensors_data():
    sensors = get_last_sensor_data()
    logging.debug(sensors)
    return jsonify(sensors)



@bp.route('/test', methods=['GET'])
def testa():
    sensors = get_last_sensor_data()
    return sensors

@bp.route('/beehive', methods=['GET'])
def get_sensor_data():
    beehive_id = request.args.get("beehiveId")
    time_scale = request.args.get("timeScale")
    logging.debug(f"beehive: {beehive_id}, timescale: {time_scale}")

    if not beehive_id or not time_scale:
        return jsonify({"error": "Missing beehiveId or timeScale"}), 400

    #if not check_if_beehive_exist(str(beehive_id)):
    #    return jsonify({"error": "Beehive not found"}), 404


    # Get base sensor values
    fetched_data = get_bid_timedata(beehive_id, time_scale)
    base_values = SENSORA[int(beehive_id)]

    #logging.debug(f"dataexample: {data}")
    logging.debug(f"normaldata: {fetched_data}")

    return jsonify(fetched_data)

