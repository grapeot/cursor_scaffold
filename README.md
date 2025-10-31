# Cursor Scaffold

A mobile-friendly React application that provides a graphical interface for the Cursor Agent CLI.

[中文版](#中文版)

## Overview

This project serves as a **scaffold for Cursor CLI** development, designed to solve the pain point of using Cursor on mobile devices. The core idea is to expose an interface that calls a sandbox-free Cursor in a trusted environment, allowing mobile device control. Additionally, React's natural strengths make it ideal for displaying and visualizing results.

### Core Concept

This React app acts as a scaffold:
1. **Build the scaffold first** (this repository) - a foundation that provides a web interface for Cursor CLI
2. **Use the scaffold for development** - develop frontend or backend projects using Cursor
   - For backend development, intermediate results from subprocess calls can be exported to the Results tab, including visualizations
3. **Remove the scaffold when done** - once development is complete, the scaffold can be easily removed

### Pain Points Solved

- **Mobile Cursor Usage**: Using Cursor on mobile devices is challenging. This solution exposes an API interface in a trusted environment to call Cursor without sandbox restrictions, enabling mobile control.
- **Result Visualization**: React's component-based architecture is perfect for displaying results, intermediate outputs, and visualizations from development processes.
- **Mobile Development Workflow**: Enables a complete mobile development workflow, from coding to viewing results, all from a mobile device.

Perfect for scenarios where you need to develop from mobile devices, view intermediate results in real-time, and have a clean interface to interact with Cursor CLI.

## Project Structure

```
cursor_client/
├── client/              # React frontend application
│   ├── src/             # Source code
│   ├── .env.example     # Environment variables example file
│   └── ...
├── server/              # Python FastAPI backend service
│   ├── main.py          # Main application file
│   ├── requirements.txt # Python dependencies
│   ├── .env.example     # Environment variables example file
│   ├── venv/            # Python virtual environment (auto-created)
│   └── ...
├── start_frontend.sh    # Frontend startup script
├── start_backend.sh     # Backend startup script
├── design.md            # Product design document
└── README.md            # This file
```

## Prerequisites

- **Frontend**:
  - Node.js (recommended v18+)
  - npm or yarn
- **Backend**:
  - Python 3.10+
  - uv (recommended for virtual environment management) or pip
- **Cursor CLI**:
  - Must be installed and accessible via `cursor` command
  - Cursor account logged in and configured

### Installing Cursor CLI

Cursor CLI is required for this project to work. Install it using the official installer:

```bash
curl https://cursor.com/install -fsS | bash
```

Or visit [https://cursor.com/cli](https://cursor.com/cli) for detailed installation instructions and documentation.

After installation, verify it's working:

```bash
cursor --version
cursor agent create-chat
```

Make sure you're logged in to your Cursor account. If not, run:

```bash
cursor login
```

## Quick Start

### Method 1: Using Startup Scripts (Recommended)

The project provides convenient startup scripts that automatically install dependencies and configure environment variables:

#### Start Backend Server

```bash
./start_backend.sh
```

Or:

```bash
bash start_backend.sh
```

The script will automatically:
- Create Python virtual environment (using uv)
- Install Python dependencies (FastAPI, uvicorn, etc.)
- Configure environment variables (copy from `.env.example` to `.env`)
- Check if Cursor CLI is available
- Start FastAPI development server

#### Start Frontend Development Server

```bash
./start_frontend.sh
```

Or:

```bash
bash start_frontend.sh
```

The script will automatically:
- Check and install frontend dependencies
- Configure environment variables (copy from `.env.example to `.env`)
- Start development server

### Method 2: Manual Installation

#### 1. Install Dependencies

**Frontend Dependencies**
```bash
cd client
npm install
```

**Backend Dependencies**

Using uv (recommended):
```bash
cd server
uv venv
source venv/bin/activate
uv pip install -r requirements.txt
```

Or using pip:
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 2. Configure Environment Variables

**Environment Variable File Locations**:
- Frontend environment variables: `client/.env`
- Backend environment variables: `server/.env`

> **Note**: `.env` files are automatically created from `.env.example`. If the file doesn't exist, the startup script will create it automatically. You can also create or modify it manually.

**Frontend Environment Variables** (`client/.env`):

```env
# If not set, frontend will automatically infer from access address (use host IP for network access)
# Only set these variables when custom configuration is needed:
# VITE_API_URL=http://localhost:3001
# VITE_WS_URL=ws://localhost:3001/ws
```

> **Auto Address Detection**: The frontend now supports automatic detection of API and WebSocket addresses. When accessing from network (non-localhost), it automatically uses the current hostname; when accessing from localhost, it uses localhost. No manual configuration needed.

**Backend Environment Variables** (`server/.env`):

```env
PORT=3001
NODE_ENV=development
```

If `.env` files don't exist, you can manually copy from `.env.example`:

```bash
# Frontend
cd client
cp .env.example .env

# Backend
cd server
cp .env.example .env
```

## Local Development

### Using Startup Scripts

**Terminal 1 - Start Backend**:
```bash
./start_backend.sh
```

Backend runs on `http://localhost:3001` (listens on all network interfaces `0.0.0.0`, accessible from network)

**Terminal 2 - Start Frontend**:
```bash
./start_frontend.sh
```

Frontend runs on:
- **Local access**: `http://localhost:5200`
- **Network access**: `http://<YOUR_IP>:5200` (check startup script output for specific address)
- Vite automatically listens on all network interfaces (`0.0.0.0`), allowing access from other devices
- If port is occupied, Vite will automatically select the next available port

### Manual Startup

**Start Backend Server**

Run in `server/` directory:

```bash
# Activate virtual environment
source venv/bin/activate

# Start FastAPI development server
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

Or use startup script:
```bash
./start_backend.sh
```

**Start Frontend Development Server**

Run in `client/` directory:

```bash
npm run dev
```

### Access Application

Open browser and access frontend address:
- **Local access**: `http://localhost:5200`
- **Network access**: `http://<YOUR_IP>:5200` (startup script will display specific address)
- Frontend automatically detects access address and connects to correct backend API and WebSocket service

## Testing

### Functional Testing

1. **Session Creation Test**
   - Open application, should automatically create a new session
   - Check if session ID is displayed at the top

2. **Message Sending Test**
   - Enter a message in the input box (e.g., "Say hello")
   - Click send button
   - Should see message displayed on interface and receive Cursor's response

3. **Session Switch Test**
   - Click "New Session" button
   - Should create new session and switch context
   - New session messages should not include old session history

4. **WebSocket Connection Test**
   - Check top connection status shows "Connected"
   - If shows "Disconnected", check if backend is running properly

### End-to-End Test Flow

Using startup scripts (recommended):

```bash
# Terminal 1: Start backend
./start_backend.sh

# Terminal 2: Start frontend
./start_frontend.sh

# Browser: Access http://localhost:5200
# 1. Verify automatic session creation
# 2. Send test message: "Say hello"
# 3. Verify response received
# 4. Create new session
# 5. Verify session switch successful
```

Or manual startup:

```bash
# Terminal 1: Start backend
cd server
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 3001

# Terminal 2: Start frontend
cd client
npm run dev

# Browser: Access http://localhost:5200
```

### Command Line Testing

You can also test backend API directly:

```bash
# Create new session
curl -X POST http://localhost:3001/api/chat/create

# Should return something like: {"chatId":"7129401f-5fa1-438f-a7ae-4206fe055b76"}
```

## Build Production Version

### Build Frontend

```bash
cd client
npm run build
```

Build output in `client/dist/` directory

### Build Backend

FastAPI backend doesn't require build step, just run Python code directly. For production, recommended:

```bash
cd server
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 3001
```

Or use Gunicorn + Uvicorn workers (recommended for production):

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:3001
```

## Deployment

### Frontend Deployment

Frontend can be deployed to any static file server:

1. **Using Vite Preview** (local testing)
   ```bash
   cd client
   npm run build
   npm run preview
   ```

2. **Deploy to Vercel**
   - Connect GitHub repository
   - Set build directory to `client`
   - Set build command to `cd client && npm install && npm run build`
   - Set output directory to `client/dist`

3. **Deploy to Netlify**
   - Similar configuration as Vercel

4. **Deploy to Traditional Server**
   - Upload `client/dist/` directory contents to web server (Nginx, Apache, etc.)
   - Configure server to support single-page application routing

### Backend Deployment

Backend needs to be deployed to a Python-capable server:

1. **Using Gunicorn + Uvicorn** (recommended for production)
   ```bash
   cd server
   source venv/bin/activate
   pip install gunicorn
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:3001
   ```

2. **Using systemd** (Linux)
   - Create systemd service file
   - Set working directory and execution command to `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker`

3. **Deploy to Cloud Platform**
   - **Heroku**: Create `Procfile` with content `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Railway**: Set startup command to `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Render**: Set build command to `pip install -r requirements.txt`, startup command to `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Fly.io**: Create `fly.toml` config, use `uvicorn main:app` to start

### Environment Variable Configuration

Production environment needs correct environment variables:

**Frontend** (injected at build time):
```env
VITE_API_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com
```

**Backend**:
```env
PORT=3001
```

### Complete Deployment Example (Local Server)

Assuming you deploy frontend to Nginx, backend to same server:

1. **Build Frontend**
   ```bash
   cd client
   npm run build
   ```

2. **Copy Frontend Files**
   ```bash
   sudo cp -r client/dist/* /var/www/html/
   ```

3. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /var/www/html;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /ws {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

4. **Start Backend Service**
   ```bash
   cd server
   npm run build
   pm2 start dist/index.js --name cursor-server
   ```

5. **Configure SSL (Recommended)**
   - Use Let's Encrypt to configure HTTPS
   - Update frontend environment variables to `wss://` and `https://`

## Troubleshooting

### Backend Cannot Start

- Check if Python version meets requirements (Python 3.10+): run `python3 --version`
- Check if virtual environment is correctly created and activated
- Check if dependencies are correctly installed: run `pip list | grep fastapi`
- Check if `cursor` command is in PATH: run `which cursor`
- Check if Cursor is logged in: run `cursor agent create-chat` to test
- Check if `uv` is installed (if using startup script): run `which uv`

### Frontend Cannot Connect to Backend

- Check if backend is running
- Check if environment variables `VITE_API_URL` and `VITE_WS_URL` are correct
- Check browser console for network errors
- If CORS issue, check backend CORS configuration

### WebSocket Connection Failed

- Check if backend WebSocket server is running properly
- Check if firewall allows WebSocket connections
- Check proxy server configuration (if using Nginx, etc.)

### Session Creation Failed

- Confirm Cursor CLI is correctly installed and configured
- Check if `cursor agent create-chat` command can run directly
- Check backend logs for detailed error information

### File Editing Permission Issues

If Cursor Agent encounters permission issues when editing files (tool calls rejected):

- **Backend configured with `--force` parameter**: Code already includes `--force` flag to bypass sandbox restrictions
- If still having issues, you can check:
  - Is Cursor CLI version latest: run `cursor agent update`
  - Workspace trust settings: check `security.workspace.trust.enabled` in Cursor settings
  - Check backend logs for specific rejection reasons

The `--force` parameter works as: "Force allow commands unless explicitly denied", allowing all commands and file write operations unless explicitly denied.

## Network Access Configuration

### Frontend Network Access

- Frontend is configured to listen on `0.0.0.0`, accessible from other devices on the same network
- When starting frontend, script will automatically detect and display network access address
- API and WebSocket addresses will automatically adjust based on access method:
  - **localhost access**: uses `localhost:3001`
  - **Network access**: uses current host IP address (e.g., `192.168.1.100:3001`)

### Backend Network Access

- Backend is configured to listen on `0.0.0.0`, accessible from network
- Ensure firewall allows access to port 3001

### Access from Mobile Devices

1. Ensure both frontend and backend are running properly
2. Get server IP address (startup script will display)
3. Access `http://<SERVER_IP>:5200` on mobile device in the same WiFi network
4. Frontend will automatically connect to correct backend address

## Development Notes

- Frontend uses Zustand for state management, session data saved in localStorage
- Backend starts new `cursor agent` process for each request, doesn't maintain long-running subprocess
- Session state managed by Cursor internally, accessed via chatId
- Frontend event history saved locally, won't be lost on page refresh
- Frontend supports automatic API address detection, works in network environment without manual configuration

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 中文版 {#中文版}

# Cursor Scaffold

一个支持移动端友好的 React 应用，实现对 Cursor Agent CLI 的图形化封装。

## 项目概述

本项目作为 **Cursor 的脚手架**，旨在解决在手机上使用 Cursor 的不便。核心思路是暴露一个接口，在可信任的环境下调用无沙箱限制的 Cursor，从而实现移动设备控制。此外，React 天然的组件化特性非常适合展示和可视化结果。

### 核心概念

这个 React 应用作为一个脚手架：
1. **先搭建脚手架**（本仓库）- 提供一个为 Cursor CLI 提供 Web 接口的基础框架
2. **利用脚手架进行开发** - 使用 Cursor 开发前端或后端项目
   - 对于后端开发，可以通过 subprocess 等方式将中间结果导出到 Results 标签页，包括可视化内容
3. **开发完成后删除脚手架** - 开发完成后可以轻松移除脚手架

### 解决的痛点

- **移动端 Cursor 使用**：在手机上使用 Cursor 比较麻烦。此方案通过在可信任环境下暴露 API 接口来调用无沙箱限制的 Cursor，实现移动端控制。
- **结果可视化**：React 的组件化架构非常适合展示结果、中间输出以及开发过程中的可视化内容。
- **移动端开发工作流**：支持完整的移动端开发工作流，从编写代码到查看结果，全部都可以在移动设备上完成。

非常适合需要在移动设备上开发、实时查看中间结果、并通过简洁界面与 Cursor CLI 交互的场景。

## 项目结构

```
cursor_client/
├── client/              # React 前端应用
│   ├── src/             # 源代码
│   ├── .env.example     # 环境变量示例文件
│   └── ...
├── server/              # Python FastAPI 后端服务
│   ├── main.py          # 主应用文件
│   ├── requirements.txt # Python 依赖
│   ├── .env.example     # 环境变量示例文件
│   ├── venv/            # Python 虚拟环境（自动创建）
│   └── ...
├── start_frontend.sh    # 前端启动脚本
├── start_backend.sh     # 后端启动脚本
├── design.md            # 产品设计文档
└── README.md            # 本文件
```

## 前置要求

- **前端**：
  - Node.js (推荐 v18+)
  - npm 或 yarn
- **后端**：
  - Python 3.10+
  - uv (推荐，用于管理虚拟环境) 或 pip
- **Cursor CLI**：
  - 必须已安装并可在命令行访问 `cursor` 命令
  - Cursor 账户已登录并配置

### 安装 Cursor CLI

本项目需要 Cursor CLI 才能运行。使用官方安装程序安装：

```bash
curl https://cursor.com/install -fsS | bash
```

或访问 [https://cursor.com/cli](https://cursor.com/cli) 查看详细的安装说明和文档。

安装完成后，验证是否正常工作：

```bash
cursor --version
cursor agent create-chat
```

确保已登录 Cursor 账户。如果未登录，运行：

```bash
cursor login
```

## 快速开始

### 方法一：使用启动脚本（推荐）

项目提供了便捷的启动脚本，会自动安装依赖和配置环境变量：

#### 启动后端服务器

```bash
./start_backend.sh
```

或：

```bash
bash start_backend.sh
```

脚本会自动：
- 创建 Python 虚拟环境（使用 uv）
- 安装 Python 依赖（FastAPI, uvicorn 等）
- 配置环境变量（从 `.env.example` 复制到 `.env`）
- 检查 Cursor CLI 是否可用
- 启动 FastAPI 开发服务器

#### 启动前端开发服务器

```bash
./start_frontend.sh
```

或：

```bash
bash start_frontend.sh
```

脚本会自动：
- 检查并安装前端依赖
- 配置环境变量（从 `.env.example` 复制到 `.env`）
- 启动开发服务器

### 方法二：手动安装

#### 1. 安装依赖

**前端依赖**
```bash
cd client
npm install
```

**后端依赖**

使用 uv（推荐）：
```bash
cd server
uv venv
source venv/bin/activate
uv pip install -r requirements.txt
```

或使用 pip：
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 2. 配置环境变量

**环境变量文件位置**：
- 前端环境变量：`client/.env`
- 后端环境变量：`server/.env`

> **注意**：`.env` 文件已从 `.env.example` 自动创建，如果文件不存在，启动脚本会自动创建。你也可以手动创建或修改。

**前端环境变量**（`client/.env`）：

```env
# 如果不设置，前端会自动根据访问地址推断（网络访问时使用主机 IP）
# 仅在需要自定义时才设置以下变量：
# VITE_API_URL=http://localhost:3001
# VITE_WS_URL=ws://localhost:3001/ws
```

> **自动地址检测**：前端现在支持自动检测 API 和 WebSocket 地址。如果从网络访问（非 localhost），会自动使用当前主机名；如果是 localhost 访问，则使用 localhost。无需手动配置。

**后端环境变量**（`server/.env`）：

```env
PORT=3001
NODE_ENV=development
```

如果 `.env` 文件不存在，可以手动从 `.env.example` 复制：

```bash
# 前端
cd client
cp .env.example .env

# 后端
cd server
cp .env.example .env
```

## 本地开发

### 使用启动脚本启动

**终端 1 - 启动后端**：
```bash
./start_backend.sh
```

后端默认运行在 `http://localhost:3001`（监听所有网络接口 `0.0.0.0`，可通过网络访问）

**终端 2 - 启动前端**：
```bash
./start_frontend.sh
```

前端默认运行在：
- **本地访问**: `http://localhost:5200`
- **网络访问**: `http://<YOUR_IP>:5200`（可在启动脚本的输出中查看具体地址）
- Vite 会自动监听所有网络接口（`0.0.0.0`），允许从其他设备访问
- 如果端口被占用，Vite 会自动选择下一个可用端口

### 手动启动

**启动后端服务器**

在 `server/` 目录下运行：

```bash
# 激活虚拟环境
source venv/bin/activate

# 启动 FastAPI 开发服务器
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

或使用启动脚本：
```bash
./start_backend.sh
```

**启动前端开发服务器**

在 `client/` 目录下运行：

```bash
npm run dev
```

### 访问应用

打开浏览器访问前端地址：
- **本地访问**: `http://localhost:5200`
- **网络访问**: `http://<YOUR_IP>:5200`（启动脚本会显示具体地址）
- 前端会自动检测访问地址，并连接到正确的后端 API 和 WebSocket 服务

## 测试

### 功能测试

1. **会话创建测试**
   - 打开应用，应自动创建一个新会话
   - 检查顶部是否显示会话 ID

2. **消息发送测试**
   - 在输入框输入一条消息（例如："Say hello"）
   - 点击发送按钮
   - 应看到消息显示在界面上，并收到 Cursor 的响应

3. **会话切换测试**
   - 点击"新建会话"按钮
   - 应创建新会话并切换上下文
   - 新会话的消息不应包含旧会话的历史

4. **WebSocket 连接测试**
   - 检查顶部连接状态显示为"已连接"
   - 如果显示"未连接"，检查后端是否正常运行

### 端到端测试流程

使用启动脚本（推荐）：

```bash
# 终端 1: 启动后端
./start_backend.sh

# 终端 2: 启动前端
./start_frontend.sh

# 浏览器: 访问 http://localhost:5200
# 1. 验证自动创建会话
# 2. 发送测试消息："Say hello"
# 3. 验证收到响应
# 4. 创建新会话
# 5. 验证会话切换成功
```

或手动启动：

```bash
# 终端 1: 启动后端
cd server
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 3001

# 终端 2: 启动前端
cd client
npm run dev

# 浏览器: 访问 http://localhost:5200
```

### 命令行测试

你也可以直接测试后端 API：

```bash
# 创建新会话
curl -X POST http://localhost:3001/api/chat/create

# 应该返回类似：{"chatId":"7129401f-5fa1-438f-a7ae-4206fe055b76"}
```

## 构建生产版本

### 构建前端

```bash
cd client
npm run build
```

构建产物在 `client/dist/` 目录

### 构建后端

FastAPI 后端不需要构建步骤，直接运行 Python 代码即可。对于生产环境，建议使用：

```bash
cd server
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 3001
```

或使用 Gunicorn + Uvicorn workers（推荐用于生产环境）：
```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:3001
```

## 部署

### 前端部署

前端可以部署到任何静态文件服务器：

1. **使用 Vite Preview**（本地测试）
   ```bash
   cd client
   npm run build
   npm run preview
   ```

2. **部署到 Vercel**
   - 连接 GitHub 仓库
   - 设置构建目录为 `client`
   - 设置构建命令为 `cd client && npm install && npm run build`
   - 设置输出目录为 `client/dist`

3. **部署到 Netlify**
   - 类似 Vercel 的配置

4. **部署到传统服务器**
   - 将 `client/dist/` 目录内容上传到 Web 服务器（Nginx、Apache 等）
   - 配置服务器支持单页应用路由

### 后端部署

后端需要部署到支持 Python 的服务器：

1. **使用 Gunicorn + Uvicorn**（推荐用于生产环境）
   ```bash
   cd server
   source venv/bin/activate
   pip install gunicorn
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:3001
   ```

2. **使用 systemd**（Linux）
   - 创建 systemd service 文件
   - 设置工作目录和执行命令为 `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker`

3. **部署到云平台**
   - **Heroku**: 创建 `Procfile`，内容为 `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Railway**: 设置启动命令为 `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Render**: 设置构建命令为 `pip install -r requirements.txt`，启动命令为 `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Fly.io**: 创建 `fly.toml` 配置，使用 `uvicorn main:app` 启动

### 环境变量配置

生产环境需要设置正确的环境变量：

**前端**（构建时注入）：
```env
VITE_API_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com
```

**后端**：
```env
PORT=3001
```

### 完整部署示例（本地服务器）

假设你将前端部署到 Nginx，后端部署到同一服务器：

1. **构建前端**
   ```bash
   cd client
   npm run build
   ```

2. **复制前端文件**
   ```bash
   sudo cp -r client/dist/* /var/www/html/
   ```

3. **配置 Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /var/www/html;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /ws {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

4. **启动后端服务**
   ```bash
   cd server
   npm run build
   pm2 start dist/index.js --name cursor-server
   ```

5. **配置 SSL（推荐）**
   - 使用 Let's Encrypt 配置 HTTPS
   - 更新前端环境变量为 `wss://` 和 `https://`

## 故障排查

### 后端无法启动

- 检查 Python 版本是否满足要求（Python 3.10+）：运行 `python3 --version`
- 检查虚拟环境是否正确创建和激活
- 检查依赖是否正确安装：运行 `pip list | grep fastapi`
- 检查 `cursor` 命令是否在 PATH 中：运行 `which cursor`
- 检查 Cursor 是否已登录：运行 `cursor agent create-chat` 测试
- 检查 `uv` 是否已安装（如果使用启动脚本）：运行 `which uv`

### 前端无法连接后端

- 检查后端是否正在运行
- 检查环境变量 `VITE_API_URL` 和 `VITE_WS_URL` 是否正确
- 检查浏览器控制台的网络错误
- 如果是跨域问题，检查后端 CORS 配置

### WebSocket 连接失败

- 检查后端 WebSocket 服务器是否正常运行
- 检查防火墙是否允许 WebSocket 连接
- 检查代理服务器配置（如果使用 Nginx 等）

### 会话创建失败

- 确认 Cursor CLI 已正确安装和配置
- 检查 `cursor agent create-chat` 命令是否可以直接运行
- 查看后端日志获取详细错误信息

### 文件编辑权限问题

如果 Cursor Agent 在编辑文件时遇到权限问题（工具调用被 rejected）：

- **后端已配置 `--force` 参数**：代码中已经添加了 `--force` 标志来绕过沙箱限制
- 如果仍然遇到问题，可以检查：
  - Cursor CLI 版本是否最新：运行 `cursor agent update`
  - 工作区信任设置：在 Cursor 设置中检查 `security.workspace.trust.enabled`
  - 后端日志中查看具体的拒绝原因

`--force` 参数的作用是："Force allow commands unless explicitly denied"，允许所有命令和文件写入操作，除非被明确拒绝。

## 网络访问配置

### 前端网络访问

- 前端已配置为监听 `0.0.0.0`，可以从同一网络内的其他设备访问
- 启动前端时，脚本会自动检测并显示网络访问地址
- API 和 WebSocket 地址会根据访问方式自动调整：
  - **localhost 访问**: 使用 `localhost:3001`
  - **网络访问**: 使用当前主机 IP 地址（如 `192.168.1.100:3001`）

### 后端网络访问

- 后端已配置为监听 `0.0.0.0`，可以从网络访问
- 确保防火墙允许端口 3001 的访问

### 从移动设备访问

1. 确保前端和后端都正常启动
2. 获取运行服务器的 IP 地址（启动脚本会显示）
3. 在同一 WiFi 网络内的移动设备上访问 `http://<SERVER_IP>:5200`
4. 前端会自动连接到正确的后端地址

## 开发注意事项

- 前端使用 Zustand 进行状态管理，会话数据保存在 localStorage
- 后端每次请求都启动新的 `cursor agent` 进程，不维护长期运行的子进程
- 会话状态由 Cursor 内部管理，通过 chatId 访问
- 前端的事件历史保存在本地，刷新页面不会丢失
- 前端支持自动检测 API 地址，无需手动配置即可在网络环境中使用

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。
