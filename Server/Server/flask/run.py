###############################################################################
# Initiating file of flask
# Version v0.81
# The initiator of Flask in Container, Initiating main __init__.py in ./app
###############################################################################
# Install requirements: pip install -r requirements.txt
# Update requirements:  pip freeze > requirements.txt


# Main Program - loading enviroment variables

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv

    load_dotenv()
    print(f"postgres: {os.getenv('POSTGRES_PORT')}")
    os.environ['POSTGRES_HOST'] = "localhost"
    os.environ['POSTGRES_PORT'] = "5544"
    os.environ['INFLUXDB_URL'] = "http://localhost:8087/"
    os.environ['MEMCACHE_HOST'] = "localhost"
    print(f"postgres: {os.getenv('POSTGRES_PORT')}")


# Importing app modules
try:
    from app import create_app, socketio
    from app.repeir import test_postgres, start_logging, module_diagnostics, config_options
except Exception as err:
    print("COMPILE FAILED!")
    print(err)
    raise Exception(f"COMPILE FAILED {err}")




# Start logging, diagnostics and test function of postgres
start_logging()
module_diagnostics()
test_postgres()
config_options()

# APP INIT

app = create_app()

if __name__ == "__main__":
    print("NAME:", __name__)
    print("Warning: Flask started in main mode, not recommended! check if all parameters are set correctly!")
    socketio.run(app, host='0.0.0.0', port=5012) #Socket IO will be added, when I fcking implement the broadcasting mechanism lol.