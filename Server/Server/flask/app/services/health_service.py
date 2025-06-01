##################################
# Health service
# Last version of update: v0.95
# app/services/health_service.py
##################################

import redis
from app.sse import update_sse

def update_health(group_id: str, group_health_number: float, rc: redis.Redis) -> float:
    """
    Store or update the health number for `group_id` in Redis,
    then compute and return the average health over all groups.
    """
    #    Example Redis command: HSET group_health "group42" "78.5"
    rc.hset("group_health", group_id, group_health_number)

    #    HVALS returns a list of strings (each field’s value).
    raw_values = rc.hvals("group_health")
    # If there are no values for some reason, avoid ZeroDivisionError:
    if not raw_values:
        return 0.0

    # 3) Convert each to float and compute the average
    #    (You could use int(...) if you only ever store integers.)
    try:
        nums = [float(x) for x in raw_values]
    except ValueError:
        # In case some value in Redis is not parseable as float
        raise RuntimeError("Found non‐numeric health values in Redis hash")

    total = sum(nums)
    count = len(nums)
    average = total / count
    update_sse({"health_value": average})
    return