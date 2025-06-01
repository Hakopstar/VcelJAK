# Use the official Redis image as a base
FROM redis:6.2-alpine

# Copy your custom configuration into the container
COPY redis.conf /usr/local/etc/redis/redis.conf

# (Optional) Declare a data volume for persistence
VOLUME ["/data"]

# Start Redis with your config
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]