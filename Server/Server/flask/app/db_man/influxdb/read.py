from app.db_man.influxdb.engine import *
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo



def get_bid_timedata(bid, time_scale):
    logging.debug(f"time_scale: {time_scale}")
    if time_scale == "year":
        inrange = "-1y"
        ourange = "1mo"
    elif time_scale == "month":
        inrange = "-1mo"
        ourange = "7d"
    elif time_scale == "week":
        inrange = "-7d"
        ourange = "1d"
    elif time_scale == "day":
        inrange = "-1d"
        ourange = "4h"
    elif time_scale == "hour":
        inrange = "-1h"
        ourange = "10m"
    else:
        inrange = "-7d"
        ourange = "1d"

    query_api = client.query_api()
    query = f'from(bucket:"{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")\
    |> range(start: {inrange})\
    |> filter(fn:(r) => r.bid == "{bid}")\
    |> filter(fn:(r) => r._field == "value")\
    |> aggregateWindow(every: {ourange}, fn: mean, createEmpty: false)'
    result = query_api.query(org=org, query=query)
    group = {}
    for table in result:
         for record in table.records:
            
            
            value = round(record.get_value(), 2)

            unit = record.values.get("unit", "N/A")  # Fetch 'unit' if it exists
            time = record.get_time().strftime("%Y-%m-%d %H:%M:%S")
            logging.debug(f"Value: {value}, Unit: {unit}, Time: {time}")
            if str(time) in group:
                group[str(time)][str(unit)] = value
                logging.debug("time found in the system")
            else:
                group[str(time)] = {str(unit): value}
                logging.debug("time not found in the system")

    results = [{"timestamp": ts, **values} for ts, values in group.items()]
    # Sort list by timestamp
    results.sort(key=lambda x: x["timestamp"])
    return results

def get_meteo_station_data(bid):
    query_api = client.query_api()
    query = f'''from(bucket:"{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
    |> range(start: -10y)
    |> filter(fn:(r) => r.bid == "{bid}")
    |> filter(fn:(r) => r._field == "value")
    |> last()
    '''
    result = query_api.query(org=org, query=query)
    group = {}
    for table in result:
         for record in table.records:
            value = round(record.get_value(), 2)
            unit = record.values.get("unit", "N/A")  # Fetch 'unit' if it exists
            group[str(unit)] = value
            logging.debug(f"unit {unit} value: {value}")

    return group

def get_num_bid():
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
        |> range(start: -30d)  // Adjust time range as needed
        |> distinct(column: "bid")  // Get unique bid values
        |> count()  // Count the number of unique bid values
    '''
    result = query_api.query(query)
    for table in result:
        for record in table.records:
            unique_bids_count = record["_value"]
            logging.debug(f"Number of unique 'bid' values: {unique_bids_count}")


def get_num_id_in_measurement(measurement):
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
        |> range(start: -7y)  // Adjust time range as needed
        |> filter(fn: (r) => r._measurement == "{measurement}")
        |> keep(columns: ["id"])  
        |> distinct(column: "id")
    '''
    count = 0
    result = query_api.query(query)
    unique_ids = {record["_value"] for table in result for record in table.records}
    count = len(unique_ids)
    return count

def get_last_beehive_data(bid):
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
        |> range(start: -10y)  // Adjust as needed
        
        |> filter(fn:(r) => r.bid == "{bid}")
        |> last()  // Get the last record for each sensor
    '''
    tables = query_api.query(query)
    logging.debug(f"debug moment: {tables}")
    beehive_data = {}
    for table in tables:
        for record in table.records:
            bid = record.values.get("bid")
            unit = record.values.get("unit")
            value = record.get_value()
            
            if bid not in beehive_data:
                beehive_data[bid] = {"id": bid}
            
            # Ensure only the last value of each unit type is kept
            beehive_data[bid][unit] = value
    
    return list(beehive_data.values())



def get_last_update_time(measurement):
    logging.debug(f"measurement: {measurement}")
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
        |> range(start: -10y)  // Adjust as needed
        |> filter(fn: (r) => r._measurement == "{measurement}")
        |> filter(fn:(r) => r._field == "value")
        |> last()  // Get the last record for each sensor
    '''
    tables = query_api.query(query)
    time = 0
    for table in tables:
        for record in table.records:
            time = record.get_time().astimezone(ZoneInfo("Europe/Prague"))
    return time




def get_last_single_data(sensor_id, bid):
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv("DOCKER_INFLUXDB_INIT_BUCKET")}")
        |> range(start: -10y)  // Adjust as needed
        |> filter(fn:(r) => r.bid == "{bid}") // filter
        |> filter(fn:(r) => r.id == "{sensor_id}") // 
        |> last()  // Get the last record for each sensor
    '''
    tables = query_api.query(query)
    beehive_data = {}
    for table in tables:
        for record in table.records:
            
            bid = record.values.get("bid")
            unit = record.values.get("unit")
            value = record.get_value()
            time = record.get_time().astimezone(ZoneInfo("Europe/Prague"))
            
            if sensor_id not in beehive_data:
                beehive_data[sensor_id] = {"bid": bid}
            
            # Ensure only the last value of each unit type is kept
            beehive_data[sensor_id]['unit'] = unit
            beehive_data[sensor_id]['value'] = value
            beehive_data[sensor_id]['time'] = time
    
    return list(beehive_data.values())



        


def read_all_sensor_data(id):
    query_api = client.query_api()
    query = f'''
    from(bucket: "{os.getenv('DOCKER_INFLUXDB_INIT_BUCKET')}")
    |> range(start: -5y)  // Adjust time range as needed
    |> filter(fn: (r) => r["id"] == "{id}")
    '''
    result = query_api.query(query)
    return result