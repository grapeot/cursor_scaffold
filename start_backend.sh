#!/bin/bash

# Cursor Scaffold - Main API Backend Startup Script (FastAPI)

set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVER_DIR="$SCRIPT_DIR/server"
VENV_DIR="$SERVER_DIR/venv"

# Check if in correct directory
if [ ! -f "$SERVER_DIR/main.py" ]; then
    echo "Error: server/main.py not found"
    echo "Please ensure you are running this script from the project root directory"
    exit 1
fi

# Check if cursor command is available
if ! command -v cursor &> /dev/null; then
    echo "Error: 'cursor' command not found"
    echo "Please ensure Cursor CLI is installed and in PATH"
    echo "You can check with: which cursor"
    exit 1
fi

# Check if uv is available
if ! command -v uv &> /dev/null; then
    echo "Error: 'uv' command not found"
    echo "Please install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Change to server directory
cd "$SERVER_DIR"

# Check if virtual environment exists, create if not
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment not found, creating..."
    uv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Check if dependencies are installed
if ! "$VENV_DIR/bin/python" -c "import fastapi" 2>/dev/null; then
    echo "Dependencies not installed, installing..."
    "$VENV_DIR/bin/pip" install -r requirements.txt || uv pip install -r requirements.txt
fi

# Check if .env file exists, copy from .env.example if not
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo ".env file not found, copying from .env.example..."
        cp .env.example .env
    else
        echo "Warning: .env file not found, using default configuration"
    fi
fi

# Start development server
echo "Starting Main API Server (FastAPI)..."
echo "Server will run on:"
echo "  - Local access: http://localhost:3001"
echo "  - Network access: http://$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo 'YOUR_IP'):3001"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 3001
