      
#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
REPO_URL="https://github.com/Hakopstar/VcelJAK"
PROJECT_ROOT_DIR="VcelJAK_project" # The top-level directory where the repo is cloned
SERVICE_DIR_PATH="${PROJECT_ROOT_DIR}/Server/Server" # Path to docker-compose.yml, .env, and start.sh

ENV_FILE_PATH="${SERVICE_DIR_PATH}/.env"
START_SH_PATH="${SERVICE_DIR_PATH}/start.sh"

# --- Helper Functions ---
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

generate_key() {
    openssl rand -hex 32 # Generates 64 hex characters, single line
}

generate_base64_key() {
    openssl rand -base64 "$1" | tr -d '\n' # Ensure single line for base64 output
}

# --- Sanity Checks ---
if ! command_exists git; then
    echo "Error: git is not installed. Please install git and try again."
    exit 1
fi

if ! command_exists openssl; then
    echo "Error: openssl is not installed. It's required for generating secret keys. Please install openssl and try again."
    exit 1
fi

# --- Main Installation Logic ---
echo "Starting installation for VcelJAK..."

if [ -d "$PROJECT_ROOT_DIR" ]; then
    echo "Project root directory '$PROJECT_ROOT_DIR' already exists. Skipping clone."
else
    echo "Cloning repository $REPO_URL into $PROJECT_ROOT_DIR..."
    git clone "$REPO_URL" "$PROJECT_ROOT_DIR"
fi

# Ensure the target Server/Server directory exists after cloning
if [ ! -d "$SERVICE_DIR_PATH" ]; then
    echo "Service directory '${SERVICE_DIR_PATH}' does not exist after clone. Creating it..."
    mkdir -p "$SERVICE_DIR_PATH"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create directory '$SERVICE_DIR_PATH'. Please check permissions."
        exit 1
    fi
    echo "Directory '$SERVICE_DIR_PATH' created."
fi


# Check if .env file already exists inside the service directory
if [ -f "$ENV_FILE_PATH" ]; then
    echo "Environment file '$ENV_FILE_PATH' already exists. Skipping generation."
    echo "If you need to reconfigure, please remove the existing '$ENV_FILE_PATH' and run this script again."
else
    echo "--------------------------------------------------------------------"
    echo "Creating environment file '$ENV_FILE_PATH'..."
    echo "You will be prompted for essential passwords."
    echo "Other configuration options will be set to default values."
    echo "You can manually edit these defaults in the '$ENV_FILE_PATH' file after generation if needed."
    echo "The .env file will follow strict KEY=VALUE formatting per line."
    echo "--------------------------------------------------------------------"
    sleep 2

    # --- User Input for Passwords ---
    echo "Please provide the following passwords. Press Enter for an empty password (not recommended for production)."

    read -sp "Enter password for InfluxDB admin user (DOCKER_INFLUXDB_INIT_PASSWORD): " DOCKER_INFLUXDB_INIT_PASSWORD
    echo
    if [ -z "$DOCKER_INFLUXDB_INIT_PASSWORD" ]; then echo "Warning: Using empty InfluxDB password."; fi

    read -sp "Enter password for PostgreSQL (DOCKER_POSTGRES_PASSWORD): " DOCKER_POSTGRES_PASSWORD
    echo
    if [ -z "$DOCKER_POSTGRES_PASSWORD" ]; then echo "Warning: Using empty PostgreSQL password."; fi

    read -sp "Enter password for PostgreSQL Audio Access (POSTGRES_AUDIO_ACCESS_PASS): " POSTGRES_AUDIO_ACCESS_PASS
    echo
    if [ -z "$POSTGRES_AUDIO_ACCESS_PASS" ]; then echo "Warning: Using empty PostgreSQL Audio Access password."; fi

    read -sp "Enter password for PostgreSQL Users Access (POSTGRES_USERS_ACCESS_PASS): " POSTGRES_USERS_ACCESS_PASS
    echo
    if [ -z "$POSTGRES_USERS_ACCESS_PASS" ]; then echo "Warning: Using empty PostgreSQL Users Access password."; fi

    read -sp "Enter password for PostgreSQL Test User (POSTGRES_TEST_PASS): " POSTGRES_TEST_PASS
    echo
    if [ -z "$POSTGRES_TEST_PASS" ]; then echo "Warning: Using empty PostgreSQL Test User password."; fi

    read -p "Enter username for Webpage Admin (WEBPAGE_USER) [default: admin]: " WEBPAGE_USER
    WEBPAGE_USER=${WEBPAGE_USER:-admin}

    read -sp "Enter password for Webpage Admin (WEBPAGE_PASS): " WEBPAGE_PASS
    echo
    if [ -z "$WEBPAGE_PASS" ]; then echo "Warning: Using empty Webpage Admin password."; fi


    # --- Key Generation ---
    echo ""
    echo "Generating unique secret keys (will be single-line values)..."
    DIGEST_SECRET_KEY=$(generate_base64_key 32)
    SECRET_REGISTER_API_KEY=$(generate_base64_key 64)
    JWT_SECRET_KEY=$(generate_key) # This is hex, already single line
    DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=$(generate_base64_key 48)
    NEXTAUTH_SECRET=$(generate_base64_key 32)
    echo "Secret keys generated."

    # --- Default values that the user can change later ---
    echo ""
    echo "The following values will be set to defaults in the .env file:"
    echo "  - FLASK_DEBUG: 10"
    echo "  - NUMBER_PRECISION: 2"
    echo "  - HARDWARE_SESSION_EXPIRE: 86000"
    # ... (other defaults listed before)
    echo "You can change these in '$ENV_FILE_PATH' after this script finishes."
    echo "--------------------------------------------------------------------"
    sleep 1


    # --- Create .env file ---
    # Ensures strict KEY=VALUE format, comments on separate lines.
    cat << EOF > "$ENV_FILE_PATH"
######################################################
# Environment Variable File for VcelJAK Backend
# Generated by install.sh
#
# IMPORTANT:
# Review and customize the default values below if needed,
# especially for production environments.
# Passwords were set by you during installation.
# Secret Keys were auto-generated.
# Ensure each variable is on a single line: KEY=VALUE
#######################################################

# System Version (Default, editable)
SYSTEM_VERSION=0.91
API_VERSION=3.1

# MEMCACHE (Defaults, editable)
#########################################################################
MEMCACHE_PORT='11211'
MEMCACHE_HOST='memcached'

# FLASK
#########################################################################
# LOG FLASK PRIORITY: 10 - all messages, 20 - info and higher, 30 - warning and higher, 40 - error and higher, 50 - critical and higher
FLASK_DEBUG=10
# Auto-generated secret key for Flask message digesting
DIGEST_SECRET_KEY=${DIGEST_SECRET_KEY}
# Auto-generated secret key for API registration
SECRET_REGISTER_API_KEY=${SECRET_REGISTER_API_KEY}
# Auto-generated secret key for JWT
JWT_SECRET_KEY=${JWT_SECRET_KEY}
# URL for InfluxDB (Default, editable)
INFLUXDB_URL=http://influxdb:8086
# Webpage admin credentials (User-defined)
WEBPAGE_USER=${WEBPAGE_USER}
WEBPAGE_PASS=${WEBPAGE_PASS}

# Variables (Defaults, editable)
# Number precision for display
NUMBER_PRECISION=2
# Hardware session expiration time in seconds
HARDWARE_SESSION_EXPIRE=86000

##########################################################################
# DATABASE SECTION :
###############################

################
# INFLUXDB SETUP
# DOCKER_INFLUXDB_INIT_MODE: Set to 'setup' for initial setup (Default, editable)
DOCKER_INFLUXDB_INIT_MODE=setup
# DOCKER_INFLUXDB_INIT_USERNAME: Admin username for InfluxDB (Default, editable)
DOCKER_INFLUXDB_INIT_USERNAME=admin
# DOCKER_INFLUXDB_INIT_PASSWORD: Admin password for InfluxDB (User-defined)
DOCKER_INFLUXDB_INIT_PASSWORD=${DOCKER_INFLUXDB_INIT_PASSWORD}
# DOCKER_INFLUXDB_INIT_ORG: Initial organization for InfluxDB (Default, editable)
DOCKER_INFLUXDB_INIT_ORG=beehivegjak
# DOCKER_INFLUXDB_INIT_BUCKET: Initial bucket for InfluxDB (Default, editable)
DOCKER_INFLUXDB_INIT_BUCKET=main
# DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: Admin token for InfluxDB (Auto-generated)
DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${DOCKER_INFLUXDB_INIT_ADMIN_TOKEN}
###################

###################
# POSTGRESQL Setup
# POSTGRES_PORT: Port for PostgreSQL (Default, editable)
POSTGRES_PORT=5432
# POSTGRES_HOST: Hostname for PostgreSQL service (Default, editable)
POSTGRES_HOST=postgres
# DOCKER_POSTGRES_PASSWORD: Root password for PostgreSQL (User-defined)
DOCKER_POSTGRES_PASSWORD=${DOCKER_POSTGRES_PASSWORD}
# POSTGRES_AUDIO_ACCESS_PASS: Password for audio access user (User-defined)
POSTGRES_AUDIO_ACCESS_PASS=${POSTGRES_AUDIO_ACCESS_PASS}
# POSTGRES_USERS_ACCESS_PASS: Password for general users access (User-defined)
POSTGRES_USERS_ACCESS_PASS=${POSTGRES_USERS_ACCESS_PASS}
# POSTGRES_TEST_PASS: Password for test user (User-defined)
POSTGRES_TEST_PASS=${POSTGRES_TEST_PASS}
###################

##########################################################################
# NEXTJS SETUP
# NEXT_PUBLIC_WEBSITE_URL: Public URL for NextJS frontend (Default, editable)
NEXT_PUBLIC_WEBSITE_URL="https://localhost:8443"
# NEXTAUTH_URL: Internal URL for NextAuth (Default, editable)
NEXTAUTH_URL="https://localhost:8443"
# NEXTAUTH_SECRET: Secret for NextAuth (Auto-generated)
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
# NODE_TLS_REJECT_UNAUTHORIZED: Set to 1 in production. 0 disables TLS cert validation (Default, editable)
# WARNING: NODE_TLS_REJECT_UNAUTHORIZED=0 is insecure for production environments.
NODE_TLS_REJECT_UNAUTHORIZED=0
##########################################################################
EOF

    chmod 600 "$ENV_FILE_PATH"
    echo ""
    echo "--------------------------------------------------------------------"
    echo "Environment file '$ENV_FILE_PATH' created successfully with strict KEY=VALUE formatting."
    echo "Passwords and unique keys have been set."
    echo ""
    echo "REMINDER: You can now manually edit '$ENV_FILE_PATH' to change default values for parameters"
    echo "like FLASK_DEBUG, NUMBER_PRECISION, URLs, etc., as needed."
    echo "Ensure any changes maintain the 'KEY=VALUE' format per line without trailing characters."
    echo "--------------------------------------------------------------------"
fi


# --- Create start.sh inside the service directory ---
# (Content of start.sh generation remains the same as it was already good)
echo "Creating start.sh script at ${START_SH_PATH}..."
cat << 'EOF_START_SH' > "$START_SH_PATH"
#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
ENV_FILE=".env" # Assumes .env is in the current directory
DOCKER_COMPOSE_FILE="docker-compose.yml" # Default, will check for .yaml too

# --- Helper Functions ---
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Determine Docker Compose command
COMPOSE_CMD=""
if command_exists docker-compose; then
    COMPOSE_CMD="docker-compose"
elif command_exists docker && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo "Error: Neither 'docker-compose' nor 'docker compose' (v2) command found."
    echo "Please install Docker and Docker Compose."
    exit 1
fi

# --- Sanity Checks ---
if ! command_exists docker; then
    echo "Error: docker is not installed. Please install docker and try again."
    exit 1
fi

# --- Main Start Logic ---
echo "Starting VcelJAK application from $(pwd)..."

# Check for docker-compose file (common variations)
if [ -f "docker-compose.yml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose.yml"
elif [ -f "docker-compose.yaml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose.yaml"
else
    echo "Error: Neither 'docker-compose.yml' nor 'docker-compose.yaml' found in the current directory ($(pwd))."
    echo "Please ensure your Docker Compose file is named correctly and you are in the 'Server/Server' directory."
    exit 1
fi
echo "Using Docker Compose file: $DOCKER_COMPOSE_FILE"


if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file '$ENV_FILE' not found in $(pwd)."
    echo "If you ran install.sh, it should have been created here. Please check."
    exit 1
fi

echo "Found '$ENV_FILE' and '$DOCKER_COMPOSE_FILE'."

echo "Bringing up Docker containers (will build if necessary)..."
# The '--build' flag ensures images are built if they don't exist or if Dockerfile/context changes.
# The '-d' flag runs containers in detached mode.
${COMPOSE_CMD} -f "${DOCKER_COMPOSE_FILE}" --env-file "${ENV_FILE}" up --build -d

echo ""
echo "VcelJAK application should be starting up."
echo "You can check the status of the containers with: ${COMPOSE_CMD} -f \"${DOCKER_COMPOSE_FILE}\" ps"
echo "And view logs with: ${COMPOSE_CMD} -f \"${DOCKER_COMPOSE_FILE}\" logs -f <service_name>"
EOF_START_SH

chmod +x "$START_SH_PATH"
echo "'start.sh' created successfully at ${START_SH_PATH} and made executable."

echo ""
echo "--------------------------------------------------------------------"
echo "Installation complete."
echo "To start the application:"
echo "1. IMPORTANT: If you wish to change any default configurations (like FLASK_DEBUG, etc.),"
echo "   edit the file now: ${ENV_FILE_PATH}"
echo "   Ensure you maintain the KEY=VALUE format without extra characters on the lines."
echo "2. Navigate to the service directory: cd ${SERVICE_DIR_PATH}"
echo "3. Run the start script: ./start.sh"
echo "--------------------------------------------------------------------"

    