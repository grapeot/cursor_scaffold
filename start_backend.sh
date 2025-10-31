#!/bin/bash

# Cursor Client - Backend 启动脚本

set -e

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVER_DIR="$SCRIPT_DIR/server"

# 检查是否在正确的目录
if [ ! -f "$SERVER_DIR/package.json" ]; then
    echo "错误: 找不到 server/package.json 文件"
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

# 进入 server 目录
cd "$SERVER_DIR"

# 检查 node_modules 是否存在，如果不存在则安装依赖
if [ ! -d "node_modules" ]; then
    echo "检测到未安装依赖，正在安装..."
    npm install
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

# 启动开发服务器
echo "启动后端服务器..."
echo "后端将运行在 http://localhost:3001"
echo "WebSocket 将运行在 ws://localhost:3001"
echo ""

npm run dev

