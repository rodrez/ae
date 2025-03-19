# Alternate Earth

An MMO game set in an alternate version of Earth.

## Development Environment

### Prerequisites

- Docker and Docker Compose
- Node.js (for local development without Docker)
- PNPM package manager

### Docker Compose Development Setup (Recommended)

The easiest way to run the entire development environment is using the included Docker Compose configuration. This will start:

1. PostgreSQL database
2. Redis instance
3. Server with hot-reloading
4. Client development server with hot-reloading

#### Using the Development Script

We've included a convenience script to manage the development environment:

```bash
# Make the script executable (first time only)
chmod +x dev.sh

# Show available commands
./dev.sh help

# Start all services
./dev.sh start

# View logs from all services
./dev.sh logs

# View logs from just the server
./dev.sh server-logs

# Stop all services
./dev.sh stop
```

#### Manual Docker Compose Commands

If you prefer to use Docker Compose directly:

```bash
# Start all services in the background
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Local Development (Without Docker)

If you prefer to run services directly on your machine:

1. **Database & Redis**: You still need PostgreSQL and Redis running. You can either:
   - Run them in Docker: `docker compose up -d postgres redis`
   - Install and run them locally

2. **Server**:
   ```bash
   cd server
   cp .env.local .env  # Use local connection settings
   pnpm install
   pnpm run dev
   ```

3. **Client**:
   ```bash
   cd client
   pnpm install
   pnpm run dev
   ```

## Project Structure

- `/server` - Backend services and API
- `/client` - Frontend game client
- `/docs` - Documentation

## Access Development Environment

When the development environment is running, you can access:

- **Client**: [http://localhost:5173](http://localhost:5173)
- **Server API**: [http://localhost:3000](http://localhost:3000)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **WebSocket Monitor**: [http://localhost:3000/monitor](http://localhost:3000/monitor)

## Hot Reloading

The setup supports hot reloading for both client and server code:

- Changes to server code will automatically restart the server
- Changes to client code will automatically refresh the browser

## Package Management

This project uses PNPM for package management. We've configured it to use a global store to avoid creating a `.pnpm-store` directory in the project.

If you find a `.pnpm-store` directory in your project, you can remove it with:

```bash
./dev.sh clean
```

This will ensure proper project structure and avoid issues with Docker volumes.

## Troubleshooting

See the [Server README](./server/README.md) for detailed troubleshooting information for database and Redis connection issues. 