#!/bin/bash

# Cursor Scaffold - Frontend Startup Script

set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLIENT_DIR="$SCRIPT_DIR/client"

# Check if in correct directory
if [ ! -f "$CLIENT_DIR/package.json" ]; then
    echo "Error: client/package.json not found"
    echo "Please ensure you are running this script from the project root directory"
    exit 1
fi

# Change to client directory
cd "$CLIENT_DIR"

# Check if node_modules exists, install dependencies if not
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed, installing..."
    npm install
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
echo "Starting frontend development server..."
echo "Frontend will run on:"
echo "  - Local access: http://localhost:5200"
echo "  - Network access: http://$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo 'YOUR_IP'):5200"
echo "  (If port is occupied, Vite will automatically select the next available port)"
echo ""

npm run dev
