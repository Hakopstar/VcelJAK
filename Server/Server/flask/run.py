###############################################################################
# Initiating file of flask
# Version v0.95
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
    os.environ['REDIS_HOST'] = "localhost"
    os.environ['DATABASE_URL'] = "http://postgres:5544"
    os.environ['PRODUCTION'] = "0"
    print(f"postgres: {os.getenv('POSTGRES_PORT')}")



# Start logging, diagnostics and test function of postgres
print("Starting init")
import init
import os
init.start()





# APP INIT

# Importing app modules
try:
    from app import create_app, Flask
except Exception as err:
    print("COMPILE FAILED!")
    print(err)
    raise Exception(f"COMPILE FAILED {err}")

app = create_app()

if __name__ == "__main__":
    print("NAME:", __name__)
    print("Warning: Flask started in main mode, not recommended! check if all parameters are set correctly!")
    Flask.run(app, host='0.0.0.0', port=5012) #Socket IO will be added, when I fcking implement the broadcasting mechanism lol.
