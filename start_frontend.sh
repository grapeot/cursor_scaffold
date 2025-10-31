#!/bin/bash

# Cursor Scaffold - Frontend Startup Script

set -e

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLIENT_DIR="$SCRIPT_DIR/client"

# 检查是否在正确的目录
if [ ! -f "$CLIENT_DIR/package.json" ]; then
    echo "错误: 找不到 client/package.json 文件"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# 进入 client 目录
cd "$CLIENT_DIR"

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
echo "启动前端开发服务器..."
echo "前端将运行在:"
echo "  - 本地访问: http://localhost:5200"
echo "  - 网络访问: http://$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo 'YOUR_IP'):5200"
echo "  (如果端口被占用，Vite 会自动选择下一个可用端口)"
echo ""

npm run dev

