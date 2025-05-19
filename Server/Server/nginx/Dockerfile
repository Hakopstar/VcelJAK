###################################
# Building file of NGINX Container
# Last version of update: v0.81

###################################
# Use the Nginx image
FROM nginx

# Remove the default nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

# Replace with ours
COPY nginx.conf /etc/nginx/conf.d/

COPY localhost-key.pem /etc/nginx/certs/
COPY localhost.pem /etc/nginx/certs/