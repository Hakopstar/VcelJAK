#####################################
# init/first_init/user_add
# Adding user from default config
# Last version of update: v0.95

#####################################


def create_default_webpage_user():
    """
    Creating new user from default_config.json
    - Short description
    """

    import bcrypt
    import os
    import psycopg
    import logging

    # Generated salt, hash the password and store it into database
    salt = bcrypt.gensalt()
    hashed_key = bcrypt.hashpw(os.getenv("WEBPAGE_PASS").encode('utf-8'), salt)
    try:
        logging.debug("Adding default user:")
        #TODO: REMOVE THE DEBUG OF PASSWORD AND USER
        logging.debug(f"User: {os.getenv('WEBPAGE_USER')} pass: {os.getenv('WEBPAGE_PASS')}")
        conn = psycopg.connect(
                host=os.getenv('POSTGRES_HOST'),
                port=os.getenv('POSTGRES_PORT'),
                dbname='clients_system',
                user='client_modifier',
                password=os.getenv('POSTGRES_USERS_ACCESS_PASS'))
        with conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO users (client_id, client_hash) VALUES (%s, %s)",
                (os.getenv("WEBPAGE_USER"), hashed_key.decode('utf-8')))
                conn.commit()
                        
        logging.info("DEFAULT - Webpage user added!")
        return True
    except Exception as err:
        logging.error(f"Something went wrong: Error: {err}")
        return False