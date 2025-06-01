####################################################
# SSE management
# Last version of update: v0.95
# app/sse.py
####################################################

import os
import json
import redis
import gevent
from flask import Blueprint, Response, stream_with_context

# -----------------------------------------------------------------------------
# 1. Initialize Redis client (import time)
# -----------------------------------------------------------------------------
r = redis.Redis.from_url(f"redis://{os.getenv('REDIS_HOST')}:{os.getenv('REDIS_PORT')}/{os.getenv('REDIS_DB')}", decode_responses=True)

# -----------------------------------------------------------------------------
# 2. Initial SSE state
# -----------------------------------------------------------------------------
INITIAL_STATE = {
    "humidity": 0,
    "temperature": 0,
    "wind_speed": 0,
    "health_value": 0,
    "tips": []
}
# Store initial state in Redis if not already present
if not r.exists('sse_data'):
    r.set('sse_data', json.dumps(INITIAL_STATE))

# -----------------------------------------------------------------------------
# 3. Blueprint setup
# -----------------------------------------------------------------------------
sse_bp = Blueprint('sse', __name__, url_prefix='/sse')
CHANNEL = 'sse_channel'

@sse_bp.route('/stream')
def stream():
    """
    SSE endpoint that streams updates to connected clients
    by subscribing to a Redis Pub/Sub channel.
    """
    def event_stream():
        # 3.1 Send current state snapshot
        last_state = json.loads(r.get('sse_data'))
        yield f"data: {json.dumps(last_state)}\n\n"

        # 3.2 Subscribe to Redis channel for updates
        pubsub = r.pubsub(ignore_subscribe_messages=True)
        pubsub.subscribe(CHANNEL)

        # 3.3 Listen for new messages
        for message in pubsub.listen():
            # message['data'] is the JSON-stringified new state
            try:
                data = message['data']
                yield f"data: {data}\n\n"
            except Exception:
                # Skip invalid or non-data messages
                continue

    # Use stream_with_context to ensure request context stays alive
    return Response(stream_with_context(event_stream()),
                    mimetype="text/event-stream")

def update_sse(new_data):
    """
    Update the shared SSE state in Redis and publish
    the full updated state to subscribers.
    """
    # 4.1 Load current state and merge updates
    state = json.loads(r.get('sse_data'))
    state.update(new_data)

    # 4.2 Store updated state
    r.set('sse_data', json.dumps(state))

    # 4.3 Publish to all subscribers
    r.publish(CHANNEL, json.dumps(state))
