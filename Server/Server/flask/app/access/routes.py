########################################################
# access/routes.py creating access calls to backend
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
import uuid

from datetime import datetime
from datetime import timedelta
from datetime import timezone

from flask import Flask, render_template, request, json, jsonify, Response, flash, request, redirect
import humanize

from flask_jwt_extended import create_access_token
from flask_jwt_extended import get_jwt
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import jwt_required
from flask_jwt_extended import JWTManager
from flask_jwt_extended import set_access_cookies
from flask_jwt_extended import unset_jwt_cookies
from flask_jwt_extended import get_csrf_token
from flask_jwt_extended import create_refresh_token
from app.access import bp
from app.dep_lib import limiter, generate_api_key
from app.db_man.multidb_func import validate_user, get_all_sensors, get_all_beehives, get_beehive_name, string_format, get_sensor_count, get_all_measurement, get_hub_name, get_hub_meteostation
from app.db_man.influxdb.read import get_last_single_data, get_last_update_time, get_num_id_in_measurement

from app.db_man.pqsql.backend_func import hub_rename, hub_change_key, hub_delete_key, hub_add, check_if_uuid_exists, terminating_session
from app.db_man.pqsql.models import BlocklistToken
from app.db_man.pqsql.engine import *
from app.tips import update_tips
from app.db_man.memcache.mem_engine import mc

@bp.route('/login', methods=['POST'])
def login():

    username = request.json.get("username", None)
    password = request.json.get("password", None)
    logging.debug(f"username:{username}pass:{password}")
    if not validate_user(username, password):
        logging.debug("Wrong credentials")
        return jsonify({"msg": "Bad username or password"}), 401

   
    # Create JWT token
    access_token = create_access_token(identity=username)
    logging.debug(f"Access_token: {access_token}")
    response = jsonify({"token": access_token})
    logging.debug(f"response: {response}")
    return response, 200

@bp.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    logging.debug("Privated Accessed")
    return "Well", 200

@bp.route('/protec', methods=['GET', 'POST'])
@jwt_required()
def protec():
    logging.debug("Privated Accessed")
    return "Wellamanabababa", 200


@bp.before_request
def log_request():
    logging.debug(f"Request to {request.path} with data: {request.data} and headers: {dict(request.headers)}")



@bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():

    jti = get_jwt()["jti"]
    logging.debug(f"LOGOUT: {jti}")
    logging.debug("LOGOUT ACCESSED")
    response = jsonify({"msg": "logout successful"})
    unset_jwt_cookies(response)
    with session_clientmodifier() as session:
        # Check if the token is already revoked
        try:
            if session.query(BlocklistToken).filter_by(jti=jti).first():
                return jsonify(msg="Token already revoked"), 400  
            logging.debug("UNLOCKING TOKEN")
            # Add JTI to blocklist
            new_blocked_token = BlocklistToken(jti=jti)
            logging.debug("add UNLOCKING TOKEN")
            session.add(new_blocked_token)
            logging.debug("asd UNLOCKING TOKEN")
       
            session.commit()
            logging.debug("SUCCESS")
            return jsonify(msg="Access token revoked"), 200
        except Exception as e:
            session.rollback()
            logging.debug(f"ERROR: {e}")
            return jsonify(error="Database error", details=str(e)), 500
@bp.route('/token-verify', methods=['GET'])
@jwt_required()
def verify():
    logging.debug("SUCCESS")
    return "Succesfully",200

@bp.route('/get_info_sensors', methods=['GET'])
@jwt_required()
def return_sensors():
    try:
        sensors = get_all_sensors()
    except Exception as err:
        logging.warning(f"sensor get all failed: {err}")
        return [], 200

    sent_sensors = []
    try:
        for sensor in sensors:
            logging.debug(sensors[sensor])
            logging.debug(sensor)
            try:
                sensor_value = get_last_single_data(sensor, sensors[sensor]['bid'])[0]
            except Exception as err:
                logging.warning(f"ERROR RETURNING SENSORS {err}")
                bid = sensors[sensor]['bid']
                hub_name = get_beehive_name(bid)[1]
                if (bid == 0):
                    bid = ""
                    hub_name = ""
                sent_sensors.append({"id": sensor, "name": sensor, "type": "unknown", "hubId": bid, "hubName": hub_name, "lastReading": 0, "lastUpdate": "Never"})
                continue
            if not sensor_value:
                sent_sensors.append({"id": sensor})
                continue
            logging.debug("continue")
            bid = sensor_value['bid']
            type = sensor_value['unit']
            sensor_name = f"{type}_{sensor}"
            last_value = string_format(sensor_value['value'], type)
            last_time = humanize.naturaltime(sensor_value['time'])
            hub_name = get_beehive_name(bid)[1]
            logging.debug(f"{sensor_name}, {type}, {hub_name}, {last_value}, {last_time}")
            if (bid == "0"):
                bid = ""
            sent_sensors.append({"id": sensor, "name": sensor_name, "type": type, "hubId": bid, "hubName": hub_name, "lastReading": last_value,"lastUpdate": last_time})
    except Exception as err:
        logging.warning(f"Showing sensors Failed: {err}")
        return [], 200
    logging.debug("SUCCESS")
    return sent_sensors, 200


@bp.route('/get_hub_info', methods=['GET'])
@jwt_required()
def return_hub_info():
    sent_hubs = []
    #get_last_update_time()
    logging.debug(get_all_measurement())
    measurements = get_all_measurement()
    logging.debug(measurements)
    for measurement in measurements:

        measurement = measurement[0]
        last_time_update = 0
        hub_name = get_hub_name(measurement)
        last_time_update = get_last_update_time(measurement)
        if last_time_update == 0:
            last_time_update = "never"
        else:
            last_time_update = humanize.naturaltime(last_time_update)
        logging.debug(f"hub_name:{hub_name}")
        logging.debug(f"Last TIme: {last_time_update}")
        connected_sensors = get_num_id_in_measurement(measurement)
        logging.debug(f"number of sensors: {connected_sensors}")
        sent_hubs.append({"uuid": measurement, "id": measurement, 'name': hub_name, "connectedSensors": connected_sensors, "lastUpdate": last_time_update})
    logging.debug("SUCCESS")
    return sent_hubs, 200

@bp.route('/new_hub', methods=['POST'])
@jwt_required()
def new_hub():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        name_change = json_data['name']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    api_key, hashed_key = generate_api_key()
    client_id = 0
    uuid_test = True
    while uuid_test:
        client_id = str(uuid.uuid4())
        if not check_if_uuid_exists(client_id):
            uuid_test = False
            break;
    
    hashed_key = hashed_key.decode('utf-8')
    client_last_session = str(int(time.time()))
    client_active = "True"
    client_access_key = "None"
    if not hub_add(client_id, name_change, hashed_key, client_last_session, client_active, client_access_key):
        return "FAILED", 415
    logging.debug(f"KEY: {api_key}")
    update_tips()
    logging.debug("SUCCESS")
    return {'key': api_key, 'hub': {'uuid': client_id, 'name': name_change} }, 200

@bp.route('/rename_hub', methods=['POST'])
@jwt_required()
def rename_hub():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        uuid_change = json_data['uuid']
        name_to_change = json_data['name']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    if not hub_rename(uuid_change, name_to_change):
        logging.debug("rename_Failed")
        return "FAILED", 415
    
    logging.debug(f"RENAME HUB: {json_data, uuid_change, name_to_change}")
    logging.debug("SUCCESS")
    return "Success", 200

@bp.route('/delete_hub', methods=['POST'])
@jwt_required()
def delete_hub():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        uuid_change = json_data['uuid']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
   
    if not hub_delete_key(uuid_change):
        return "FAILED", 415
    update_tips()
    return "Success", 200

@bp.route('/change_api_key', methods=['POST'])
@jwt_required()
def change_api_key():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        uuid_change = json_data['uuid']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    api_key, hashed_key = generate_api_key()
    if not hub_change_key(uuid_change, hashed_key.decode('utf-8')):
        return "ERROR", 415
    logging.debug("SUCCESS")
    return {'key': api_key}, 200
   


from app.db_man.multidb_func import get_all_beehives_sensor, get_all_sessions
from app.db_man.multidb_func import get_all_beehives, get_beehive_info, change_assign
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

@bp.route('/get_beehives', methods=['GET'])
@jwt_required()
def return_beehives():
    beehives = []
    for beehive in get_all_beehives():
        beehive = beehive[0]
        if (beehive == 0):
            continue
        sensors = get_all_beehives_sensor(beehive)
        if sensors == False:
            return "FAILED", 415
        beehive_info = get_beehive_info(beehive)
        logging.debug(f"beehive_info: {beehive_info}")
        name = beehive_info[1]
        location = beehive_info[2]
        last_downtime = beehive_info[3]
        if last_downtime == "0":
            last_downtime = "Never"
        else:
            last_downtime = datetime.strptime(last_downtime, "%Y-%m-%d")
            last_downtime = last_downtime.replace(tzinfo=timezone.utc)
            last_downtime = last_downtime.astimezone(ZoneInfo("Europe/Prague"))
            last_downtime = humanize.naturaltime(last_downtime)
        beehives.append({"id": beehive, "name": name, "sensors": sensors, "location": location, "lastInspection": last_downtime})
        logging.debug(f"{beehive_info}, {location}, {last_downtime}")
    logging.debug("SUCCESS")
    return beehives, 200


@bp.route('/calibrated_sensor', methods=['POST'])
@jwt_required()
def calibrate_sensor():
    update_tips()
    logging.debug("SUCCESS")
    "Success", 200
    #sensorId: calibrationSensor.id,
    #value: Number.parseFloat(calibrationValue),

from app.db_man.multidb_func import add_beehive, get_full_config, reset_config, update_full_config
from app.db_man.pqsql.backend_func import update_inspection, beehive_edit, delete_beehive, user_change_password

@bp.route('/edit_beehives', methods=['POST'])
@jwt_required()
def edit_beehive():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        action = json_data['action']
        if (action == 'add'):
            name = json_data['name']
            location = json_data['location']
            if name == 'system':
                return "INVALID NAME", 400
            isbeehive, beehive_id = add_beehive(name, {'location':location, 'last_inspection': 0})
            if not isbeehive:
                return "Adding Failed", 415
    
            
        elif (action == 'edit'):
            beehive_id = json_data['id']
            name = json_data['name']
            location = json_data['location']
            if not beehive_edit(beehive_id, name, location):
                return "Edit Failed", 415
            if (name == "meteostation"):
                mc.set("meteostation", str(beehive_id))
            
            


        elif (action == 'update_inspection'):
            beehive_id = json_data['id']
            lastInspection = json_data['lastInspection']
            logging.debug(f"Last Inspecton: {lastInspection}")
            if not update_inspection(beehive_id, lastInspection):
                return "Update Inspection Failed", 415
          
        update_tips()
        logging.debug("SUCCESS")
        return "Success", 200
    except Exception as err:
        logging.debug(f"request.data in not supported format {err}")
        return "INVALID CHARACTERS", 415


@bp.route('/deleting_beehive', methods=['POST'])
@jwt_required()
def beehive_delete():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        beehive_id = json_data['id']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    if (beehive_id == "0"):
        return "Not available to delete", 400
    
    override = True
    beehive_change = 0
    sensors = get_all_beehives_sensor(beehive_id)
    for sensor_id in sensors:
        if not change_assign(beehive_change, sensor_id, override):
            logging.error("Change assign failed")
    if (str(get_hub_meteostation()) == str(beehive_id)):
        mc.delete("meteostation")
    if not delete_beehive(beehive_id):
        return "FAILED", 415
    update_tips()
    logging.debug("SUCCESS")
    return "Success", 200
    

@bp.route('/assign_sensor', methods=['POST'])
@jwt_required()
def assign_sensor():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        beehive_id = json_data['beehiveId']
        sensor_id = json_data['sensorId']
        override = json_data['override']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    if not change_assign(int(beehive_id), sensor_id, bool(override)):
        return "FAILED TO UNASSIGN", 415
    update_tips()
    logging.debug("SUCCESS")
    return "SUCCESS", 200


@bp.route('/unassign_sensor', methods=['POST'])
@jwt_required()
def unassign_sensor():
    if not request.data:
        logging.debug("Empty String - 400")
        return "Empty String", 400
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        beehive_id = json_data['beehiveId']
        sensor_id = json_data['sensorId']
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    beehive_id = 0
    override = True
    if not change_assign(beehive_id, sensor_id, override):
        return "FAILED TO UNASSIGN", 415
    update_tips()
    logging.debug("SUCCESS")
    return "Success", 200

@bp.route('/get_sessions', methods=['GET'])
@jwt_required()
def get_sessions():
    session_list = []
    sessions = get_all_sessions()
    if not sessions:
        return {}, 200
    for session in sessions:
        client_id = sessions[session]['client_id']
        time_end = sessions[session]['time_end']
        time_start = datetime.fromtimestamp((int(time_end) - int(os.getenv('HARDWARE_SESSION_EXPIRE'))),  tz=timezone.utc)
        time_end = datetime.fromtimestamp(int(time_end), tz=timezone.utc)
        hub_name = get_hub_name(client_id)
        logging.debug(f"{time_start}, {time_end}")
        session_list.append({'id':session, 'hubName': hub_name, 'hubId':client_id, 'startTime': time_start, 'endTime': time_end})
    logging.debug("SUCCESS")
    return session_list, 200

@bp.route('/terminate_session', methods=['POST'])
@jwt_required()
def terminate_session():
    try:
        
        json_data = json.loads((request.data).decode("utf-8"))
        session_id = json_data['sessionId']
        logging.debug(session_id)
        if not terminating_session(session_id):
            return "FAILED", 415
    except:
        logging.debug("request.data in not supported format")
        return "INVALID CHARACTERS", 415
    logging.debug("SUCCESS")
    return "Success", 200

@bp.route('/change_password', methods=['POST'])
@jwt_required()
def change_password():
    try:
        
        json_data = json.loads((request.data).decode("utf-8"))
        password = str(json_data['old_password']) 
        username = str(json_data['user'])
        logging.debug(f"{username} {password}")
        if not validate_user(username, password):
            return jsonify({"msg": "Bad username or password"}), 401
        new_password = json_data['new_password']
        if not user_change_password(username, new_password):
            "Failed", 415
    except Exception as err:
        logging.debug(f"request.data in not supported format {err}")
        return "INVALID CHARACTERS", 415
    logging.debug("SUCCESS")
    return "Success", 200

@bp.route('/get_config', methods=['GET'])
@jwt_required()
def system_config():
    config = get_full_config()
    logging.debug(config)
    logging.debug("SUCCESS")
    return config, 200


@bp.route('/update_config', methods=['POST'])
@jwt_required()
def update_config():
    try:
        json_data = json.loads((request.data).decode("utf-8"))
        logging.info(json_data)
        if json_data.get('system', {}).get('config_reset', '') == "True":
            if not reset_config():
                return "Reseting failed", 500
            return "Success", 200
        if not update_full_config(json_data):
            return "Failed to update", 500
    except Exception as err:
        logging.debug(f"error: {err}")
        return "Failed", 500
    update_tips()
    logging.debug("SUCCESS")
    return "Success", 200


