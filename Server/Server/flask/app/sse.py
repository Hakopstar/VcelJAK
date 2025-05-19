import json
import queue
from flask import Blueprint, Response, stream_with_context, request
from app.db_man.multidb_func import get_all_measurement, get_last_sensor_data
import logging
import time
import gevent
import flask
from app.db_man.memcache.mem_engine import mc

# Create a blueprint for SSE with URL prefix '/sse'
sse_bp = Blueprint('sse', __name__, url_prefix='/sse')

# Global SSE data state matching the Next.js component's requirements.
sse_data = {
    "health_value": 0,  # example initial value
    "humidity": 0,       # percentage
    "temperature": 0,  # Celsius
    "wind_speed": 0,    # m/s
    "tips": []
}


# List to store each subscriber's message queue.


mc.set('sse_data', sse_data)

@sse_bp.route('/stream')
def stream():
    """
    SSE endpoint that streams updates to connected clients.
    This endpoint polls memcached for changes to the state.
    """
    def event_stream():
        # Get the current state from memcached.
        last_data = mc.get('sse_data')
        yield f"data: {json.dumps(last_data)}\n\n"
        while True:
            gevent.sleep(10)  # poll every second; adjust the interval as needed
            current_data = mc.get('sse_data')
            if current_data != last_data:
                last_data = current_data
                yield f"data: {json.dumps(current_data)}\n\n"
    return Response(event_stream(), mimetype="text/event-stream")


def update_sse(new_data):
    """
    Function to update the shared sse_data.
    This can be called from any part of your system.
    Example: update_sse({"tips": ["New tip"]})
    """
    global sse_data
    sse_data.update(new_data)
    mc.set('sse_data', sse_data)