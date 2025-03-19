#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage information
show_usage() {
  echo -e "${BLUE}Alternate Earth Development Environment${NC}"
  echo ""
  echo "Usage: ./dev.sh [command]"
  echo ""
  echo "Commands:"
  echo "  start       - Start all services with Docker Compose"
  echo "  stop        - Stop all services"
  echo "  restart     - Restart all services"
  echo "  logs        - View logs from all services"
  echo "  server-logs - View only server logs"
  echo "  client-logs - View only client logs"
  echo "  db-logs     - View only database logs"
  echo "  redis-logs  - View only Redis logs"
  echo "  status      - Check status of all services"
  echo "  health-check- Check server health and diagnose issues"
  echo "  clean       - Remove local .pnpm-store directory"
  echo "  reset       - Reset development environment (WARNING: Deletes volumes)"
  echo "  help        - Show this help"
  echo ""
}

# Function to check if docker-compose is installed
check_docker() {
  if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed or not in PATH.${NC}"
    echo "Please install Docker Compose to use this script."
    exit 1
  fi
}

# Function to start all services
start_services() {
  echo -e "${YELLOW}Starting Alternate Earth development environment...${NC}"
  
  # First clean up any local .pnpm-store directories
  clean_pnpm_store
  
  docker compose up -d
  
  # Wait for services to be ready
  echo -e "${YELLOW}Waiting for services to be ready...${NC}"
  sleep 5
  
  # Check status
  docker compose ps
  
  echo -e "\n${GREEN}Development environment is running!${NC}"
  echo -e "Server API: ${BLUE}http://localhost:3000${NC}"
  echo -e "Client App: ${BLUE}http://localhost:5173${NC}"
  echo -e "Health Check: ${BLUE}http://localhost:3000/health${NC}"
  echo -e "WebSocket Monitor: ${BLUE}http://localhost:3000/monitor${NC}"
}

# Function to stop all services
stop_services() {
  echo -e "${YELLOW}Stopping Alternate Earth development environment...${NC}"
  docker compose down
  echo -e "${GREEN}Development environment stopped.${NC}"
}

# Function to restart all services
restart_services() {
  echo -e "${YELLOW}Restarting Alternate Earth development environment...${NC}"
  docker compose restart
  echo -e "${GREEN}Development environment restarted.${NC}"
}

# Function to view logs
view_logs() {
  echo -e "${YELLOW}Viewing logs from all services...${NC}"
  docker compose logs -f
}

# Function to view specific service logs
view_service_logs() {
  local service=$1
  echo -e "${YELLOW}Viewing logs from ${service}...${NC}"
  docker compose logs -f "${service}"
}

# Function to check status
check_status() {
  echo -e "${YELLOW}Checking status of all services...${NC}"
  docker compose ps
}

# Function to run a health check
run_health_check() {
  echo -e "${YELLOW}Running health checks on server...${NC}"
  
  # Check if server container is running
  echo -e "${BLUE}Checking server container status...${NC}"
  if [ "$(docker ps -q -f name=aeserver)" ]; then
    echo -e "${GREEN}Server container is running.${NC}"
  else
    echo -e "${RED}Server container is not running!${NC}"
    exit 1
  fi
  
  # Test database connection from server
  echo -e "\n${BLUE}Testing database connection...${NC}"
  DB_TEST=$(docker exec -it aeserver sh -c "node -e \"const { Client } = require('pg'); const client = new Client({ connectionString: 'postgres://postgres:postgres@aepg:5432/ae' }); client.connect().then(() => console.log('Connected to DB successfully')).catch(e => console.error('Failed to connect:', e.message)); setTimeout(() => client.end(), 1000);\"" 2>&1)
  
  if echo "$DB_TEST" | grep -q "Connected to DB successfully"; then
    echo -e "${GREEN}Database connection successful.${NC}"
  else
    echo -e "${RED}Database connection failed:${NC}"
    echo "$DB_TEST"
  fi
  
  # Test Redis connection from server
  echo -e "\n${BLUE}Testing Redis connection...${NC}"
  REDIS_TEST=$(docker exec -it aeserver sh -c "node -e \"const Redis = require('ioredis'); const client = new Redis({ host: 'aeredis', port: 6379, password: 'redis' }); client.ping().then((result) => console.log('Redis ping response:', result)).catch(e => console.error('Failed to connect to Redis:', e.message)); setTimeout(() => client.quit(), 1000);\"" 2>&1)
  
  if echo "$REDIS_TEST" | grep -q "Redis ping response: PONG"; then
    echo -e "${GREEN}Redis connection successful.${NC}"
  else
    echo -e "${RED}Redis connection failed:${NC}"
    echo "$REDIS_TEST"
  fi
  
  # Test HTTP endpoints
  echo -e "\n${BLUE}Testing server HTTP endpoints...${NC}"
  HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>&1)
  
  if [ "$HTTP_TEST" = "200" ]; then
    echo -e "${GREEN}Server is responding to HTTP requests.${NC}"
    
    # Get details from health endpoint
    HEALTH_DETAILS=$(curl -s http://localhost:3000/health)
    echo -e "${BLUE}Health endpoint details:${NC}"
    echo "$HEALTH_DETAILS" | grep -o '"status":"[^"]*"' | head -1
    echo "$HEALTH_DETAILS" | grep -o '"database":{"status":"[^"]*"'
    echo "$HEALTH_DETAILS" | grep -o '"redis":{"status":"[^"]*"'
  else
    echo -e "${RED}Server is not responding properly to health endpoint! Status: $HTTP_TEST${NC}"
  fi
  
  echo -e "\n${BLUE}Health check completed.${NC}"
}

# Function to reset the development environment
reset_environment() {
  echo -e "${RED}WARNING: This will delete all volumes and data.${NC}"
  read -p "Are you sure you want to continue? (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Resetting development environment...${NC}"
    docker compose down -v
    
    # Clean up any local .pnpm-store directories
    clean_pnpm_store
    
    echo -e "${GREEN}Environment reset. All volumes have been removed.${NC}"
  else
    echo -e "${YELLOW}Reset canceled.${NC}"
  fi
}

# Function to clean up local pnpm store
clean_pnpm_store() {
  echo -e "${YELLOW}Checking for local .pnpm-store directories...${NC}"
  
  local found=false
  
  # Check root directory
  if [ -d ".pnpm-store" ]; then
    echo -e "Found ${RED}.pnpm-store${NC} in project root"
    found=true
  fi
  
  # Check subdirectories
  for dir in "server" "client" "shared"; do
    if [ -d "$dir/.pnpm-store" ]; then
      echo -e "Found ${RED}.pnpm-store${NC} in $dir directory"
      found=true
    fi
  done
  
  if [ "$found" = true ]; then
    echo -e "${YELLOW}Removing local .pnpm-store directories...${NC}"
    rm -rf .pnpm-store server/.pnpm-store client/.pnpm-store shared/.pnpm-store
    echo -e "${GREEN}Removed all local .pnpm-store directories.${NC}"
  else
    echo -e "${GREEN}No local .pnpm-store directories found.${NC}"
  fi
}

# Main script logic
check_docker

# Parse command-line arguments
case "$1" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services
    ;;
  logs)
    view_logs
    ;;
  server-logs)
    view_service_logs "server"
    ;;
  client-logs)
    view_service_logs "client"
    ;;
  db-logs)
    view_service_logs "postgres"
    ;;
  redis-logs)
    view_service_logs "redis"
    ;;
  status)
    check_status
    ;;
  health-check)
    run_health_check
    ;;
  clean)
    clean_pnpm_store
    ;;
  reset)
    reset_environment
    ;;
  help|*)
    show_usage
    ;;
esac 