# Server Setup Guide

This project uses **two separate backend servers** to prevent cursor agent processes from being killed during development reloads.

## Architecture

- **Main API Server** (port 3001): Handles regular API endpoints (articles, stock data, etc.). Uses auto-reload for development.
- **Cursor Agent Server** (port 3002): Handles cursor agent WebSocket connections and chat creation. **NO auto-reload** to preserve cursor agent processes.

## Starting the Servers

### Option 1: Start Both Servers (Recommended)

```bash
# Terminal 1: Start Cursor Agent Server (no reload)
./start_backend_cursor.sh

# Terminal 2: Start Main API Server (with reload)
./start_backend.sh

# Or start main API server directly:
cd server
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

### Option 2: Start Only Cursor Agent Server

If you only need cursor agent functionality:

```bash
./start_backend_cursor.sh
```

## Port Configuration

- **Main API Server**: Port 3001 (configurable via `PORT` env var)
- **Cursor Agent Server**: Port 3002 (hardcoded in `cursor_server.py`)

## Why Two Servers?

The Cursor Agent Server runs **without auto-reload** because:
- Cursor agent processes are long-running subprocesses
- When the server reloads, it kills all active processes
- This breaks ongoing cursor agent tasks
- By separating into two servers, the cursor agent server can run continuously while the main API server can reload safely

## Development Workflow

1. Start the Cursor Agent Server first (it should stay running)
2. Start the Main API Server (can reload as you make changes)
3. The frontend automatically connects to:
   - Port 3002 for cursor agent operations (WebSocket, chat creation)
   - Port 3001 for other API endpoints

## Troubleshooting

- **Port conflicts**: Make sure ports 3001 and 3002 are not in use
- **Connection issues**: Verify both servers are running
- **Cursor agent not working**: Check the Cursor Agent Server logs (should be running without reload)

