#!/bin/bash

# Cursor Scaffold - Cursor Agent Backend Startup Script
# This server runs WITHOUT reload to preserve cursor agent processes

set -e

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVER_DIR="$SCRIPT_DIR/server"
VENV_DIR="$SERVER_DIR/venv"

# 检查是否在正确的目录
if [ ! -f "$SERVER_DIR/cursor_server.py" ]; then
    echo "错误: 找不到 server/cursor_server.py 文件"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# 检查 cursor 命令是否可用
if ! command -v cursor &> /dev/null; then
    echo "错误: 找不到 'cursor' 命令"
    echo "请确保 Cursor CLI 已安装并在 PATH 中"
    echo "你可以通过以下方式检查: which cursor"
    exit 1
fi

# 检查 uv 是否可用
if ! command -v uv &> /dev/null; then
    echo "错误: 找不到 'uv' 命令"
    echo "请安装 uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# 进入 server 目录
cd "$SERVER_DIR"

# 检查虚拟环境是否存在，如果不存在则创建
if [ ! -d "$VENV_DIR" ]; then
    echo "检测到未创建虚拟环境，正在创建..."
    uv venv
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source "$VENV_DIR/bin/activate"

# 检查依赖是否安装
if ! "$VENV_DIR/bin/python" -c "import fastapi" 2>/dev/null; then
    echo "检测到未安装依赖，正在安装..."
    "$VENV_DIR/bin/pip" install -r requirements.txt || uv pip install -r requirements.txt
fi

# 检查 .env 文件是否存在，如果不存在则从 .env.example 复制
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "检测到未配置 .env 文件，从 .env.example 复制..."
        cp .env.example .env
    else
        echo "警告: 未找到 .env 文件，使用默认配置"
    fi
fi

# 启动 Cursor Agent 服务器 (NO RELOAD - processes persist)
echo "启动 Cursor Agent 服务器 (无自动重载)..."
echo "后端将运行在:"
echo "  - 本地访问: http://localhost:3002"
echo "  - 网络访问: http://$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo 'YOUR_IP'):3002"
echo "WebSocket 将运行在:"
echo "  - 本地访问: ws://localhost:3002/ws"
echo "  - 网络访问: ws://$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo 'YOUR_IP'):3002/ws"
echo ""
echo "注意: 此服务器不启用自动重载，以保持 cursor agent 进程持续运行"
echo ""

uvicorn cursor_server:app --host 0.0.0.0 --port 3002

