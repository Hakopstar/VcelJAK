###############################################
# Building file of Flask Container
# Last version of update: v0.81

###############################################

# Use the 
FROM python:3.11.4

# Set the working directory to /app
WORKDIR /app

# Copy the current direcotry contents into the container at /app
ADD . /app

# Install the dependencies
RUN pip install -r requirements.txt

# run the command to start uWSGI
CMD ["uwsgi", "app.ini"]