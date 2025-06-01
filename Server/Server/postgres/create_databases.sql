      
-- #############################################################################
-- #                                                                           #
-- #      Combined Beekeeping System Initialization Script (Docker Ready)      #
-- #            (Template for use with envsubst)                               #
-- #                                                                           #
-- #############################################################################

\set ON_ERROR_STOP on

-- Explicitly connect to the default 'postgres' database first.
-- This connection allows CREATE DATABASE and CREATE USER commands.
\connect postgres;


-- ========= Create Databases =========
-- These commands should succeed now because we are connected to 'postgres'.
CREATE DATABASE clients_system;
CREATE DATABASE audio_system;
CREATE DATABASE testing;

-- ========= Create Users =========
-- Passwords will be substituted by envsubst from environment variables
CREATE USER client_modifier WITH ENCRYPTED PASSWORD '${POSTGRES_USERS_ACCESS_PASS}';
CREATE USER audio_modifier WITH ENCRYPTED PASSWORD '${POSTGRES_AUDIO_ACCESS_PASS}';
CREATE USER connection_testing WITH ENCRYPTED PASSWORD '${POSTGRES_TEST_PASS}';

-- #############################################################################
-- #                       CLIENTS_SYSTEM Database Objects                     #
-- #############################################################################
-- Now connect to the specific database to create tables and grant permissions within it.
\connect clients_system;


-- Set schema (optional, explicit is good)
SET search_path TO public;

-- ========= CORE ENTITIES ============

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT
);

CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    parent_id TEXT REFERENCES groups(id) ON DELETE SET NULL, -- For main/subgroup hierarchy
    description TEXT,
    location TEXT,
    automatic_mode BOOLEAN NOT NULL DEFAULT FALSE,
    beehive_type TEXT,
    mode TEXT,
    health INTEGER CHECK (health >= 0 AND health <= 100),
    last_inspection DATE,
    is_main BOOLEAN DEFAULT FALSE -- Added DEFAULT FALSE to match model
);

CREATE TABLE schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    season TEXT,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    priority TEXT DEFAULT 'medium',
    recommendations TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completion_date DATE
);

CREATE TABLE schedule_conditions (
    condition_id SERIAL PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    type TEXT,
    operator TEXT,
    value TEXT,
    unit TEXT,
    actual_value TEXT DEFAULT '0',
    last_update TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER,
    duration_unit TEXT,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL
);

CREATE TABLE group_events (
    event_table_id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    event_ref_id TEXT,
    event_date DATE NOT NULL,
    event_type TEXT,
    description TEXT
);

-- ========= AUTHENTICATION, CONFIGURATION & CLIENT/SENSORS SYSTEMS ============

CREATE TABLE users (
   client_id TEXT PRIMARY KEY,                  -- Identifier for web login (e.g., username)
   client_hash TEXT NOT NULL                    -- Hashed password
);

CREATE TABLE available_sensors_database (
   client_id TEXT PRIMARY KEY,                  -- Unique ID for the SENSOR CLIENT SYSTEM
   client_name TEXT NOT NULL,
   client_key_hash TEXT NOT NULL,
   client_last_session TEXT,                    -- Reference to session_auth.session_id (nullable)
   client_active BOOLEAN NOT NULL DEFAULT TRUE, -- Added DEFAULT TRUE to match model
   client_access_key TEXT NOT NULL,
   last_heard_from TIMESTAMPTZ NULL
);

CREATE TABLE session_auth (
   session_id TEXT PRIMARY KEY,
   client_id TEXT NOT NULL REFERENCES available_sensors_database(client_id) ON DELETE CASCADE, -- Link to the SENSOR CLIENT SYSTEM
   session_key_hash TEXT NOT NULL,
   available TEXT NOT NULL,
   session_end TIMESTAMPTZ NOT NULL,
   system_privileges TEXT
);

CREATE TABLE config (
   client_id TEXT PRIMARY KEY REFERENCES available_sensors_database(client_id) ON DELETE CASCADE, -- Link to the SENSOR CLIENT SYSTEM
   system_time_unit TEXT NOT NULL,
   temperature_unit TEXT NOT NULL,
   pressure_unit TEXT NOT NULL,
   voltage_unit TEXT NOT NULL,
   power_unit TEXT NOT NULL,
   speed_unit TEXT NOT NULL,
   weight_unit TEXT NOT NULL,
   sound_pressure_level_unit TEXT NOT NULL,
   network_strenght_unit TEXT NOT NULL, -- Keeping typo as specified initially to match model
   memory_unit TEXT NOT NULL
);

CREATE TABLE sensors (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES available_sensors_database(client_id) ON DELETE NO ACTION, -- Link to the SENSOR CLIENT SYSTEM
    measurement TEXT NOT NULL,
    calibration_value DOUBLE PRECISION,
    last_reading_time TIMESTAMP WITH TIME ZONE NULL,
    last_reading_value DOUBLE PRECISION NULL,
    last_reading_unit TEXT NULL,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL -- Link to the group it monitors
);

CREATE TABLE server_config (
   config_name TEXT PRIMARY KEY,
   units TEXT,
   lowest_acceptable TEXT,
   highest_acceptable TEXT,
   accuracy TEXT,
   value TEXT
);

CREATE TABLE jwt_blocklist (
    id SERIAL PRIMARY KEY,
    jti TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========= RULES ENGINE ============

CREATE TABLE rule_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    logical_operator TEXT NOT NULL DEFAULT 'and',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    applies_to TEXT NOT NULL DEFAULT 'all',
    rule_set_id TEXT REFERENCES rule_sets(id) ON DELETE SET NULL,
    priority INTEGER NOT NULL DEFAULT 5
    -- Removed respects_tag_overrides BOOLEAN NOT NULL DEFAULT TRUE; not in model
);

CREATE TABLE rule_initiators (
    initiator_table_id SERIAL PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    initiator_ref_id TEXT,
    type TEXT NOT NULL DEFAULT '',
    operator TEXT DEFAULT '',
    value NUMERIC DEFAULT 0,
    value2 NUMERIC,
    schedule_type TEXT,
    schedule_value TEXT
);

CREATE TABLE rule_actions (
    action_id SERIAL PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_params JSONB,
    execution_order INTEGER NOT NULL DEFAULT 0
);

-- ========= JUNCTION TABLES (Many-to-Many Relationships) ============

CREATE TABLE schedule_assigned_groups (
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (schedule_id, group_id)
);

CREATE TABLE ruleset_rules (
    ruleset_id TEXT NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    PRIMARY KEY (ruleset_id, rule_id)
);

-- Removed CREATE TABLE rule_specific_groups; it's redundant, use group_rules as per model.

-- Removed CREATE TABLE rule_tags; not defined in models for direct Rule-Tag M2M.

CREATE TABLE initiator_tags (
    initiator_table_id INTEGER NOT NULL REFERENCES rule_initiators(initiator_table_id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (initiator_table_id, tag_id)
);

CREATE TABLE group_rules (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, rule_id)
);

CREATE TABLE group_rule_sets (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    ruleset_id TEXT NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, ruleset_id)
);

CREATE TABLE group_tags (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, tag_id)
);

-- ========= INDEXES (Recommended for Performance) ============

CREATE INDEX idx_groups_parent_id ON groups(parent_id);
CREATE INDEX idx_schedule_conditions_schedule_id ON schedule_conditions(schedule_id);
CREATE INDEX idx_schedule_conditions_group_id ON schedule_conditions(group_id);
CREATE INDEX idx_group_events_group_id ON group_events(group_id);
CREATE INDEX idx_rules_rule_set_id ON rules(rule_set_id);
CREATE INDEX idx_rule_initiators_rule_id ON rule_initiators(rule_id);
CREATE INDEX idx_rule_actions_rule_id ON rule_actions(rule_id);
CREATE INDEX idx_session_auth_client_id ON session_auth(client_id);
CREATE INDEX idx_session_auth_session_end ON session_auth(session_end);
CREATE INDEX idx_sensors_client_id ON sensors(client_id);
CREATE INDEX idx_sensors_group_id ON sensors(group_id);
CREATE INDEX idx_schedule_assigned_groups_group_id ON schedule_assigned_groups(group_id);
CREATE INDEX idx_ruleset_rules_rule_id ON ruleset_rules(rule_id);
-- Removed idx_rule_specific_groups_group_id as table is removed
-- Removed idx_rule_tags_tag_id as table is removed
CREATE INDEX idx_initiator_tags_tag_id ON initiator_tags(tag_id);
CREATE INDEX idx_group_rules_rule_id ON group_rules(rule_id);
CREATE INDEX idx_group_rule_sets_ruleset_id ON group_rule_sets(ruleset_id);
CREATE INDEX idx_group_tags_tag_id ON group_tags(tag_id);
CREATE INDEX idx_groups_type ON groups(type);
CREATE INDEX idx_tags_type ON tags(type);
CREATE INDEX idx_sensors_measurement ON sensors(measurement);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_due_date ON schedules(due_date);
CREATE INDEX idx_rules_is_active ON rules(is_active);
CREATE INDEX idx_rule_actions_action_type ON rule_actions(action_type);
CREATE INDEX idx_rule_initiators_type ON rule_initiators(type);
CREATE INDEX idx_jwt_blocklist_jti ON jwt_blocklist(jti);


-- ========= PRIVILEGES for client_modifier in clients_system =========

GRANT USAGE ON SCHEMA public TO client_modifier;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO client_modifier;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO client_modifier;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO client_modifier;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO client_modifier;


-- #############################################################################
-- #                       AUDIO_SYSTEM Database Objects                       #
-- #############################################################################
-- Connect to the audio database
\connect audio_system;


SET search_path TO public;


CREATE TABLE audio (
   audio_id SERIAL PRIMARY KEY,
   client_id TEXT NOT NULL,
   audio_file_path TEXT NOT NULL
);


-- ========= PRIVILEGES for audio_modifier in audio_system =========

GRANT USAGE ON SCHEMA public TO audio_modifier;
GRANT ALL PRIVILEGES ON TABLE audio TO audio_modifier;
GRANT ALL PRIVILEGES ON SEQUENCE audio_audio_id_seq TO audio_modifier;
-- Optional default privileges if audio_modifier will create objects
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO audio_modifier;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO audio_modifier;


-- #############################################################################
-- #                       TESTING Database Objects                          #
-- #############################################################################
-- Connect to the testing database
\connect testing;


SET search_path TO public;


CREATE TABLE test (
   user_id SERIAL PRIMARY KEY,
   password TEXT NOT NULL
);


-- ========= PRIVILEGES for connection_testing in testing =========

GRANT USAGE ON SCHEMA public TO connection_testing;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE test TO connection_testing;
GRANT USAGE, SELECT ON SEQUENCE test_user_id_seq TO connection_testing;


-- #############################################################################
-- #                       End of Script                                       #
-- #############################################################################
-- No need to explicitly disconnect, the script runner handles it.



-- End of Script --
