/*
   Create Databases System 
   Last version of update: v0.81

*/

/*    Create Databases    */
CREATE DATABASE clients_system;
CREATE DATABASE audio_system;
CREATE DATABASE testing;

/*       Create Users      */

CREATE USER client_modifier WITH ENCRYPTED PASSWORD '$POSTGRES_USERS_ACCESS_PASS';
CREATE USER audio_modifier WITH ENCRYPTED PASSWORD '$POSTGRES_AUDIO_ACCESS_PASS';
CREATE USER connection_testing WITH ENCRYPTED PASSWORD '$POSTGRES_TEST_PASS';




/*    Create Tables     */

/*    Client System    */
\connect clients_system;
CREATE TABLE session_auth (
   client_id TEXT NOT NULL,
   session_id TEXT PRIMARY KEY,
   session_key_hash TEXT NOT NULL,
   available TEXT NOT NULL,
   session_end TEXT NOT NULL, 
   system_privileges TEXT NOT NULL
);

CREATE TABLE available_sensors_database(
   client_id TEXT PRIMARY KEY,
   client_name TEXT NOT NULL,
   client_key_hash TEXT NOT NULL,
   client_last_session TEXT NOT NULL,
   client_active TEXT NOT NULL,
   client_access_key TEXT NOT NULL
);

CREATE TABLE config (
   client_id TEXT PRIMARY KEY,
   system_time_unit TEXT NOT NULL,
   temperature_unit TEXT NOT NULL,
   pressure_unit TEXT NOT NULL,
   voltage_unit TEXT NOT NULL,
   power_unit TEXT NOT NULL,
   speed_unit TEXT NOT NULL,
   weight_unit TEXT NOT NULL,
   sound_pressure_level_unit TEXT NOT NULL,
   network_strenght_unit TEXT NOT NULL,
   memory_unit TEXT NOT NULL
);


CREATE TABLE server_config (
   config_name TEXT PRIMARY KEY,
   units TEXT,
   lowest_acceptable TEXT,
   highest_acceptable TEXT,
   accuracy TEXT,
   value Text
);


CREATE TABLE users(
   client_id TEXT PRIMARY KEY,
   client_hash TEXT NOT NULL
);

CREATE TABLE jwt_blocklist (
    id SERIAL PRIMARY KEY,
    jti TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE beehives (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    last_inspection TEXT NOT NULL
);

CREATE TABLE sensors (
    id TEXT PRIMARY KEY,  -- String sensor ID
    client_id TEXT NOT NULL,  -- Client ID associated with the sensor
    measurement TEXT NOT NULL,  -- Type of measurement (e.g., temperature, humidity)
    calibration_value DOUBLE PRECISION,  -- Optional calibration value
    beehive_id INTEGER REFERENCES beehives(id) ON DELETE CASCADE
);


/*    PRIVILEGES   */
GRANT ALL PRIVILEGES ON DATABASE clients_system TO client_modifier;
GRANT ALL PRIVILEGES ON session_auth TO client_modifier;
GRANT ALL PRIVILEGES ON config TO client_modifier;
GRANT ALL PRIVILEGES ON available_sensors_database TO client_modifier;
GRANT ALL PRIVILEGES ON users TO client_modifier;
GRANT ALL PRIVILEGES ON jwt_blocklist TO client_modifier;
GRANT ALL PRIVILEGES ON beehives TO client_modifier;
GRANT ALL PRIVILEGES ON sensors TO client_modifier;
GRANT ALL PRIVILEGES ON server_config TO client_modifier;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE jwt_blocklist_id_seq TO client_modifier;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE beehives_id_seq TO client_modifier;


/*    Audio System   */
\connect audio_system;
CREATE TABLE audio (
   audio_id SERIAL PRIMARY KEY,
   client_id TEXT NOT NULL,
   audio_file_path TEXT NOT NULL
);

/*    PRIVILEGES   */
GRANT ALL PRIVILEGES ON DATABASE audio_system TO audio_modifier;
GRANT ALL PRIVILEGES ON audio TO audio_modifier;





/*    Connection Testing System   */
\connect testing;
CREATE TABLE test (
   user_id SERIAL PRIMARY KEY,
   password TEXT NOT NULL
);
GRANT CONNECT ON DATABASE testing TO connection_testing;
\connect postgres;